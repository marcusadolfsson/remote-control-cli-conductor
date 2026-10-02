// Moving a session between accounts on a host: the plan, the memory decisions.

import type { Decision, TransferPlan } from './wire'

/** A memory conflict's choice: the newer side, one side, or Claude's merge. */
export type MemoryChoice = 'newer' | 'source' | 'destination' | 'merged'

/** What happens to the copy left behind. */
export type Afterwards = 'archive' | 'delete' | 'keep'

/** The memory notes both sides changed. */
export function conflicts(plan: TransferPlan) {
  return plan.memory.filter((m) => m.action === 'conflict')
}

/** The decisions to send: one per conflict, the newer side unless chosen otherwise. */
export function memoryDecisions(
  plan: TransferPlan,
  choices: Readonly<Record<string, MemoryChoice>>,
  merged: Readonly<Record<string, string>>,
): Record<string, Decision> {
  const out: Record<string, Decision> = {}
  for (const file of conflicts(plan)) {
    const choice = choices[file.path] ?? 'newer'
    const text = merged[file.path]
    if (choice === 'merged' && text !== undefined) out[file.path] = { take: 'merged', text }
    else if (choice === 'source' || choice === 'destination') out[file.path] = { take: choice }
    else out[file.path] = { take: file.newer }
  }
  return out
}

/** `Files: 3 to copy, 1 to replace, 2 already there.` */
export function planSummary(plan: TransferPlan): string {
  const tally = { copy: 0, replace: 0, remove: 0, same: 0 }
  for (const item of plan.items) tally[item.action] += 1
  const parts = [
    tally.copy ? `${tally.copy} to copy` : null,
    tally.replace ? `${tally.replace} to replace` : null,
    tally.remove ? `${tally.remove} left over to remove` : null,
    tally.same ? `${tally.same} already there` : null,
  ].filter(Boolean)
  const backed = tally.replace || tally.remove ? ' What it replaces or removes is backed up first.' : ''
  return `Files: ${parts.join(', ') || 'nothing to copy'}.${backed}`
}

/** Whether the session runs right now, under any account. */
export function isRunning(plan: TransferPlan): boolean {
  return plan.running.some((r) => r.exact)
}

/** The automatic memory changes, as `add   memory/x.md` lines. */
export function automaticMemory(plan: TransferPlan): Array<string> {
  const label = { add: 'add', index: 'index', merge: 'merge' } as const
  return plan.memory
    .filter((m) => m.action === 'add' || m.action === 'index' || m.action === 'merge')
    .map((m) => `${label[m.action as keyof typeof label].padEnd(6)} memory/${m.path}`)
}

/** A fresh progress id, shaped like a session id (the server tracks only those). */
export function progressId(random: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
}
