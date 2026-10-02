// Asking the Remote Control Conductor Mac app, when it's installed, for what
// only it knows: which Claude desktop app on this Mac is signed in as which
// account. One MCP call to its binary over stdin, then it exits.

export const MAC_APP_BINARY = '/Applications/Remote Control Conductor.app/Contents/MacOS/remote-control-conductor'

/** What to write to `remote-control-conductor mcp`: initialize, then one tool call. */
export function mcpCall(tool: string, args: Record<string, unknown>): string {
  return [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'conductor-plugin', version: '1' },
      },
    },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: tool, arguments: args } },
  ]
    .map((message) => JSON.stringify(message))
    .join('\n')
    .concat('\n')
}

/** The tool call's answer in what the server printed: its text, and whether it's an error. */
export function mcpResult(stdout: string): { text: string; isError: boolean } | null {
  for (const line of stdout.split('\n')) {
    try {
      const message = JSON.parse(line) as {
        id?: number
        result?: { content?: Array<{ text?: string }>; isError?: boolean }
        error?: { message?: string }
      }
      if (message.id !== 2) continue
      if (message.error) return { text: message.error.message ?? 'The Mac app refused it.', isError: true }
      return { text: message.result?.content?.[0]?.text ?? '', isError: message.result?.isError === true }
    } catch {
      // Not a JSON-RPC line.
    }
  }
  return null
}

/** Where open_in_claude says it opened the session. */
export function openedWhere(text: string): { app: string | null; note: string | null } {
  try {
    const answer = JSON.parse(text) as { openedIn?: string | null; note?: string | null }
    return { app: answer.openedIn ?? null, note: answer.note ?? null }
  } catch {
    return { app: null, note: null }
  }
}
