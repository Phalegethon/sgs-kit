export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

export type PlannedTask = {
  title: string
  tier: string
  after: number[]
  /** The model the task will run on, when the orchestrator names it; the tier's default otherwise. */
  model?: string
  effort?: string
}

/** Token counts by kind, summed over model requests. */
export type TokenSplit = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

/** The main loop's own model requests: an API-equivalent estimate, never a bill. */
export type MainUsage = {
  model: string
  tokens: number
  costUsd: number
  steps: number
  split?: TokenSplit
  /** Estimated cost and tokens of the main loop per model display name. */
  byModel?: Record<string, { costUsd: number; tokens: number }>
  /** Wall-clock time of finished main-loop turns. */
  activeMs?: number
  turns?: number
  /** Set while a main-loop turn runs. */
  turnStartedAt?: number
}

export type RateWindow = {
  kind: string
  percentUsed: number
  resetsAt?: string
}

export type ContextSlice = {
  name: string
  tokens: number
  kind: string
}

/** The engine's own session figures (`$.session.usage()` and `session.measure`). */
export type Meter = {
  startedAt: number
  contextTokens?: number
  contextWindow: number
  contextPercent?: number
  rateLimits: RateWindow[]
  /** The engine's ledger, as /cost totals it; absent where the host keeps none. */
  costUsd?: number
  categories?: ContextSlice[]
  categoriesMax?: number
  breakdownAt?: number
}

export type Flow = {
  title: string
  total: number
  done: number
  running: number
  phase: Phase
  isFinished: boolean
  tasks: PlannedTask[]
  /** When the flow began: runs that started earlier belong to an earlier flow. */
  startedAt?: number
}

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
  split?: TokenSplit
  /** Self-reported by the worker through the `step` tool. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
  autoOpenedFor: string
}

declare module 'claude-code' {
  interface PluginState {
    'savvy-progress': {
      flow: Flow | null
      agents: AgentRun[]
      panel: Panel
      now: number
      main: MainUsage
      meter: Meter
    }
  }
}
