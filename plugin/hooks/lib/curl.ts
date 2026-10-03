// Reading what curl answered, in the plugin's scripts (../../scripts).
//
// Requests go through curl pinned to the server's public key (its
// certificate is self-signed, which `$.http.fetch` can't trust). The key's
// hash comes from the certificate whose SHA-256 the pairing recorded. Tokens
// live in the login Keychain and are only ever read by those scripts, which
// hand them to curl on stdin: never to the plugin, never on a command line.

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
