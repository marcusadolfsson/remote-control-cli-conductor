#!/bin/sh
# Checks a host's certificate and prints the hash to pin its public key to.
#
#   pin.sh <address> <fingerprint>
#
# Fetches the self-signed certificate the server at <address> presents, checks
# that its SHA-256 is the <fingerprint> the pairing code carried, and prints the
# base64 SHA-256 of its public key, which every later request is pinned to.
# Sends nothing but a GET of /v1/ping, which needs no token.
pem=$(curl -sk --connect-timeout 4 --max-time 8 -o /dev/null -w '%{certs}' "https://$1/v1/ping" | awk '/BEGIN CERT/{p=1} p{print} /END CERT/{exit}')
[ -n "$pem" ] || { echo "no answer from $1" >&2; exit 7; }
fp=$(printf '%s\n' "$pem" | openssl x509 -outform DER | shasum -a 256 | cut -c1-64)
[ "$fp" = "$2" ] || { echo "the certificate doesn't match the pairing" >&2; exit 90; }
printf '%s\n' "$pem" | openssl x509 -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | base64
