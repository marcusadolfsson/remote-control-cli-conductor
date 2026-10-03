// The session window's live screen, as a region you click and type into: every
// key goes to the tmux window as you press it. A surface module: it runs on
// the drawing thread, without `$`, and posts the keys to the hooks module,
// which sends them and hands back the new screen.
//
// Keys are numbered and posted until the hooks module confirms them (`ack`):
// a post in the same frame replaces the last undelivered one, so each post
// carries every key not yet confirmed, and the hooks module skips repeats.

import type { ClientModule, ClientSurface } from 'claude-code'
import type { WindowKey } from './lib/wire'

import { type TypedKey, windowKeyFor } from './lib/keys'

/** What the dialog hands the region. */
export type TerminalProps = { text: string; ack: number; isGone: boolean }

type Pending = { seq: number; key: WindowKey }
type TerminalState = { seq: number; pending: Array<Pending>; isTyping: boolean }

/** Each instance's latest props: the key listener, set up once, reads them here. */
const latest = new WeakMap<object, TerminalProps>()

const Terminal: ClientModule<TerminalProps, TerminalState> = (props, surface: ClientSurface<TerminalState>) => {
  const { Box, Code, Text } = surface.elements
  latest.set(surface, props)
  if (surface.state === undefined) {
    surface.setState({ seq: props.ack, pending: [], isTyping: false })
    surface.onKey((typed: TypedKey) => {
      const key = windowKeyFor(typed)
      const state = surface.state
      const now = latest.get(surface)
      if (!key || !state || !now || now.isGone) return
      const ack = now.ack
      const seq = state.seq + 1
      const pending = [...state.pending.filter((p) => p.seq > ack), { seq, key }]
      surface.setState({ seq, pending, isTyping: true })
      surface.post({ keys: pending })
    })
  }
  const isTyping = surface.state?.isTyping ?? false
  return (
    <Box flexDirection="column">
      {props.isGone ? (
        <Text dimColor>The tmux window has closed.</Text>
      ) : (
        <Code source={props.text || ' '} language="text" />
      )}
      <Text color={isTyping ? 'success' : 'inactive'}>
        {props.isGone
          ? ''
          : isTyping
            ? '● typing into the window · Esc leaves it'
            : '○ click here and type: keys go straight to the window'}
      </Text>
    </Box>
  )
}

export default Terminal
