# Privacy policy

Remote Control CLI Servers is a Claude Code plugin and a server you run on your own Linux machines.
Its author runs no service for it. **Nothing it handles reaches the author, Anthropic or anyone
else:** it has no analytics, telemetry, crash reporting or accounts of its own.

## On your Mac (the plugin)

- **What it keeps:** in its own store under `~/.claude`, each host you paired: its name, network
  addresses, certificate fingerprint and public-key hash. Each host's access token is kept in your
  macOS login Keychain.
- **What it reads:**
  - the host list of the Remote Control Conductor Mac app, if that app is installed;
  - your Mac's name, which it sends to a host when you pair;
  - the calls Claude makes to the plugin's own tools.
- **What it shows:** what your hosts send back while the pane is open: the names and email
  addresses of the Claude accounts signed in there, their plan, and their sessions' titles, folders
  and tmux windows. The plugin keeps these in memory and doesn't store them.

## On your hosts (the server)

Each host keeps, in its own folders:
- the clients paired with it (a name, and only the SHA-256 of each token);
- its settings;
- the record of the sessions it started.

Claude Code's own files there (accounts, transcripts, memory) stay where Claude Code keeps them; the
server reads and moves them only when you ask.

## Where data goes

Only between your Mac and your own hosts, directly, over HTTPS pinned to each host's key. The
sessions themselves talk to Anthropic as any Claude Code session does, under the accounts signed in
on each host and Anthropic's own terms and privacy policy. Opening a session on claude.ai or in the
Claude app, or a sign-in page, happens in your browser or the app.

## Retention

The author receives nothing, so nothing is retained by the author. What's on your Mac and your hosts
stays until you remove it:
- removing a host in the plugin deletes its entry and its Keychain token;
- `remote-control-conductor-server revoke` on a host forgets a client;
- deleting the server's folders removes the rest.

## Contact

Questions: [GitHub issues](https://github.com/marcusadolfsson/remote-control-cli-servers/issues).
