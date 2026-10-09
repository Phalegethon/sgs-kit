// Subagents belong to the session: a new flow must not drop the ones an earlier flow ran.
import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

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
  on('agent.spawn', async (_$, e) => ({ model: 'claude-haiku-5-5', agentId: `a-${e.tool_use_id}` }))
  on('turn.complete', async () => ({ text: '' }))
  // A subagent's model request: 1M input tokens of Haiku, $1.
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: usage('claude-haiku-5-5', 1_000_000, 0) }
  })
}

const pane = (surface: 'desktop' | 'terminal') =>
  ({
    surface,
    component: 'Pane',
    requestId: 'savvy-agents',
    props: { title: 'Session', isFocused: true, bodyColumns: 100 },
  }) as never

const band = (surface: 'desktop' | 'terminal') =>
  ({
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 160 },
  }) as never

// One finished Haiku run under the current flow.
const runAgent = async ($: Parameters<Parameters<typeof test>[2]>[0], id: string, description: string) => {
  const spawned = await $.agent.spawn({
    tool_use_id: id,
    prompt: 'go',
    description,
    subagentType: 'general-purpose',
    provider: { plugin: 'core', tier: 'core' },
    model: 'haiku',
    parentModel: 'claude-opus-5-5',
  } as never)
  const agentId = (spawned as { agentId: string }).agentId
  const stream = $.turn.step({ turnId: `t-${id}`, index: 0, model: 'claude-haiku-5-5', messageCount: 1, agentId })
  for await (const _chunk of stream) void _chunk
  await stream.result
  await $.turn.complete({ turnId: `t-${id}`, answer: '', durationMs: 1000, isAborted: false, reason: 'answer', agentId } as never)
}

test('a new flow keeps the subagents of the one before', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  on('clock.now', async () => ({ value: 1_000_000 }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__savvy-progress__progress', title: 'Research', total: 2, phase: 'delegate' } as never)
  await runAgent($, 'u1', 'Research odds')
  await runAgent($, 'u2', 'Research form')
  await $.tool.call({ tool: 'mcp__savvy-progress__progress', done: 2, finished: true } as never)
  // The orchestrator opens the next flow right after closing the first.
  await $.tool.call({ tool: 'mcp__savvy-progress__progress', title: 'Redesign', total: 7, phase: 'design' } as never)

  const desktop = JSON.stringify(await $.ui.render(pane('desktop')))
  // Two runs of 1M Haiku input tokens each: $2.
  expect(desktop).toContain('Subagents ≈$2.00')
  expect(desktop).toContain('Research odds')
  expect(desktop).not.toContain('No subagents yet')
  // The subagents card: its header sums the runs, its controls sit under it.
  expect(desktop).toContain('2 agents · ≈$2.00')
  expect(desktop).toContain('"label":"Hide finished"')

  const terminal = JSON.stringify(await $.ui.render(pane('terminal')))
  expect(terminal).toContain('"$2.00"')
})

test('the flow row counts only its own crew and draws no × button', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  let at = 1_000_000
  on('clock.now', async () => ({ value: at }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__savvy-progress__progress', title: 'Research', total: 2, phase: 'delegate' } as never)
  await runAgent($, 'u1', 'Research odds')
  await runAgent($, 'u2', 'Research form')
  await $.tool.call({ tool: 'mcp__savvy-progress__progress', done: 2, finished: true } as never)
  at += 60_000
  await $.tool.call({
    tool: 'mcp__savvy-progress__progress',
    title: 'Redesign',
    phase: 'delegate',
    // The same title as an earlier run is still planned in this flow.
    tasks: [
      { title: 'Research odds', tier: 'light' },
      { title: 'Build header', tier: 'medium' },
      { title: 'Build tabs', tier: 'medium' },
    ],
  } as never)
  at += 1000
  await runAgent($, 'u3', 'Build header')

  const desktop = JSON.stringify(await $.ui.render(band('desktop')))
  // No "×N" control beside the dismiss: the crew is drawn in the row itself.
  expect(desktop).not.toMatch(/"label":"×\d+"/)
  // This flow's crew: one run plus two planned tasks; the earlier flow's two runs are not in it.
  expect(desktop).toContain('3 agents')
  // No dismiss on the row: Details is the band's only button.
  expect(desktop.match(/"type":"Button"/g)?.length).toBe(1)

  // A narrow band drops the word first, then the percent; the alt keeps the whole figure.
  const bandAt = async (bodyColumns: number) =>
    JSON.stringify(await $.ui.render({ surface: 'desktop', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns } } as never))
  const narrow = await bandAt(34)
  expect(narrow).not.toContain('> agents<')
  expect(narrow).toContain('>0%<')
  expect(narrow).toContain('Redesign: Tasks 0/3, 0%, 3 agents')
  const narrower = await bandAt(26)
  expect(narrower).not.toContain('> agents<')
  expect(narrower).not.toContain('>0%<')
  expect(desktop).toContain('> agents<')

  const terminal = JSON.stringify(await $.ui.render(band('terminal')))
  expect(terminal).not.toMatch(/×\d/)
  expect(terminal).toContain('3 agents')

  const panel = JSON.stringify(await $.ui.render(pane('desktop')))
  // "Research odds" ran in the earlier flow: here it is still planned.
  expect(panel).toContain('Planned · 2')
  expect(panel).toContain('1. Research odds: planned')
})

test('a finished flow stays until the next prompt, a notification leaves it', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  on('clock.now', async () => ({ value: 1_000_000 }))
  on('prompt.submit', async (_$, e) => ({ text: e.text }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'mcp__savvy-progress__progress', title: 'Research', total: 1, phase: 'delegate' } as never)
  await runAgent($, 'u1', 'Research odds')
  await $.tool.call({ tool: 'mcp__savvy-progress__progress', done: 1, finished: true } as never)
  expect(JSON.stringify(await $.ui.render(band('desktop')))).toContain('Research: Done')

  await $.prompt.submit({ text: 'agent done', wait: false, origin: { kind: 'task-notification' } } as never)
  expect(JSON.stringify(await $.ui.render(band('desktop')))).toContain('Research: Done')

  await $.prompt.submit({ text: 'next', wait: false, origin: { kind: 'composer' } } as never)
  const after = JSON.stringify(await $.ui.render(band('desktop')))
  expect(after).not.toContain('Research')
  // The run and its cost outlive the row.
  const panel = JSON.stringify(await $.ui.render(pane('desktop')))
  expect(panel).toContain('Subagents ≈$1.00')
})
