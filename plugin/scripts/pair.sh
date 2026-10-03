#!/bin/sh
# Pairs with a host.
#
#   pair.sh <address> <key pin> <json body> <host id>
#
# Sends the pairing code's one-time secret and this Mac's name (the JSON body)
# to the host at <address>, over HTTPS pinned to <key pin>. The host answers
# with a token, which goes straight into the login Keychain (service
# app.ai-profiles.remote-host, account <host id>). Prints the answer without the
# token, then the HTTP status on a line of its own.
out=$(curl -sS -k --connect-timeout 4 --max-time 20 --pinnedpubkey "sha256//$2" -H 'x-aip-client: conductor-plugin' -X POST -H 'Content-Type: application/json' --data-binary "$3" -w '\n%{http_code}' "https://$1/v1/pair") || exit $?
status=$(printf '%s' "$out" | tail -n 1)
body=$(printf '%s' "$out" | sed '$d')
if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
  token=$(printf '%s' "$body" | jq -r .token)
  [ -n "$token" ] && [ "$token" != null ] || { echo "The host answered without a token." >&2; exit 5; }
  printf 'add-generic-password -U -s app.ai-profiles.remote-host -a %s -w %s\n' "$4" "$token" | security -i >/dev/null 2>&1 || { echo "The token couldn't be kept in the Keychain." >&2; exit 6; }
  body=$(printf '%s' "$body" | jq -c 'del(.token)')
fi
printf '%s\n%s' "$body" "$status"
