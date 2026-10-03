#!/bin/sh
# One request to a paired host.
#
#   request.sh <host id> <key pin> <url> <method> <json body or ""> <seconds>
#
# Reads the token the host issued at pairing from the login Keychain (service
# app.ai-profiles.remote-host, account <host id>) and hands it to curl on stdin,
# so it never appears on a command line or reaches the plugin. The request goes
# only to <url>, a paired host's address, over HTTPS pinned to <key pin>. Prints
# the answer, then the HTTP status on a line of its own.
token=$(security find-generic-password -s app.ai-profiles.remote-host -a "$1" -w 2>/dev/null) || { echo "This Mac has no token for that host: pair it again." >&2; exit 4; }
auth() { printf 'header = "Authorization: Bearer %s"\n' "$token"; }
if [ -n "$5" ]; then
  auth | curl -sS -k --connect-timeout 4 --max-time "$6" --pinnedpubkey "sha256//$2" -K - -H 'x-aip-client: conductor-plugin' -X "$4" -H 'Content-Type: application/json' --data-binary "$5" -w '\n%{http_code}' "$3"
else
  auth | curl -sS -k --connect-timeout 4 --max-time "$6" --pinnedpubkey "sha256//$2" -K - -H 'x-aip-client: conductor-plugin' -X "$4" -w '\n%{http_code}' "$3"
fi
