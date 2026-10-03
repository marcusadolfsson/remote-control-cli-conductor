#!/bin/sh
# Deletes a host's token from the login Keychain, when the host is removed.
#
#   forget-token.sh <host id>
security delete-generic-password -s app.ai-profiles.remote-host -a "$1" >/dev/null 2>&1
exit 0
