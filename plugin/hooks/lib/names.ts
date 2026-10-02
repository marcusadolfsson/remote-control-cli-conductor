// What the server accepts as names.

/** An account (profile) name the server will create: a letter or digit, then letters, digits, - and _. */
export function isValidAccountName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name) && name.toLowerCase() !== 'default'
}

/** The line under an account name field, and whether it's a problem. */
export function accountNameHint(
  name: string,
  hostLabel: string,
  taken: ReadonlyArray<string>,
): { text: string; problem: boolean } {
  const trimmed = name.trim()
  if (!trimmed) return { text: ' ', problem: false }
  if (!isValidAccountName(trimmed)) {
    return { text: 'Letters, digits, - and _, starting with a letter or digit. "default" is taken.', problem: true }
  }
  if (taken.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
    return { text: `${hostLabel} already has a profile called ${trimmed}.`, problem: true }
  }
  return { text: `On ${hostLabel}: ~/.claude-accounts/${trimmed}`, problem: false }
}

/** A session name the server takes: 1–100 characters, no control characters, not starting with -. */
export function isValidSessionName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 0 && trimmed.length <= 100 && !trimmed.startsWith('-') && !/\p{Cc}/u.test(trimmed)
}

/** A Remote Control name suffix the server takes: up to 40 characters, no ( or ). */
export function suffixProblem(suffix: string): string | null {
  const trimmed = suffix.trim()
  if (trimmed.length > 40) return 'At most 40 characters.'
  if (/[()]/.test(trimmed)) return 'No brackets: they are added around it.'
  if (/\p{Cc}/u.test(trimmed)) return 'No control characters.'
  return null
}
