// The band above the prompt: one line about the hosts, and a button. Its
// digit hotkey works from an empty prompt, so `1` opens the pane, or the one
// session waiting for you, without clicking into the band first.

import type { BandModel } from '../lib/band'
import type { Ui } from './act'

import { bandDetail, bandParts } from '../lib/band'
import { Icon } from './icons'

export type BandAct = {
  open: () => void
  answer: (only: NonNullable<BandModel['only']>) => void
}

/**
 * The band's line.
 * @param ui The surface's elements.
 * @param model What the hosts come to (lib/band.ts).
 * @param columns The band's width, so the line says only what fits.
 * @param act Opening the pane, or the waiting session's window.
 */
export function Band(ui: Ui, model: BandModel, columns: number, act: BandAct) {
  const { Box, Button, Text } = ui
  const parts = bandParts(model, bandDetail(model, columns))
  const only = model.only
  return (
    <Box key="rccs-band" flexDirection="row" alignItems="center" columnGap={1} width="100%">
      <Box flexShrink={0}>{Icon(ui, 'host', model.waiting ? 'warning' : model.offline ? 'error' : 'success')}</Box>
      <Box flexDirection="row" flexGrow={1} minWidth={0} overflow="hidden">
        {parts.map((part, i) =>
          part.tone ? (
            <Text key={`p${i}`} color={part.tone} bold={part.isBold === true} wrap="truncate-end">
              {part.text}
            </Text>
          ) : (
            <Text key={`p${i}`} bold={part.isBold === true} wrap="truncate-end">
              {part.text}
            </Text>
          ),
        )}
      </Box>
      <Box flexShrink={0}>
        {only ? (
          <Button key="rccs-band-answer" plain hotkey="1" label="Answer" onPress={() => act.answer(only)} />
        ) : (
          <Button key="rccs-band-open" plain dimColor hotkey="1" label="Open" onPress={act.open} />
        )}
      </Box>
    </Box>
  )
}
