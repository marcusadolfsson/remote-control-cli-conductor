# Remote Control CLI Servers

Run Claude Code on your Linux machines, and manage it from Claude Code on your Mac.

Each Linux host runs a small server, `remote-control-conductor-server`. It keeps Claude Code
sessions running in tmux with [Remote Control](https://code.claude.com/docs/en/remote-control) on,
so they show up in the Claude apps on your phone and desktop. It also handles several Claude
accounts per host, each in its own folder.

On your Mac, a Claude Code plugin (a [mod](https://code.claude.com/docs/en/plugins/mods/overview))
puts all of it in a pane beside the conversation:

- every host as a card, its profiles (Claude accounts) and their sessions, refreshing on its own;
- start, resume, restart, stop, rename, archive and restore sessions;
- move a session to another profile, with Claude merging any memory notes both sides changed;
- answer what a session is asking, in a live view of its tmux window you can click into and type;
- sign a profile in, out, or over to another account, with the sign-in page in your browser;
- open a session on claude.ai or in the Claude desktop app;
- the same as tools for Claude: "restart the sessions on atlas that are waiting on an update".

It works in the Claude Code terminal and in the Code tab of the Claude desktop app.

<p>
  <img src="docs/screenshots/pane.png" alt="The pane: three hosts as cards, each with its profiles and their sessions" width="400">
  <img src="docs/screenshots/session-menu.png" alt="A session's menu: open in the Claude app or on claude.ai, its tmux window, restart to update, stop, rename, move" width="400">
</p>
<p>
  <img src="docs/screenshots/tmux-window.png" alt="A session's live tmux window, waiting on Claude's folder-trust question, with keys to answer it" width="400">
</p>

<sub>Screenshots from the Claude desktop app in demo mode (`/remote-control-cli-servers demo`): the hosts, accounts and sessions are made up.</sub>

## Install

**On each Linux host:** tmux 3.0 or newer, [Claude Code](https://code.claude.com), then the server
(x86_64 or arm64) and its setup:

```sh
mkdir -p ~/.local/bin && curl -fsSL https://github.com/marcusadolfsson/remote-control-cli-servers/releases/latest/download/remote-control-conductor-server-$(uname -m)-linux -o ~/.local/bin/remote-control-conductor-server && chmod +x ~/.local/bin/remote-control-conductor-server
remote-control-conductor-server setup
```

Setup checks tmux and Claude Code, finds the Claude accounts already there, asks which networks may
connect, installs a systemd user service, and prints a pairing code.

**On your Mac,** in Claude Code (2.1.287 or later):

```sh
claude plugin marketplace add marcusadolfsson/remote-control-cli-servers
claude plugin install remote-control-cli-servers@remote-control-cli-servers
```

Then `/remote-control-cli-servers pair`, paste the code, and check the certificate fingerprint matches the one setup
printed. A new code any time: `remote-control-conductor-server pair` on the host.

If Claude Code says hooks modules are turned off, set `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` in its
environment.

## Using it

- `/remote-control-cli-servers` opens the pane. Every host, profile and session has a ⋯ menu of its actions, each
  with a letter that presses it while the menu is open.
- `/remote-control-cli-servers text` prints the same as text.
- `/remote-control-cli-servers demo` swaps in three made-up hosts, for screenshots; again to swap back.
- Ask Claude: its tools are `mcp__remote-control-cli-servers__*` (`list_profiles`, `list_sessions`, `new_session`,
  `resume_session`, `restart_outdated`, `read_window`, `send_to_window`, `move_session`, …).

## How it's secured

- The server speaks HTTPS with a self-signed certificate. Pairing records its SHA-256, and every
  request pins the server's public key, so the Mac talks to that server and no other.
- Each Mac gets its own token at pairing. It lives in the login Keychain, and is read and passed to
  `curl` by a shell, never by the plugin's code or on a command line.
- The server only types into tmux windows it opened itself, and never answers a folder-trust
  question that would also approve tool permissions.

## Repository

- `crates/server`: `remote-control-conductor-server`, the Linux server (Rust).
- `crates/core`: what the server shares with its clients: the API types, pairing codes,
  certificate pinning, reading Claude Code's transcripts.
- `plugin`: the Claude Code plugin (TypeScript, run by Claude Code).

Checks: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`,
`cargo test --workspace` (the launch tests need tmux, so they skip on a Mac);
`claude plugin validate plugin` and `claude plugin test plugin`.

A release is a tag `v<version>`, the workspace's version and the plugin's: CI builds the server for
both architectures and publishes them with checksums.

MIT licensed.
