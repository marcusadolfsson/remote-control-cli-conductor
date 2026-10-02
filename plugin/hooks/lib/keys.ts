// The keys the session window's buttons send (tmux names the server accepts).

import type { WindowKey } from './wire'

export const WINDOW_KEYS: ReadonlyArray<{ label: string; key: string; hotkey: string }> = [
  { label: '↑', key: 'Up', hotkey: 'k' },
  { label: '↓', key: 'Down', hotkey: 'j' },
  { label: '⏎ Enter', key: 'Enter', hotkey: 'e' },
  { label: 'Esc', key: 'Escape', hotkey: 'x' },
  { label: 'Tab', key: 'Tab', hotkey: 't' },
  { label: '⌃C', key: 'C-c', hotkey: 'c' },
]

/** Typed text, then Enter when asked: the keys to send. */
export function textKeys(text: string, withEnter: boolean): Array<WindowKey> {
  const keys: Array<WindowKey> = text ? [{ text }] : []
  return withEnter ? [...keys, { key: 'Enter' }] : keys
}

/** A window's screen with trailing blank space trimmed. */
export function trimScreen(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n+$/, '')
}

/** A key as the window's `Client` hands it over (`surface.onKey`). */
export type TypedKey = { key: string; ctrl?: true; shift?: true; meta?: true }

const NAMED: Record<string, string> = {
  return: 'Enter',
  enter: 'Enter',
  tab: 'Tab',
  backspace: 'BSpace',
  delete: 'BSpace',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  space: 'Space',
}

/** What a typed key sends to tmux, or `null` for one the server won't take (⌘ anything, most ⌃ keys). */
export function windowKeyFor(typed: TypedKey): WindowKey | null {
  if (typed.meta) return null
  if (typed.ctrl) {
    const letter = typed.key.toLowerCase()
    return letter === 'c' || letter === 'd' ? { key: `C-${letter}` } : null
  }
  if (typed.key === 'tab' && typed.shift) return { key: 'BTab' }
  const named = NAMED[typed.key.toLowerCase()]
  if (named) return { key: named }
  if (typed.key === ' ') return { key: 'Space' }
  return [...typed.key].length === 1 && !/\p{Cc}/u.test(typed.key) ? { text: typed.key } : null
}

/** Runs of typed characters as one piece of text: fewer, larger sends. At most 50 keys, as the server takes. */
export function mergeKeys(keys: ReadonlyArray<WindowKey>): Array<WindowKey> {
  const out: Array<WindowKey> = []
  for (const key of keys) {
    const last = out[out.length - 1]
    if ('text' in key && last && 'text' in last && last.text.length + key.text.length <= 2000) {
      out[out.length - 1] = { text: last.text + key.text }
    } else {
      out.push(key)
    }
  }
  return out.slice(0, 50)
}
