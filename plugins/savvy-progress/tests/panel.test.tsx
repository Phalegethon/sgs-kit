// The session panel on a desktop: Details and the panel's buttons must survive the
// engine's redraws, and a subagent the model starts on its own shows the panel.
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, UiPane } from 'claude-code'

const PANE = 'savvy-agents'

const usage = (model: string, input: number, output: number) => ({
  model,
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
})

type Calls = { opened: string[]; closed: string[] }

// What the engine would answer beneath the plugin; `panes` is the engine's pane record.
// Its timers never fire, unless a test brings a clock of its own.
const engine = (on: On, calls: Calls, panes: UiPane[] = [], hasClock = false) => {
  if (!hasClock) on('clock.every', async () => ({ value: undefined }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('tool.register', async (_$, e) => ({ value: { tool: `mcp__savvy-progress__${e.name}` } }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('ui.panes', async () => ({ value: panes }))
  on('ui.open', async (_$, e) => {
    calls.opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  on('ui.close', async (_$, e) => {
    calls.closed.push(e.id)
    return { value: undefined }
  })
  on('agent.spawn', async (_$, e) => ({ model: 'claude-haiku-5-5', agentId: `a-${e.tool_use_id}` }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async () => ({ text: '' }))
}

const pane = (id: string, fields: Partial<UiPane>): UiPane => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true, ...fields })

const band = {
  surface: 'desktop',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 160 },
} as never

const panel = {
  surface: 'desktop',
  component: 'Pane',
  requestId: PANE,
  props: { title: 'Session', isFocused: false, bodyColumns: 80 },
} as never

const spawn = ($: Engine, id: string, subagentType: string) =>
  $.agent.spawn({
    tool_use_id: id,
    prompt: 'go',
    description: `Look around ${id}`,
    subagentType,
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
  } as never)

test('Details brings a pane hidden behind another tab forward instead of closing it', { options: { language: 'en' } }, async ($, on) => {
  const calls: Calls = { opened: [], closed: [] }
  engine(on, calls, [pane('other', { isShown: true }), pane(PANE, { isShown: false })])
  on('clock.now', async () => ({ value: 1_000_000 }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  const answer = await $.command.run({ command: 'agents-info', args: '' } as never)
  expect(calls.closed).toEqual([])
  expect(calls.opened).toEqual([PANE])
  expect(JSON.stringify(answer)).toContain('opened')
})

test('Details opens a pane that waits unplaced, and closes one that is shown', { options: { language: 'en' } }, async ($, on) => {
  const calls: Calls = { opened: [], closed: [] }
  const panes = [pane(PANE, { isPlaced: false, isShown: false })]
  engine(on, calls, panes)
  on('clock.now', async () => ({ value: 1_000_000 }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'agents-info', args: '' } as never)
  expect(calls.closed).toEqual([])
  expect(calls.opened).toEqual([PANE])

  panes[0] = pane(PANE, { isPlaced: true, isShown: true })
  await $.command.run({ command: 'agents-info', args: '' } as never)
  expect(calls.closed).toEqual([PANE])
})

test('a subagent the model starts on its own opens the panel once a turn', { options: { language: 'en' } }, async ($, on) => {
  const calls: Calls = { opened: [], closed: [] }
  engine(on, calls)
  on('clock.now', async () => ({ value: 1_000_000 }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'look into it', turnId: 't1' })
  await spawn($, 'u1', 'Explore')
  await spawn($, 'u2', 'general-purpose')
  expect(calls.opened).toEqual([PANE])
  // It is listed straight away, with no flow reported.
  expect(JSON.stringify(await $.ui.render(panel))).toContain('Look around u1')

  await $.turn.start({ text: 'and this', turnId: 't2' })
  await spawn($, 'u3', 'Explore')
  expect(calls.opened).toEqual([PANE, PANE])
})

test('streamed tokens redraw at most every two seconds; a finished run redraws at once', { options: { language: 'en' } }, async ($, on) => {
  const calls: Calls = { opened: [], closed: [] }
  engine(on, calls, [], true)
  const clock = mock.clock(on, { now: 1_000_000 })
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: usage('claude-opus-5-5', 1000, 1000) }
  })
  const step = async (index: number) => {
    const stream = $.turn.step({ turnId: 't1', index, model: 'claude-opus-5-5', messageCount: 1 })
    for await (const _chunk of stream) void _chunk
    await stream.result
  }
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await clock.set(1_005_000)
  await step(0)
  // 1000 input × $4/M + 1000 output × $20/M = $0.024 a step.
  expect(JSON.stringify(await $.ui.render(band))).toContain('≈$0.02')

  await step(1)
  // Within two seconds of the last frame: the band keeps the frame it has.
  expect(JSON.stringify(await $.ui.render(band))).toContain('≈$0.02')

  // The timer sends the held frame once two seconds have passed.
  await clock.advance(2000)
  expect(JSON.stringify(await $.ui.render(band))).toContain('≈$0.05')

  await step(2)
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 6000, isAborted: false, reason: 'answer' })
  expect(JSON.stringify(await $.ui.render(band))).toContain('≈$0.07')
})

test('a run the engine already ended is not left running', { options: { language: 'en' } }, async ($, on) => {
  const calls: Calls = { opened: [], closed: [] }
  engine(on, calls)
  on('clock.now', async () => ({ value: 1_000_000 }))
  on('agent.list', async () => ({
    value: [{ id: 'a-u1', description: 'Look around u1', type: 'Explore', status: 'killed' as const }],
  }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'look', turnId: 't1' })
  await spawn($, 'u1', 'Explore')
  expect(JSON.stringify(await $.ui.render(panel))).toContain('Running · 1')

  // The main turn ends; the subagent was stopped without a turn.complete of its own.
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1000, isAborted: false, reason: 'answer' })
  const after = JSON.stringify(await $.ui.render(panel))
  expect(after).not.toContain('Running · 1')
  expect(after).toContain('Finished · 1')
})
