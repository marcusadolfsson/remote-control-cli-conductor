// Naming things from a tool call: "host/account" and sessions by id, id prefix or title.

import type { RemoteSession } from './wire'

import { sessionTitle } from './format'

/** `atlas/Misc` as its two parts, or why it isn't one. */
export function splitProfile(ref: string): { host: string; account: string } | { error: string } {
  const cut = ref.indexOf('/')
  if (cut <= 0 || cut === ref.length - 1) return { error: `"${ref}" names no account: write it as host/account.` }
  return { host: ref.slice(0, cut).trim(), account: ref.slice(cut + 1).trim() }
}

/** A session by its exact id, a unique id prefix of 8+ characters, or a unique title; or why not. */
export function findSession<S extends Pick<RemoteSession, 'id' | 'title' | 'lastPrompt'>>(
  sessions: ReadonlyArray<S>,
  ref: string,
): S | { error: string } {
  const wanted = ref.trim()
  if (!wanted) return { error: 'Name a session: its id or its title.' }
  const exact = sessions.find((s) => s.id === wanted)
  if (exact) return exact
  if (wanted.length >= 8) {
    const prefixed = sessions.filter((s) => s.id.startsWith(wanted.toLowerCase()))
    if (prefixed.length === 1 && prefixed[0]) return prefixed[0]
  }
  const titled = sessions.filter((s) => sessionTitle(s).toLowerCase() === wanted.toLowerCase())
  if (titled.length === 1 && titled[0]) return titled[0]
  if (titled.length > 1) {
    return {
      error: `More than one session is called "${ref}": use its id (${titled.map((s) => s.id.slice(0, 8)).join(', ')}).`,
    }
  }
  const listed = sessions.slice(0, 15).map((s) => sessionTitle(s))
  return { error: `No session is called "${ref}". Sessions here: ${listed.length ? listed.join(', ') : 'none'}.` }
}

/** A name without a `{ error }` in it. */
export function isFound<T extends object>(value: T | { error: string }): value is T {
  return !('error' in value)
}
