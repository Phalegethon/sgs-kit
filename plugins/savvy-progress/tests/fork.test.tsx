// Fork behaviour: named models on planned rows, the main loop's API-equivalent cost, Turkish.
import { expect, test } from 'claude-code/testing'

const usage = (model: string, input: number, output: number) => ({
  model,
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
})

test('planned rows name the model and the main loop is priced', { options: { language: 'tr' } }, async ($, on) => {
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  // The panel opens itself when a plan arrives; the engine would seat it.
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  // Bottom of turn.step: the model answers with usage; agentId absent means the main loop.
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: usage('claude-opus-5-5', 1000, 1000) }
  })
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__savvy-progress__progress',
    title: 'Akış',
    total: 1,
    tasks: [{ title: 'Araştırma', tier: 'light', model: 'haiku' }],
  } as never)
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
  for await (const _chunk of stream) void _chunk
  await stream.result

  const tree = await $.ui.render({
    surface: 'terminal',
    component: 'Pane',
    requestId: 'savvy-agents',
    // Only the width matters to this drawing; the site fields are the engine's.
    props: { title: 'Ajanlar', isFocused: true, bodyColumns: 100 } as never,
  })
  const text = JSON.stringify(tree)
  // 1000 input × $4/M + 1000 output × $20/M = $0.024.
  expect(text).toContain('Ana oturum')
  expect(text).toContain('$0.02')
  expect(text).toContain('Haiku')
  expect(text).not.toContain('Opus · low')
  expect(text).toContain('fatura değil')
})

test('a planned task without a model keeps the tier default', async ($, on) => {
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  // The panel opens itself when a plan arrives; the engine would seat it.
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__savvy-progress__progress',
    title: 'Flow',
    total: 1,
    tasks: [{ title: 'Build', tier: 'heavy' }],
  } as never)
  const tree = await $.ui.render({
    surface: 'terminal',
    component: 'Pane',
    requestId: 'savvy-agents',
    props: { title: 'Agents', isFocused: true, bodyColumns: 100 } as never,
  })
  expect(JSON.stringify(tree)).toContain('Opus · xhigh')
})
