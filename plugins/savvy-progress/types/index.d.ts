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
  /** The main loop's current or last turn. */
  turnId?: string
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
  /** The model routing gave the run, when the Agent call named none (`exploreModel`, `generalModel`). */
  routedModel?: string
  /** The run whose loop started this one; absent when the main loop did. */
  parentAgentId?: string
  /** The workflow run (`wf_...`) and the agent's place in it, for a workflow's agent. */
  workflowRunId?: string
  workflowIndex?: number
  /** What SendMessage addresses it by, when the call named it. */
  name?: string
  /** Self-reported by the worker through the `step` tool. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
  /** The flow title or main turn the panel last opened itself for. */
  autoOpenedFor: string
  /** The person closed the panel: subagents outside a flow leave it closed until they open it. */
  isAutoOff?: boolean
}

/**
 * What the drawings read: a copy of the live values, published at most every two
 * seconds while tokens stream in, so a press does not land on a retired handle.
 */
export type Frame = {
  flow: Flow | null
  agents: AgentRun[]
  main: MainUsage
  meter: Meter
  /** The time the frame was taken. */
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    'savvy-progress': {
      flow: Flow | null
      agents: AgentRun[]
      panel: Panel
      frame: Frame
      main: MainUsage
      meter: Meter
    }
  }
}
