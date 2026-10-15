// Nested subagents sit under the run that started them, a workflow's agents under one
// header, and the agent whose transcript is in view leads the band and the pane.
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = 'savvy-agents'

const usage = (model: string, input: number, output: number) => ({
  model,
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
})

// What the engine would answer beneath the plugin.
const engine = (on: On) => {
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('tool.register', async (_$, e) => ({ value: { tool: `mcp__savvy-progress__${e.name}` } }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  on('clock.every', async () => ({ value: undefined }))
  let at = 1_000_000
  on('clock.now', async () => ({ value: (at += 5000) }))
  on('agent.spawn', async (_$, e) => ({ model: 'claude-haiku-5-5', agentId: `a-${e.tool_use_id}` }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async () => ({ text: '' }))
  // A subagent's model request: 1M input tokens of Haiku, $1.
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: usage('claude-haiku-5-5', 1_000_000, 0) }
  })
}

const spawn = ($: Engine, id: string, description: string, fields: Record<string, unknown> = {}) =>
  $.agent.spawn({
    tool_use_id: id,
    prompt: 'go',
    description,
    subagentType: 'Explore',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    ...fields,
  } as never)

const step = async ($: Engine, agentId: string) => {
  const stream = $.turn.step({ turnId: `t-${agentId}`, index: 0, model: 'claude-haiku-5-5', messageCount: 1, agentId })
  for await (const _chunk of stream) void _chunk
  await stream.result
}

const pane = (surface: 'desktop' | 'terminal', agentId?: string) =>
  ({
    surface,
    component: 'Pane',
    requestId: PANE,
    props: { title: 'Session', isFocused: false, bodyColumns: 80, ...(agentId ? { view: { agentId } } : {}) },
  }) as never

const band = (surface: 'desktop' | 'terminal', agentId?: string) =>
  ({
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 160, ...(agentId ? { view: { agentId } } : {}) },
  }) as never

// The drawing without the desktop's focus picker, whose options name every run.
const cards = (tree: unknown): string =>
  JSON.stringify(tree, (_k, v: unknown) => ((v as { type?: string } | null)?.type === 'Select' ? undefined : v))

// Two root runs, a child of the first, and a workflow of two agents.
const crew = async ($: Engine) => {
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await spawn($, 'u1', 'Map the parser')
  await spawn($, 'u2', 'Read the tests')
  await spawn($, 'u3', 'Trace one call', { parentAgentId: 'a-u1', name: 'tracer' })
  await spawn($, 'w2', 'Review step two', { workflow: { runId: 'wf_review42', agentIndex: 2 } })
  await spawn($, 'w1', 'Review step one', { workflow: { runId: 'wf_review42', agentIndex: 1 } })
}

test('a nested run follows its parent, indented; a workflow gets one header', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  await crew($)

  const terminal = JSON.stringify(await $.ui.render(pane('terminal')))
  const at = (s: string) => terminal.indexOf(s)
  expect(at('Map the parser')).toBeGreaterThan(-1)
  // The child comes right after its parent, marked as nested, with its address.
  expect(at('Trace one call')).toBeGreaterThan(at('Map the parser'))
  expect(at('Read the tests')).toBeLessThan(at('Map the parser'))
  expect(terminal).toContain('"↳"')
  expect(terminal).toContain('@tracer')
  // The workflow's agents, in their own order, under its header.
  expect(at('Workflow wf_review42 · 2')).toBeGreaterThan(-1)
  expect(at('Review step one')).toBeGreaterThan(at('Workflow wf_review42 · 2'))
  expect(at('Review step two')).toBeGreaterThan(at('Review step one'))

  const desktop = cards(await $.ui.render(pane('desktop')))
  const dt = (s: string) => desktop.indexOf(s)
  expect(dt('Trace one call')).toBeGreaterThan(dt('Map the parser'))
  expect(dt('Workflow wf_review42 · 2')).toBeGreaterThan(-1)
  expect(dt('Review step two')).toBeGreaterThan(dt('Review step one'))
  // The nested row is drawn one step in from the root rows' text column (54).
  expect(desktop).toMatch(/x=\\"70\\" y=\\"21\\"[^>]*>Trace one call/)
})

test('the agent in view leads the pane and takes over the band', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  await crew($)
  await step($, 'a-u2')

  // The main conversation in view: nothing changes.
  const plain = cards(await $.ui.render(pane('desktop')))
  expect(plain).not.toContain('In view')
  expect(JSON.stringify(await $.ui.render(band('desktop')))).toContain('Cost')

  const desktop = cards(await $.ui.render(pane('desktop', 'a-u2')))
  expect(desktop).toContain('In view')
  expect(desktop.indexOf('Read the tests')).toBeLessThan(desktop.indexOf('Session cost'))

  const terminal = JSON.stringify(await $.ui.render(pane('terminal', 'a-u2')))
  expect(terminal).toContain('In view')
  expect(terminal.indexOf('Read the tests')).toBeLessThan(terminal.indexOf('Main session'))

  // The band shows that run: its task, model and $1 of Haiku input.
  const row = JSON.stringify(await $.ui.render(band('desktop', 'a-u2')))
  expect(row).toContain('Read the tests')
  expect(row).toContain('Haiku 5.5')
  expect(row).toContain('≈$1.00')
  expect(row).toContain('"label":"Details"')
  const text = JSON.stringify(await $.ui.render(band('terminal', 'a-u2')))
  expect(text).toContain('Read the tests')
  expect(text).toContain('≈$1.00')

  // An agent the panel never saw (a remote one) leaves the band as it was.
  expect(JSON.stringify(await $.ui.render(band('desktop', 'a-unknown')))).not.toContain('Read the tests')
})

test('the collapsed card sums the subagents, not the whole session', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  on('session.measure', async (_$, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  // The engine's ledger: $8 for the whole session.
  await $.session.measure({ context: { window: 1_000_000 }, rateLimits: [], cost: { usd: 8 }, changed: ['cost'] } as never)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await spawn($, 'u1', 'Map the parser')
  await step($, 'a-u1')
  // The main loop's own request: 1M input tokens of Haiku, $1, as the agent's: each is half the ledger.
  const main = $.turn.step({ turnId: 't1', index: 0, model: 'claude-haiku-5-5', messageCount: 1 })
  for await (const _chunk of main) void _chunk
  await main.result
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1000, isAborted: false, reason: 'answer' })

  await $.ui.render(pane('desktop'))
  await $.ui.press({ plugin: 'savvy-progress', key: 'compact', requestId: PANE })
  const collapsed = JSON.stringify(await $.ui.render(pane('desktop')))
  expect(collapsed).toContain('1 agent · ≈$4.00')
  // The row beside the crabs: the agent's $4 and its 1M tokens, not the session's $8 and 2M.
  expect(collapsed).toContain('≈$4.00 · 1.0M')
  expect(collapsed).not.toContain('≈$8.00 · ')
})

test('on the desktop, picking a run in the panel puts it in view; the session takes it back', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  await crew($)
  await step($, 'a-u2')

  const before = JSON.stringify(await $.ui.render(pane('desktop')))
  expect(cards(JSON.parse(before))).not.toContain('In view')
  // The picker lists the session first, then every run.
  expect(before).toContain('"key":"savvy-focus"')
  expect(before).toContain('"label":"Whole session"')
  expect(before).toContain('"label":"Read the tests"')

  // The desktop's element table takes the tree as drawn: a refused one would not mount.
  const mount = (target: object) => $.ui.mount({ plugin: 'savvy-progress', ...target } as never)
  await mount(pane('desktop'))
  await mount(band('desktop'))
  await mount(pane('terminal'))

  await $.ui.select({ plugin: 'savvy-progress', key: 'savvy-focus', value: 'a-u2' })
  const pinned = cards(await $.ui.render(pane('desktop')))
  expect(pinned.indexOf('Read the tests')).toBeLessThan(pinned.indexOf('Session cost'))
  expect(pinned).toContain('In view')
  // The band follows the pick, as it follows the engine's own view.
  const row = JSON.stringify(await $.ui.render(band('desktop')))
  expect(row).toContain('Read the tests')
  expect(row).toContain('≈$1.00')

  // The engine's view wins over the pick while it lasts.
  expect(JSON.stringify(await $.ui.render(band('desktop', 'a-u1')))).toContain('Map the parser')

  await $.ui.select({ plugin: 'savvy-progress', key: 'savvy-focus', value: 'session' })
  expect(JSON.stringify(await $.ui.render(band('desktop')))).not.toContain('Read the tests')
})
