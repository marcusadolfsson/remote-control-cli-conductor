// Pairing codes: `aip1.` + base64url (no padding) of
// {"v":1,"hosts":["100.x.y.z:7443",…],"secret":"…","fp":"<64 hex>"}.

export type PairingCode = { hosts: Array<string>; secret: string; fingerprint: string }

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** base64url (padding optional) to text, or `null` when it isn't base64url. */
export function decodeBase64Url(text: string): string | null {
  const clean = text.replace(/=+$/, '')
  let bits = 0
  let value = 0
  const bytes: Array<number> = []
  for (const char of clean) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) return null
    value = (value << 6) | index
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }
  const decoded = new TextDecoder().decode(new Uint8Array(bytes))
  return decoded.includes('\uFFFD') ? null : decoded
}

/** What a pasted code holds, or why it isn't one. */
export function decodePairingCode(text: string): PairingCode | { error: string } {
  const compact = text.replace(/\s+/g, '')
  if (!compact) return { error: '' }
  if (!compact.startsWith('aip1.')) return { error: "That isn't a pairing code: it starts with aip1." }
  const json = decodeBase64Url(compact.slice(5))
  if (json === null) return { error: 'That pairing code is damaged: copy it again.' }
  try {
    const body = JSON.parse(json) as { v?: unknown; hosts?: unknown; secret?: unknown; fp?: unknown }
    const hosts = Array.isArray(body.hosts) ? body.hosts.filter((h) => typeof h === 'string') : []
    const isValid =
      body.v === 1 &&
      hosts.length > 0 &&
      typeof body.secret === 'string' &&
      body.secret.length > 0 &&
      typeof body.fp === 'string' &&
      /^[0-9a-f]{64}$/.test(body.fp)
    if (!isValid) return { error: 'That pairing code is damaged: copy it again.' }
    return { hosts, secret: body.secret as string, fingerprint: body.fp as string }
  } catch {
    return { error: 'That pairing code is damaged: copy it again.' }
  }
}

/** A fingerprint as the server prints it: `AB:CD:…`. */
export function formatFingerprint(hex: string): string {
  return (hex.toUpperCase().match(/../g) ?? []).join(':')
}
