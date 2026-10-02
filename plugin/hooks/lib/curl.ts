// The shell scripts the plugin runs, and reading what curl answered.
//
// Requests go through curl pinned to the server's public key (its
// certificate is self-signed, which `$.http.fetch` can't trust). The key's
// hash comes from the certificate whose SHA-256 the pairing recorded. Tokens
// live in the login Keychain and are only ever read by these scripts, which
// hand them to curl on stdin: never to the plugin, never on a command line.

export const KEYCHAIN_SERVICE = 'app.ai-profiles.remote-host'

/** Prints the base64 SHA-256 of the public key of the certificate at $1, if its own SHA-256 is $2. */
export const PIN_SCRIPT = `
pem=$(curl -sk --connect-timeout 4 --max-time 8 -o /dev/null -w '%{certs}' "https://$1/v1/ping" | awk '/BEGIN CERT/{p=1} p{print} /END CERT/{exit}')
[ -n "$pem" ] || { echo "no answer from $1" >&2; exit 7; }
fp=$(printf '%s\\n' "$pem" | openssl x509 -outform DER | shasum -a 256 | cut -c1-64)
[ "$fp" = "$2" ] || { echo "the certificate doesn't match the pairing" >&2; exit 90; }
printf '%s\\n' "$pem" | openssl x509 -pubkey -noout | openssl pkey -pubin -outform DER | openssl dgst -sha256 -binary | base64
`

/**
 * $1 host id (Keychain account), $2 key pin, $3 Keychain service, $4 URL,
 * $5 method, $6 JSON body (or empty), $7 seconds allowed.
 */
export const REQUEST_SCRIPT = `
token=$(security find-generic-password -s "$3" -a "$1" -w 2>/dev/null) || { echo "This Mac has no token for that host: pair it again." >&2; exit 4; }
auth() { printf 'header = "Authorization: Bearer %s"\\n' "$token"; }
if [ -n "$6" ]; then
  auth | curl -sS -k --connect-timeout 4 --max-time "$7" --pinnedpubkey "sha256//$2" -K - -H 'x-aip-client: conductor-plugin' -X "$5" -H 'Content-Type: application/json' --data-binary "$6" -w '\\n%{http_code}' "$4"
else
  auth | curl -sS -k --connect-timeout 4 --max-time "$7" --pinnedpubkey "sha256//$2" -K - -H 'x-aip-client: conductor-plugin' -X "$5" -w '\\n%{http_code}' "$4"
fi
`

/**
 * Pairs: $1 address, $2 key pin, $3 JSON body {secret, clientName}, $4
 * Keychain service, $5 host id. Keeps the token in the Keychain and prints the
 * answer without it, then the HTTP status.
 */
export const PAIR_SCRIPT = `
out=$(curl -sS -k --connect-timeout 4 --max-time 20 --pinnedpubkey "sha256//$2" -H 'x-aip-client: conductor-plugin' -X POST -H 'Content-Type: application/json' --data-binary "$3" -w '\\n%{http_code}' "https://$1/v1/pair") || exit $?
status=$(printf '%s' "$out" | tail -n 1)
body=$(printf '%s' "$out" | sed '$d')
if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
  token=$(printf '%s' "$body" | jq -r .token)
  [ -n "$token" ] && [ "$token" != null ] || { echo "The host answered without a token." >&2; exit 5; }
  printf 'add-generic-password -U -s %s -a %s -w %s\\n' "$4" "$5" "$token" | security -i >/dev/null 2>&1 || { echo "The token couldn't be kept in the Keychain." >&2; exit 6; }
  body=$(printf '%s' "$body" | jq -c 'del(.token)')
fi
printf '%s\\n%s' "$body" "$status"
`

/** Deletes the token of host $1 (service $2), if there is one. */
export const FORGET_TOKEN_SCRIPT = `security delete-generic-password -s "$2" -a "$1" >/dev/null 2>&1; exit 0`

/** curl's exit codes for "couldn't connect": nothing was sent, so the next address is safe. */
const NOT_CONNECTED = new Set([6, 7])

/** curl's exit codes for a connection that broke or timed out after sending. */
const BROKE = new Set([28, 35, 52, 56])

/** A failure the server or the transport reported, with its code. */
export class RemoteError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/** What a run of a request script came to. */
export type CurlRun = { exitCode: number; stdout: string; stderr: string }

/** Splits curl's output, the body then `\n<status>` from `-w`. */
export function splitStatus(stdout: string): { status: number; body: string } {
  const cut = stdout.lastIndexOf('\n')
  return {
    status: Number(stdout.slice(cut + 1)) || 0,
    body: cut < 0 ? '' : stdout.slice(0, cut),
  }
}

/** The server's `{ error: { code, message } }`, or the start of whatever else it said. */
export function serverError(status: number, body: string): RemoteError {
  try {
    const error = (JSON.parse(body) as { error?: { code?: string; message?: string } }).error
    if (error?.message) return new RemoteError(error.code ?? 'error', error.message)
  } catch {
    // Not JSON: fall through to the raw text.
  }
  return new RemoteError(`http_${status}`, `HTTP ${status}${body ? ` ${body.slice(0, 120)}` : ''}`)
}

/**
 * The JSON a request answered, or `null` when the next address should be
 * tried: one that couldn't be reached, or (for a read, safe to repeat) one
 * that broke off. Throws what went wrong otherwise.
 */
export function readCurl(run: CurlRun, isRead: boolean): unknown | null {
  if (NOT_CONNECTED.has(run.exitCode)) return null
  if (BROKE.has(run.exitCode)) {
    if (isRead) return null
    throw new RemoteError(
      run.exitCode === 28 ? 'timeout' : 'no_answer',
      run.exitCode === 28 ? 'The host took too long to answer.' : 'The host stopped answering partway.',
    )
  }
  if (run.exitCode === 90) throw new RemoteError('cert_mismatch', "The host's certificate doesn't match the pairing.")
  if (run.exitCode !== 0) {
    throw new RemoteError('client', run.stderr.trim().split('\n').pop() || `curl failed (${run.exitCode})`)
  }
  const { status, body } = splitStatus(run.stdout)
  if (status < 200 || status >= 300) throw serverError(status, body)
  if (!body) return {}
  try {
    return JSON.parse(body)
  } catch {
    throw new RemoteError('bad_response', "The host answered with something that isn't JSON.")
  }
}

/** The message of anything thrown. */
export function errorText(err: unknown, fallback = 'Something went wrong.'): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/** The code of a RemoteError, or `null`. */
export function errorCode(err: unknown): string | null {
  return err instanceof RemoteError ? err.code : null
}
