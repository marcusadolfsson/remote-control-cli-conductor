// The paired hosts: the plugin keeps its own list (no tokens) and takes in
// the Mac app's, so hosts paired there carry over with their Keychain tokens.

export type PairedHost = {
  id: string
  label: string
  hostname: string
  addresses: Array<string>
  fingerprint: string
  clientId?: string
  pairedAt?: string
  lastGoodAddress?: string | null
}

function isPairedHost(host: unknown): host is PairedHost {
  const h = host as Partial<PairedHost> | null
  return (
    typeof h?.id === 'string' &&
    typeof h.fingerprint === 'string' &&
    Array.isArray(h.addresses) &&
    typeof h.label === 'string'
  )
}

/** The hosts in the app's remote-hosts.json (a list, or `{ hosts }`), without its colours. */
export function parseHostList(text: string): Array<PairedHost> {
  const parsed: unknown = JSON.parse(text)
  const list = Array.isArray(parsed) ? parsed : ((parsed as { hosts?: unknown }).hosts ?? [])
  if (!Array.isArray(list)) return []
  return list.filter(isPairedHost).map((h) => ({
    id: h.id,
    label: h.label,
    hostname: h.hostname ?? h.label,
    addresses: h.addresses,
    fingerprint: h.fingerprint,
    clientId: h.clientId,
    pairedAt: h.pairedAt,
    lastGoodAddress: h.lastGoodAddress ?? null,
  }))
}

/** The plugin's hosts, then any of the app's it doesn't have yet (by id), minus the ones it removed. */
export function mergeHosts(
  mine: ReadonlyArray<PairedHost>,
  app: ReadonlyArray<PairedHost>,
  removed: ReadonlyArray<string>,
): Array<PairedHost> {
  const known = new Set(mine.map((h) => h.id))
  return [...mine, ...app.filter((h) => !known.has(h.id) && !removed.includes(h.id))]
}

/** The addresses to try, the last good one first, each once. */
export function addressOrder(host: PairedHost): Array<string> {
  const first = host.lastGoodAddress ? [host.lastGoodAddress] : []
  return [...new Set([...first, ...host.addresses])]
}

/** A host by its label or host name, ignoring case; or why not. */
export function findHost(hosts: ReadonlyArray<PairedHost>, name: string): PairedHost | { error: string } {
  const wanted = name.trim().toLowerCase()
  const matches = hosts.filter((h) => h.label.toLowerCase() === wanted || h.hostname.toLowerCase() === wanted)
  if (matches.length === 1 && matches[0]) return matches[0]
  if (matches.length > 1)
    return { error: `"${name}" could be ${matches.map((h) => h.label).join(', ')}: rename one of them.` }
  if (hosts.length === 0) return { error: `No host is called "${name}": no hosts are paired.` }
  return { error: `No host is called "${name}". Paired hosts: ${hosts.map((h) => h.label).join(', ')}.` }
}
