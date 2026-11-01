export type Outcome = 'running' | 'ok' | 'error' | 'denied'
export type Call = { id: string; tool: string; outcome: Outcome }
export type Counts = { prompts: number; calls: number; errors: number }
export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

declare module 'claude-code' {
  interface PluginState {
    activity: {
      startedAt: Shaped<number>
      now: Shaped<number>
      counts: Shaped<Counts>
      byTool: Shaped<Record<string, number>>
      recent: Shaped<Call[]>
      tokens: Shaped<Tokens>
      background: Shaped<string>
    }
  }
}
