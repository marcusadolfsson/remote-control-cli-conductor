// The words of the dialogs, kept as the Mac app has them.

import type { LaunchResult, TransferReport, WindowScreen } from './wire'

import { count } from './format'

/** A launch's heading. */
export function launchTitle(launch: LaunchResult): string {
  const waiting = launch.attention !== null
  if (waiting) return launch.alreadyRunning ? 'Waiting for you' : 'Started, and waiting'
  return launch.alreadyRunning ? 'Already running' : 'Session started'
}

/** What a launch window says above the screen, until Claude is up. */
export function launchNote(launch: LaunchResult, screen: WindowScreen | null): string {
  if (screen?.sessionId) {
    return screen.remoteControl
      ? "Claude is running, with Remote Control connected: it's in the Claude app on your other devices."
      : 'Claude is running. Remote Control is connecting…'
  }
  switch (launch.attention?.kind) {
    case 'trustPermissions':
      return "Claude is asking whether to trust the folder, and trusting it would also allow what the folder's settings pre-approve, so it wasn't answered for you. If that's fine, choose \"Yes, I trust this folder\" below (↓, then ⏎). Remote Control connects then."
    case 'trustPrompt':
      return 'Claude is asking whether to trust the folder. Answer it below (↓ then ⏎ trusts it); Remote Control connects then.'
    case 'waiting':
      return "Claude hasn't finished starting. Here's its window: answer whatever it's asking."
    default:
      if (launch.alreadyRunning) return 'It was open there already, so nothing new was started.'
      return launch.remoteControlName
        ? `Remote Control is on as "${launch.remoteControlName}", so it's in the Claude app on your other devices.`
        : "Remote Control is on, named after its folder, so it's in the Claude app on your other devices."
  }
}

/** The line a move ends with. */
export function movedDetails(report: TransferReport, from: string): string {
  const parts = [
    report.launch ? `Resumed in tmux window ${report.launch.window.windowId}.` : null,
    report.freedBytes != null && !report.archivedTo ? `Deleted the copy in ${from}.` : null,
    report.memory.length ? `Project memory: ${count(report.memory.length, 'note')} brought over.` : null,
  ]
  return parts.filter(Boolean).join(' ')
}

/** What stopping says, for a session with or without a conversation yet. */
export function stopBody(isEmpty: boolean): string {
  return isEmpty
    ? "Claude ends. Nothing has been said in it yet, so there's nothing to resume: it leaves the list."
    : 'Claude ends, and anything it is in the middle of stops with it. The conversation is kept: resume it later.'
}

export const ARCHIVE_BODY =
  "Its transcript moves to session-transfer-backups, so it's no longer listed, here or in Claude's own /resume. Restore it from Archived."

/** What signing out says, with sessions running or not. */
export function signOutBody(running: number): string {
  const stops =
    running > 0
      ? `${running === 1 ? '1 session is' : `${running} sessions are`} running. ${running === 1 ? 'It stops' : 'They stop'} first: signed out, ${running === 1 ? 'it' : 'they'} would fail as soon as the token renews. `
      : ''
  return `${stops}Its sessions are kept. Sign in again to use them.`
}

/** What switching account does to the running sessions. */
export function switchEffect(running: number): string {
  const lead =
    running > 0
      ? `Its ${count(running, 'session')} ${running === 1 ? 'stops' : 'stop'}, and ${running === 1 ? 'resumes' : 'resume'} under the new account as soon as it's signed in: the same conversations, with Remote Control on. `
      : ''
  return `${lead}Nothing moves, and no other profile is touched.`
}
