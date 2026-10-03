//! Reading Claude Code transcripts: `<config>/projects/<project>/<id>.jsonl`.
//!
//! Shared by the server and its clients, so it depends on nothing but std,
//! serde and flate2. Everything here reads Claude Code internals, which can
//! change between versions.
//!
//! A transcript is read once, then read on from where it stopped as Claude
//! appends to it ([`read_transcript_from`]): a running session's grows to
//! hundreds of megabytes, and is listed again every few seconds.

use std::borrow::Cow;
use std::collections::BTreeSet;
use std::fs;
use std::io::{self, BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use serde::de::IgnoredAny;
use serde::Deserialize;

/// How much of the first prompt is kept: enough for a title, cut by [`short_line`].
const FIRST_PROMPT_CHARS: usize = 200;

/// What a transcript says about its session.
#[derive(Debug, Default, Clone)]
pub struct TranscriptInfo {
    pub cwd: Option<String>,
    pub custom_title: Option<String>,
    pub ai_title: Option<String>,
    pub last_prompt: Option<String>,
    /// The first thing the user typed in the main conversation.
    pub first_prompt: Option<String>,
    pub first_timestamp: Option<String>,
    /// The latest record's time: when the session was last used.
    pub last_timestamp: Option<String>,
    /// Claude replied at least once.
    pub has_reply: bool,
    /// Plan slugs the session wrote, `plans/<slug>.md`.
    pub slugs: BTreeSet<String>,
    /// A message of the main conversation was seen (`isSidechain` false or absent).
    pub has_main: bool,
    /// A message of a subagent's conversation was seen (`isSidechain` true).
    pub has_sidechain: bool,
}

impl TranscriptInfo {
    /// Opened and closed without anything happening, like Claude's own
    /// `/resume` hides.
    pub fn is_empty(&self) -> bool {
        !self.has_reply && self.last_prompt.is_none() && self.first_prompt.is_none()
    }

    /// A subagent's own conversation, filed where sessions are: no session of
    /// its own to list.
    pub fn is_subagent_only(&self) -> bool {
        self.has_sidechain && !self.has_main
    }

    pub fn title(&self) -> Option<String> {
        self.custom_title.clone().or_else(|| self.ai_title.clone())
    }

    /// What to call the session where nothing has named it better: its
    /// `/rename` name (the bool is true: the user chose it), else Claude's
    /// generated title, else its last prompt, else its first, cut to a short line.
    pub fn name(&self) -> Option<(String, bool)> {
        if let Some(title) = &self.custom_title {
            return Some((title.clone(), true));
        }
        self.ai_title
            .clone()
            .or_else(|| self.last_prompt.as_deref().and_then(short_line))
            .or_else(|| self.first_prompt.as_deref().and_then(short_line))
            .map(|name| (name, false))
    }
}

/// The few fields of a transcript line that matter here, borrowed from the
/// line where they need no unescaping. Everything else, a message's content
/// included, is skipped over without being built.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Line<'a> {
    #[serde(rename = "type", borrow)]
    kind: Option<Cow<'a, str>>,
    #[serde(borrow)]
    cwd: Option<Cow<'a, str>>,
    custom_title: Option<String>,
    ai_title: Option<String>,
    last_prompt: Option<String>,
    #[serde(borrow)]
    slug: Option<Cow<'a, str>>,
    #[serde(borrow)]
    timestamp: Option<Cow<'a, str>>,
    is_sidechain: Option<bool>,
    is_meta: Option<bool>,
    message: Option<IgnoredAny>,
}

/// A user line once more, for its message: read only until the first prompt is found.
#[derive(Deserialize)]
struct UserLine {
    message: Option<UserMessage>,
}

#[derive(Deserialize)]
struct UserMessage {
    content: Option<Content>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Content {
    Text(String),
    Blocks(Vec<Block>),
}

#[derive(Deserialize)]
struct Block {
    #[serde(rename = "type")]
    kind: Option<String>,
    text: Option<String>,
}

/// Read what the Sessions list needs from the transcript at `path`, gzipped
/// when it ends in `.gz`, as an archived one does. Lines that are not JSON
/// (a write cut short) are skipped. Later lines win: the working folder moves
/// when a session is relocated, and titles are re-appended when they change.
pub fn read_transcript(path: &Path) -> io::Result<TranscriptInfo> {
    let file = fs::File::open(path)?;
    if path.extension().is_some_and(|ext| ext == "gz") {
        let mut info = TranscriptInfo::default();
        for line in BufReader::new(flate2::read::GzDecoder::new(file)).lines() {
            apply(&mut info, line?.as_bytes());
        }
        return Ok(info);
    }
    read_lines(file, TranscriptInfo::default()).map(|(info, _)| info)
}

/// Read on in a transcript Claude is still appending to: `info` is what the
/// first `offset` bytes of it said (as this returned them), and only what was
/// written after is read. A plain `.jsonl` only.
///
/// Returns what the whole transcript says, and the offset to read on from
/// next time: the end of its last complete line. A last line still being
/// written counts if it already reads as JSON, and is read again once
/// finished, which changes nothing, since reading a line twice in a row
/// leaves the same result.
///
/// Fails with `InvalidData` when `offset` isn't just past a newline: the
/// file isn't the one `info` was read from, and needs reading in full.
pub fn read_transcript_from(
    path: &Path,
    info: TranscriptInfo,
    offset: u64,
) -> io::Result<(TranscriptInfo, u64)> {
    let mut file = fs::File::open(path)?;
    if offset > 0 {
        file.seek(SeekFrom::Start(offset - 1))?;
        let mut before = [0u8];
        file.read_exact(&mut before)?;
        if before != *b"\n" {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "the transcript changed before where it was read to",
            ));
        }
    }
    let (info, read) = read_lines(file, info)?;
    Ok((info, offset + read))
}

/// Apply every line from where `file` is, and say how many bytes the
/// complete ones (ending in a newline) took.
fn read_lines(file: fs::File, mut info: TranscriptInfo) -> io::Result<(TranscriptInfo, u64)> {
    let mut reader = BufReader::with_capacity(1 << 16, file);
    let mut line = Vec::new();
    let mut complete = 0u64;
    loop {
        line.clear();
        let read = reader.read_until(b'\n', &mut line)?;
        if read == 0 {
            break;
        }
        apply(&mut info, &line);
        if line.last() == Some(&b'\n') {
            complete += read as u64;
        }
    }
    Ok((info, complete))
}

/// What one transcript line adds to `info`.
fn apply(info: &mut TranscriptInfo, line: &[u8]) {
    let Ok(parsed) = serde_json::from_slice::<Line>(line) else {
        return;
    };
    let kind = parsed.kind.as_deref();
    if matches!(kind, Some("user" | "assistant")) {
        if parsed.is_sidechain == Some(true) {
            info.has_sidechain = true;
        } else {
            info.has_main = true;
        }
    }
    match kind {
        Some("assistant") => info.has_reply = true,
        Some("custom-title") => {
            info.custom_title = parsed.custom_title.or(info.custom_title.take())
        }
        Some("ai-title") => info.ai_title = parsed.ai_title.or(info.ai_title.take()),
        Some("last-prompt") => info.last_prompt = parsed.last_prompt.or(info.last_prompt.take()),
        Some("user")
            if info.first_prompt.is_none()
                && parsed.is_sidechain != Some(true)
                && parsed.is_meta != Some(true)
                && parsed.message.is_some() =>
        {
            info.first_prompt = typed_text(line);
        }
        _ => {}
    }
    if let Some(cwd) = parsed.cwd {
        info.cwd = Some(cwd.into_owned());
    }
    if let Some(slug) = parsed.slug.filter(|slug| is_safe_name(slug)) {
        if !info.slugs.contains(slug.as_ref()) {
            info.slugs.insert(slug.into_owned());
        }
    }
    if let Some(timestamp) = parsed.timestamp {
        if info.first_timestamp.is_none() {
            info.first_timestamp = Some(timestamp.to_string());
        }
        info.last_timestamp = Some(timestamp.into_owned());
    }
}

/// What the user typed in a user line: its text, unless it's a tool's result
/// or something Claude Code wrote for them (a command, a reminder: those start
/// with a tag), cut to [`FIRST_PROMPT_CHARS`].
fn typed_text(line: &[u8]) -> Option<String> {
    let content = serde_json::from_slice::<UserLine>(line)
        .ok()?
        .message?
        .content?;
    let text = match content {
        Content::Text(text) => text,
        Content::Blocks(blocks) => {
            blocks
                .into_iter()
                .find(|block| block.kind.as_deref() == Some("text"))?
                .text?
        }
    };
    let text = text.trim();
    if text.is_empty() || text.starts_with('<') {
        return None;
    }
    Some(text.chars().take(FIRST_PROMPT_CHARS).collect())
}

/// The name Claude Code keeps beside a transcript in `<id>/custom-title.json`
/// (`{"customTitle": "…"}`), for a session renamed where no record says so.
pub fn title_file(transcript: &Path) -> Option<String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct TitleFile {
        custom_title: Option<String>,
    }
    let folder = transcript.with_extension("");
    let text = fs::read(folder.join("custom-title.json")).ok()?;
    let title = serde_json::from_slice::<TitleFile>(&text)
        .ok()?
        .custom_title?;
    let title = title.trim();
    (!title.is_empty()).then(|| title.to_string())
}

/// The first line of `text`, trimmed, cut to a title's length on a character
/// boundary. `None` when nothing is left.
pub fn short_line(text: &str) -> Option<String> {
    const MAX_CHARS: usize = 60;
    let line = text.lines().map(str::trim).find(|line| !line.is_empty())?;
    if line.chars().count() <= MAX_CHARS {
        return Some(line.to_string());
    }
    let cut: String = line.chars().take(MAX_CHARS - 1).collect();
    Some(format!("{}…", cut.trim_end()))
}

/// A file name that stays inside the folder it is joined to.
pub fn is_safe_name(name: &str) -> bool {
    !name.is_empty() && name != "." && name != ".." && !name.contains('/') && !name.contains('\0')
}

/// Every transcript in `config_dir`: `projects/<project>/<id>.jsonl`, one level
/// down only, since subagent transcripts sit deeper. Returns (project, id, path).
pub fn transcripts(config_dir: &Path) -> Vec<(String, String, PathBuf)> {
    let Ok(projects) = fs::read_dir(config_dir.join("projects")) else {
        return Vec::new();
    };
    let mut found = Vec::new();
    for project in projects.flatten() {
        if !project.file_type().is_ok_and(|kind| kind.is_dir()) {
            continue;
        }
        let project_name = project.file_name().to_string_lossy().into_owned();
        let Ok(files) = fs::read_dir(project.path()) else {
            continue;
        };
        for file in files.flatten() {
            let path = file.path();
            if path.extension().is_none_or(|ext| ext != "jsonl") {
                continue;
            }
            if !file.file_type().is_ok_and(|kind| kind.is_file()) {
                continue;
            }
            let Some(id) = path
                .file_stem()
                .map(|stem| stem.to_string_lossy().into_owned())
            else {
                continue;
            };
            found.push((project_name.clone(), id, path));
        }
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write(path: &Path, text: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }

    #[test]
    fn reads_the_latest_cwd_titles_and_plan_slugs() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("s.jsonl");
        write(
            &path,
            concat!(
                r#"{"type":"user","cwd":"/scratch","timestamp":"2026-01-01T00:00:00Z","message":{"content":"{\"cwd\":\"/nested\"}"}}"#,
                "\n",
                r#"{"type":"assistant","cwd":"/scratch","slug":"bold-plan"}"#,
                "\n",
                "{not json\n",
                r#"{"type":"ai-title","aiTitle":"Generated"}"#,
                "\n",
                r#"{"type":"relocated"}"#,
                "\n",
                r#"{"type":"user","cwd":"/work","timestamp":"2026-01-02T00:00:00Z"}"#,
                "\n",
                r#"{"type":"custom-title","customTitle":"Old name"}"#,
                "\n",
                r#"{"type":"custom-title","customTitle":"New name"}"#,
                "\n",
                r#"{"type":"last-prompt","lastPrompt":"do it"}"#,
                "\n",
                r#"{"type":"assistant","slug":"../escape"}"#,
                "\n",
            ),
        );
        let info = read_transcript(&path).unwrap();
        assert_eq!(info.cwd.as_deref(), Some("/work"));
        assert_eq!(info.title().as_deref(), Some("New name"));
        assert_eq!(info.last_prompt.as_deref(), Some("do it"));
        assert_eq!(
            info.first_timestamp.as_deref(),
            Some("2026-01-01T00:00:00Z")
        );
        assert_eq!(info.last_timestamp.as_deref(), Some("2026-01-02T00:00:00Z"));
        assert!(info.has_reply);
        assert_eq!(
            info.slugs.into_iter().collect::<Vec<_>>(),
            vec!["bold-plan".to_string()]
        );
    }

    #[test]
    fn a_session_moved_to_another_folder_works_there() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("s.jsonl");
        write(
            &path,
            concat!(
                r#"{"type":"user","cwd":"/old/place","message":{"content":"start"}}"#,
                "\n",
                r#"{"type":"assistant","cwd":"/old/place"}"#,
                "\n",
                r#"{"type":"system","subtype":"relocated","cwd":"/new/place"}"#,
                "\n",
            ),
        );
        assert_eq!(
            read_transcript(&path).unwrap().cwd.as_deref(),
            Some("/new/place")
        );
    }

    #[test]
    fn the_first_prompt_is_the_first_thing_the_user_typed() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("s.jsonl");
        let long = "x".repeat(300);
        write(
            &path,
            &[
                r#"{"type":"user","isMeta":true,"message":{"content":"<local-command-caveat>…</local-command-caveat>"}}"#.to_string(),
                r#"{"type":"user","message":{"content":"<command-name>/model</command-name>"}}"#.to_string(),
                r#"{"type":"user","message":{"content":[{"type":"tool_result","content":"ok"}]}}"#.to_string(),
                format!(r#"{{"type":"user","message":{{"content":[{{"type":"text","text":"  Fix the build {long}"}}]}}}}"#),
                r#"{"type":"user","message":{"content":"Something later"}}"#.to_string(),
            ]
            .join("\n"),
        );
        let info = read_transcript(&path).unwrap();
        let first = info.first_prompt.unwrap();
        assert!(first.starts_with("Fix the build x"));
        assert_eq!(first.chars().count(), FIRST_PROMPT_CHARS);
    }

    #[test]
    fn a_subagents_own_transcript_is_told_apart() {
        let dir = tempfile::tempdir().unwrap();
        let side = dir.path().join("side.jsonl");
        write(
            &side,
            concat!(
                r#"{"type":"user","isSidechain":true,"message":{"content":"task"}}"#,
                "\n",
                r#"{"type":"assistant","isSidechain":true}"#,
                "\n",
            ),
        );
        let info = read_transcript(&side).unwrap();
        assert!(info.is_subagent_only());
        assert_eq!(info.first_prompt, None, "a subagent's task is no prompt");

        let main = dir.path().join("main.jsonl");
        write(
            &main,
            concat!(
                r#"{"type":"user","isSidechain":false,"message":{"content":"hello"}}"#,
                "\n",
                r#"{"type":"assistant","isSidechain":true}"#,
                "\n",
            ),
        );
        assert!(!read_transcript(&main).unwrap().is_subagent_only());
    }

    #[test]
    fn a_title_file_beside_the_transcript_names_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("abc.jsonl");
        write(&path, "");
        assert_eq!(title_file(&path), None);
        write(
            &dir.path().join("abc/custom-title.json"),
            r#"{"customTitle":" Flaky build "}"#,
        );
        assert_eq!(title_file(&path).as_deref(), Some("Flaky build"));
        write(
            &dir.path().join("abc/custom-title.json"),
            r#"{"customTitle":""}"#,
        );
        assert_eq!(title_file(&path), None);
    }

    #[test]
    fn reading_on_from_an_offset_reads_as_the_whole_file_would() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("s.jsonl");
        let first = concat!(
            r#"{"type":"user","cwd":"/a","timestamp":"2026-01-01T00:00:00Z","message":{"content":"go"}}"#,
            "\n",
            r#"{"type":"ai-title","aiTitle":"First"}"#,
            "\n",
        );
        // The last line is still being written.
        write(
            &path,
            &format!("{first}{{\"type\":\"assistant\",\"slug\":\"pl"),
        );
        let (info, offset) = read_transcript_from(&path, TranscriptInfo::default(), 0).unwrap();
        assert_eq!(offset, first.len() as u64);
        assert!(!info.has_reply);
        assert_eq!(info.ai_title.as_deref(), Some("First"));

        let rest = concat!(
            r#"{"type":"assistant","slug":"plan"}"#,
            "\n",
            r#"{"type":"user","cwd":"/b","timestamp":"2026-01-02T00:00:00Z"}"#,
            "\n",
            r#"{"type":"custom-title","customTitle":"Mine"}"#,
            "\n",
        );
        write(&path, &format!("{first}{rest}"));
        let (info, offset) = read_transcript_from(&path, info, offset).unwrap();
        assert_eq!(offset, (first.len() + rest.len()) as u64);
        let whole = read_transcript(&path).unwrap();
        for info in [&info, &whole] {
            assert!(info.has_reply);
            assert_eq!(info.cwd.as_deref(), Some("/b"));
            assert_eq!(info.title().as_deref(), Some("Mine"));
            assert_eq!(info.first_prompt.as_deref(), Some("go"));
            assert_eq!(
                info.first_timestamp.as_deref(),
                Some("2026-01-01T00:00:00Z")
            );
            assert_eq!(info.last_timestamp.as_deref(), Some("2026-01-02T00:00:00Z"));
            assert_eq!(info.slugs.iter().collect::<Vec<_>>(), vec!["plan"]);
        }
    }

    #[test]
    fn a_last_line_already_whole_counts_before_its_newline() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("s.jsonl");
        write(&path, r#"{"type":"last-prompt","lastPrompt":"go"}"#);
        let (info, offset) = read_transcript_from(&path, TranscriptInfo::default(), 0).unwrap();
        assert_eq!(info.last_prompt.as_deref(), Some("go"));
        assert_eq!(offset, 0);
        assert_eq!(
            read_transcript(&path).unwrap().last_prompt.as_deref(),
            Some("go")
        );
    }

    #[test]
    fn reading_on_refuses_a_file_that_changed_before_the_offset() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("s.jsonl");
        write(&path, "{\"type\":\"user\"}\n");
        let (info, offset) = read_transcript_from(&path, TranscriptInfo::default(), 0).unwrap();
        write(&path, "{\"type\":\"assistant\",\"cwd\":\"/x\"}\n");
        let error = read_transcript_from(&path, info, offset).unwrap_err();
        assert_eq!(error.kind(), io::ErrorKind::InvalidData);
    }

    #[test]
    fn name_prefers_the_users_name_then_claudes_then_the_prompts() {
        let mut info = TranscriptInfo {
            first_prompt: Some("The very first ask".into()),
            ..TranscriptInfo::default()
        };
        assert_eq!(info.name(), Some(("The very first ask".into(), false)));
        info.last_prompt = Some("\n  Reply with just: ok  \nand more".into());
        assert_eq!(info.name(), Some(("Reply with just: ok".into(), false)));
        info.ai_title = Some("Generated".into());
        assert_eq!(info.name(), Some(("Generated".into(), false)));
        info.custom_title = Some("Mine".into());
        assert_eq!(info.name(), Some(("Mine".into(), true)));
        assert_eq!(TranscriptInfo::default().name(), None);
    }

    #[test]
    fn short_line_cuts_long_prompts_on_a_character_boundary() {
        let long = "é".repeat(100);
        let cut = short_line(&long).unwrap();
        assert_eq!(cut.chars().count(), 60);
        assert!(cut.ends_with('…'));
        assert_eq!(short_line("   \n  "), None);
    }

    #[test]
    fn a_session_nothing_happened_in_is_empty() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("s.jsonl");
        write(&path, "{\"type\":\"user\",\"cwd\":\"/w\"}\n");
        assert!(read_transcript(&path).unwrap().is_empty());
    }

    #[test]
    fn transcripts_skips_subagent_transcripts_and_other_files() {
        let dir = tempfile::tempdir().unwrap();
        let project = dir.path().join("projects/-work");
        write(&project.join("a.jsonl"), "");
        write(&project.join("a/subagents/agent-x.jsonl"), "");
        write(&project.join("memory/MEMORY.md"), "");
        write(&dir.path().join("projects/stray.jsonl"), "");
        let found = transcripts(dir.path());
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].0, "-work");
        assert_eq!(found[0].1, "a");
    }
}
