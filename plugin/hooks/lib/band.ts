// The band above the prompt: what it says about the hosts, and how much of
// it fits. Pure, so the tests can hold it to every width.

import type { ConductorHost, ConductorTarget } from '../../types'

import { sessionTitle } from './format'

export type BandHost = { id: string; label: string; running: number; waiting: number; isOffline: boolean }

export type BandModel = {
  hosts: Array<BandHost>
  waiting: number
  offline: number
  /** The one session waiting for you, when there's exactly one: the band's button opens its window. */
  only: { target: ConductorTarget; windowId: string } | null
}

/** How much the band says: every host with its counts, host names with a mark, or just the totals. */
export type BandDetail = 'full' | 'names' | 'totals'

export type BandTone = 'warning' | 'success' | 'error' | 'inactive'

/** One run of text in the band, and how it's drawn. */
export type BandPart = { text: string; tone?: BandTone; isBold?: boolean }

/** Room the band's button takes ("1: Open" and a gap), so the text stops short of it. */
const BUTTON_COLUMNS = 12

export function bandModel(hosts: ReadonlyArray<ConductorHost>): BandModel {
  const rows = hosts.map((host) => {
    const sessions = host.accounts.flatMap((a) => a.sessions.map((s) => ({ account: a.account.name, session: s })))
    const running = sessions.filter(({ session }) => session.running)
    return {
      host,
      running,
      waiting: running.filter(({ session }) => session.waiting),
    }
  })
  const waiting = rows.flatMap((row) => row.waiting.map((w) => ({ host: row.host, ...w })))
  const one = waiting.length === 1 ? waiting[0] : undefined
  const windowId = one?.session.window?.windowId
  return {
    hosts: rows.map((row) => ({
      id: row.host.id,
      label: row.host.label.toUpperCase(),
      running: row.running.length,
      waiting: row.waiting.length,
      isOffline: Boolean(row.host.error),
    })),
    waiting: waiting.length,
    offline: rows.filter((row) => row.host.error).length,
    only:
      one && windowId
        ? {
            target: {
              hostId: one.host.id,
              account: one.account,
              sessionId: one.session.id,
              title: sessionTitle(one.session),
            },
            windowId,
          }
        : null,
  }
}

const SEPARATOR: BandPart = { text: ' · ', tone: 'inactive' }

function hostParts(host: BandHost, detail: BandDetail): Array<BandPart> {
  const name: BandPart = { text: host.label, isBold: true }
  if (detail === 'names') {
    const mark: BandPart = host.isOffline
      ? { text: '○', tone: 'error' }
      : host.waiting
        ? { text: '◐', tone: 'warning' }
        : { text: '●', tone: host.running ? 'success' : 'inactive' }
    return [name, { text: ' ' }, mark]
  }
  if (host.isOffline) return [name, { text: ' ' }, { text: 'offline', tone: 'error' }]
  return [
    name,
    { text: ' ' },
    { text: `● ${host.running}`, tone: host.running ? 'success' : 'inactive' },
    ...(host.waiting ? [{ text: ` ◐ ${host.waiting}`, tone: 'warning' as const }] : []),
  ]
}

function joined(groups: Array<Array<BandPart>>): Array<BandPart> {
  return groups.flatMap((group, i) => (i === 0 ? group : [SEPARATOR, ...group]))
}

/** The band's text at a level of detail, as runs to draw. */
export function bandParts(model: BandModel, detail: BandDetail): Array<BandPart> {
  const waiting: Array<BandPart> = model.waiting
    ? [{ text: `${model.waiting} waiting`, tone: 'warning', isBold: true }]
    : []
  if (detail === 'totals') {
    const offline: Array<BandPart> = model.offline ? [{ text: `${model.offline} offline`, tone: 'error' }] : []
    const quiet: Array<BandPart> =
      waiting.length || offline.length
        ? []
        : [{ text: `${model.hosts.length} ${model.hosts.length === 1 ? 'host' : 'hosts'}, nothing waiting` }]
    return joined([waiting, offline, quiet].filter((group) => group.length > 0))
  }
  return joined([waiting, ...model.hosts.map((host) => hostParts(host, detail))].filter((group) => group.length > 0))
}

const width = (parts: Array<BandPart>) => parts.reduce((sum, part) => sum + [...part.text].length, 0)

/** The most the band can say in `columns`, with room for its icon and button. */
export function bandDetail(model: BandModel, columns: number): BandDetail {
  const room = columns - BUTTON_COLUMNS - 2
  if (width(bandParts(model, 'full')) <= room) return 'full'
  if (width(bandParts(model, 'names')) <= room) return 'names'
  return 'totals'
}
