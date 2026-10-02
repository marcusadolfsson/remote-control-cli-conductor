# conductor: Remote Control CLI Conductor's Claude Code plugin

The Claude Code side of Remote Control CLI Conductor: your Linux hosts' Claude Code accounts and
sessions, in a pane beside the conversation (the terminal or the Desktop app's Code tab). Pair hosts,
see their profiles and sessions, start, resume, restart, stop, rename, move, archive and restore
sessions, answer what a session is asking in its tmux window, sign profiles in and out or over to
another account. Claude gets the same as tools.

- `/conductor` opens the pane: every host as a card, its profiles and their sessions. Click a host, a
  profile or a session for its actions; the pane refreshes itself every 15 s (every 3 s while a
  session's Remote Control connects).
- `/conductor pair` opens the pane and the pairing dialog.
- `/conductor text` answers as text, for `claude -p` and wherever panes don't draw.
- Tools for Claude, as `mcp__conductor__<name>`: `list_profiles`, `list_sessions`, `host_info`,
  `list_folders`, `new_session`, `resume_session`, `restart_session`, `restart_outdated`,
  `stop_session`, `rename_session`, `read_window`, `send_to_window`, `open_in_claude`, `sign_in`,
  `switch_account`, `finish_sign_in`, `plan_move`, `move_session`, `archive_session`,
  `restore_session`, `delete_archive`.

It's a mod: it needs Claude Code 2.1.287 or later (the Desktop app's own 2.1.286 loads it too).

## How it reaches the hosts

- **Pairing:** run `remote-control-conductor-server pair` on the host and paste the code. The
  plugin keeps its hosts in its own store (no secrets). Hosts paired by the Mac app carry over: it
  reads the app's `remote-hosts.json`, and the two share the tokens in the login Keychain
  (service `app.ai-profiles.remote-host`).
- **Trust:** the servers have self-signed certificates. Each request goes through `curl` pinned
  to the server's public key, whose hash is taken once from the certificate the pairing recorded
  (its SHA-256) and kept in the plugin's store.
- **Tokens:** read from the Keychain by a shell and handed to `curl` on stdin, so a token never
  enters the plugin's code or a command line. Pairing stores the new token the same way.
- It needs only what macOS ships: `curl`, `openssl`, `shasum`, `security`, `jq`.

## Install

```sh
claude plugin marketplace add marcusadolfsson/remote-control-cli-conductor
claude plugin install conductor@remote-control-cli-conductor
```

Or load it from a checkout for one session:

```sh
claude --plugin-dir plugin
```

If Claude Code says hooks modules are turned off for installed plugins, set
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` in its environment.

## Develop

- `claude plugin validate plugin`: what it hooks and calls, and anything the engine
  would refuse.
- `claude plugin test plugin`: the helpers' unit tests, and the panes and dialogs
  against a fake host on the terminal and the desktop.
- Everything that calls `$` is in `hooks/register.tsx` (the engine reads the calls off its
  source); the views are in `hooks/views/`, the pure helpers in `hooks/lib/`.
