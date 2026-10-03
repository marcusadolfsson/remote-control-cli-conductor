# Remote Control CLI Servers

The Claude Code half of [Remote Control CLI Servers](https://github.com/marcusadolfsson/remote-control-cli-servers):
your Linux machines' Claude Code accounts and sessions, in a pane beside the conversation, in the
terminal or the Claude desktop app's Code tab. Pair hosts, see their profiles (Claude accounts) and
sessions, start, resume, restart, stop, rename, move, archive and restore sessions, answer what a
session is asking in its tmux window, and sign profiles in, out or over to another account. Claude
gets the same as tools.

## Requirements

- **macOS**, with Claude Code 2.1.287 or later (the desktop app's own Claude Code loads it too). The
  plugin uses tools macOS ships with; it doesn't run on Linux or Windows.
- **On each Linux host**, `remote-control-conductor-server`, from this project's
  [releases](https://github.com/marcusadolfsson/remote-control-cli-servers/releases), installed and
  set up as the project's README describes. The plugin does nothing until a host is paired.

## Use

- `/remote-control-cli-servers` opens the pane: every host as a card, its profiles and their
  sessions. Each has a ⋯ menu of its actions, each with a letter that presses it while the menu is
  open. The pane reads the hosts again every 15 s while it's open.
- `/remote-control-cli-servers pair` opens the pane with the pairing dialog.
- `/remote-control-cli-servers text` answers as text, for `claude -p`.
- `/remote-control-cli-servers demo` swaps in three made-up hosts, for screenshots; again to swap back.
- Tools for Claude, as `mcp__remote-control-cli-servers__<name>`: `list_profiles`, `list_sessions`,
  `host_info`, `list_folders`, `new_session`, `resume_session`, `restart_session`,
  `restart_outdated`, `stop_session`, `rename_session`, `read_window`, `send_to_window`,
  `open_in_claude`, `sign_in`, `switch_account`, `finish_sign_in`, `plan_move`, `move_session`,
  `archive_session`, `restore_session`, `delete_archive`.

## What it runs, reads and sends

The plugin is a mod: TypeScript that Claude Code runs. Everything outside it goes through these
programs, all part of macOS, run with your user's permissions:

| Program | What for |
|---|---|
| `curl` | Every request to a paired host, over HTTPS pinned to that host's public key. The plugin contacts no other server. |
| `security` | Reads and writes the token each host issued at pairing, in your login Keychain (service `app.ai-profiles.remote-host`, one item per host). A shell passes it to `curl` on stdin; it never enters the plugin's code, a command line, or a log. |
| `openssl`, `shasum` | When a host is first reached: check its certificate against the fingerprint the pairing code carried, and take its public key's hash for pinning. |
| `jq` | When pairing: take the new token out of the host's answer, so it goes straight to the Keychain. |
| `scutil` | When pairing: your Mac's name, which the host shows in its list of paired clients. |
| `open` | Opens a session's claude.ai link, a sign-in page a host offers (only on claude.com, claude.ai, platform.claude.com or console.anthropic.com), or the Claude desktop app. |
| `osascript` | Only when you choose Open in Terminal: opens Terminal with `ssh` to that host's tmux window. |
| `/Applications/Remote Control Conductor.app` | Only if that Mac app is installed and you choose Open in Claude app: asks it, in one local call, which Claude desktop app is signed in as the session's account. |

What it reads and keeps on your Mac:

- the hosts you paired (names, addresses, certificate fingerprints, no tokens) and each host's
  public-key hash, in the plugin's own store under `~/.claude`;
- the Mac app's host list, `~/Library/Application Support/ai-profiles/remote-hosts.json`, if it's
  there, so hosts paired in the Mac app appear too.

What it sends: only to your own hosts, the requests the pane and tools make (list, start, stop, move
sessions and so on), with that host's token. Nothing goes to Anthropic or anyone else, apart from
the pages it opens in your browser.

## Install

```sh
claude plugin marketplace add marcusadolfsson/remote-control-cli-servers
claude plugin install remote-control-cli-servers@remote-control-cli-servers
```

Or load it from a checkout for one session: `claude --plugin-dir plugin`.

## Develop

- `claude plugin validate --strict plugin`: what it hooks and calls, and anything the engine would
  refuse.
- `claude plugin test plugin`: the helpers' unit tests, and the panes and dialogs against a fake host
  on the terminal and the desktop.
- Everything that calls `$` is in `hooks/register.tsx` (the engine reads the calls off its source);
  the views are in `hooks/views/`, the pure helpers in `hooks/lib/`.
