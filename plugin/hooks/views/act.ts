// What the views can ask for. register.tsx builds it, with `$` in its closures.

import type { Elements } from 'claude-code'
import type {
  ArchivedSession,
  ConductorConfirmAction,
  ConductorDialog,
  ConductorSelection,
  ConductorTarget,
} from '../../types'

/** The elements a view draws with: the surface's table. */
export type Ui = Elements['terminal'] | Elements['desktop']

export type Act = {
  refresh: () => void
  select: (selection: ConductorSelection | null) => void
  toggleArchived: (hostId: string, account: string) => void
  toggleShowAll: (hostId: string, account: string) => void
  dismissNote: () => void
  /** Opens a row's ⋯ menu by its key, or closes the open one. */
  toggleMenu: (key: string | null) => void

  resume: (target: ConductorTarget) => void
  restart: (target: ConductorTarget) => void
  openClaude: (target: ConductorTarget, bridgeSessionId: string) => void
  openClaudeApp: (target: ConductorTarget, bridgeSessionId: string) => void
  openWindow: (target: ConductorTarget, windowId: string) => void
  restore: (hostId: string, account: string, archived: ArchivedSession) => void
  confirm: (action: ConductorConfirmAction) => void

  openDialog: (dialog: ConductorDialog) => void
  openNewSession: (hostId: string, account: string) => void
  openSignIn: (hostId: string, account: string, isSwitch: boolean) => void
  openMove: (target: ConductorTarget) => void
}

/** What the dialog views can ask for. */
export type DialogAct = {
  close: () => void
  patch: (patch: Record<string, unknown>) => void
  submit: () => void
  /** Pair, host settings: remove the host. */
  removeHost: (hostId: string) => void
  /** New session: go into a folder, or up. */
  browse: (path: string | null) => void
  /** Sign in: start (again), or open the page again. */
  startSignIn: () => void
  openUrl: (url: string) => void
  /** Move: pick a destination, merge a memory note. */
  moveTo: (account: string) => void
  merge: (path: string) => void
  /** Window: send keys, copy the attach command, open it in Terminal. */
  sendKeys: (keys: Array<{ key: string } | { text: string }>) => void
  copyAttach: () => void
  openTerminal: () => void
  /** Switch account: sign out instead, without signing in again. */
  signOut: () => void
}
