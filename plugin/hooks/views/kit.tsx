// The parts every dialog is built from, so they read as one family with the
// main pane: an icon header with its context, titled sections in rounded
// frames, quiet hints, one error box, and a foot with the main action first.

import type { Ui } from './act'

import { Icon, type IconName, type IconTone } from './icons'

/** The dialog's head: what it acts on, as the main pane shows it, and where. */
export function Head(ui: Ui, icon: IconName, tone: IconTone, title: string, context?: string) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1} alignItems="center">
        {Icon(ui, icon, tone, 16)}
        <Text bold>{title}</Text>
      </Box>
      {context && <Text dimColor>{context}</Text>}
    </Box>
  )
}

/** A titled group of fields or facts, framed like a host card. */
export function Section(ui: Ui, title: string, children: unknown, accent = 'promptBorder') {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={accent} paddingX={1} marginBottom={1}>
      <Text bold color={accent === 'promptBorder' ? undefined : accent}>
        {title}
      </Text>
      {children as never}
    </Box>
  )
}

/** A quiet line under a field: what it does, or what's wrong with it. */
export function Hint(ui: Ui, text: string, isProblem = false) {
  const { Text } = ui
  return (
    <Text color={isProblem ? 'error' : undefined} dimColor={!isProblem} wrap="wrap">
      {text}
    </Text>
  )
}

/** What went wrong, in the same box the main pane's notes use. */
export function ErrorBox(ui: Ui, error: string | null) {
  const { Box, Text } = ui
  if (!error) return null
  return (
    <Box borderStyle="round" borderColor="error" paddingX={1} gap={1} marginBottom={1}>
      <Text color="error" bold>
        ✗
      </Text>
      <Text wrap="wrap">{error}</Text>
    </Box>
  )
}

/** A line of facts, `label  value`, in two columns. */
export function Fact(ui: Ui, label: string, value: string, tone?: string) {
  const { Box, Text } = ui
  return (
    <Box gap={1}>
      <Box width={14}>
        <Text dimColor>{label}</Text>
      </Box>
      <Text color={tone} wrap="truncate-end">
        {value}
      </Text>
    </Box>
  )
}

/** A checkbox: a plain button that toggles. */
export function Check(ui: Ui, key: string, label: string, isOn: boolean, onPress: () => void) {
  const { Button } = ui
  return <Button key={key} plain label={`${isOn ? '☑' : '☐'} ${label}`} onPress={onPress} />
}

export type FootAction = { label: string; isEnabled: boolean; isBusy: boolean; onPress: () => void }

/** The foot: the main action (dim until it can run), Cancel, and anything set apart on the right. */
export function Foot(ui: Ui, main: FootAction | null, cancel: { label: string; onPress: () => void }, aside?: unknown) {
  const { Box, Button, Text } = ui
  return (
    <Box justifyContent="space-between" alignItems="center" marginTop={1}>
      <Box gap={1} alignItems="center">
        {main &&
          (main.isBusy ? (
            <Text color="claude">◐ {main.label}…</Text>
          ) : (
            <Button
              key="submit"
              variant={main.isEnabled ? 'primary' : undefined}
              dimColor={!main.isEnabled}
              label={main.label}
              onPress={() => main.isEnabled && main.onPress()}
            />
          ))}
        <Button key="cancel" label={cancel.label} onPress={cancel.onPress} />
      </Box>
      {(aside ?? null) as never}
    </Box>
  )
}
