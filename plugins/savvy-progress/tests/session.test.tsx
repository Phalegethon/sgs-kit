// The session row above the prompt in every session, and the session cards in the pane.
import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const usage = (model: string, input: number, output: number, cacheRead = 0) => ({
  model,
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: cacheRead,
  cache_creation_input_tokens: 0,
})

// What the engine would answer beneath the plugin.
const engine = (on: On) => {
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('tool.register', async (_$, e) => ({ value: { tool: `mcp__savvy-progress__${e.name}` } }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.measure', async (_$, e) => ({ changed: e.changed }))
  on('turn.complete', async () => ({ text: '' }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  on('clock.now', async () => ({ value: 1_000_000 }))
  on('clock.every', async () => ({ value: undefined }))
}

const band = (surface: 'desktop' | 'terminal') =>
  ({
    surface,
    component: 'AbovePrompt',
    // Only these fields matter to the drawing; the site fields are the engine's.
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 160 },
  }) as never

test('the band shows the session row without a flow', { options: { language: 'tr' } }, async ($, on) => {
  engine(on)
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: usage('claude-opus-5-5', 1000, 1000) }
  })
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
  for await (const _chunk of stream) void _chunk
  await stream.result

  const text = JSON.stringify(await $.ui.render(band('desktop')))
  expect(text).toContain('Ayrıntılar')
  expect(text).toContain('Maliyet')
  expect(text).toContain('≈$0.02')
  expect(text).toContain('Opus 5.5')
  // No flow reported: no progress row.
  expect(text).not.toContain('savvy-flow')

  const terminal = JSON.stringify(await $.ui.render(band('terminal')))
  expect(terminal).toContain('Maliyet ≈$0.02')
})

test('engine figures reach the band and the pane', { options: { language: 'tr' } }, async ($, on) => {
  engine(on)
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: usage('claude-opus-5-5', 100, 900, 9000) }
  })
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await $.session.measure({
    context: { tokens: 420_000, window: 1_000_000, percent: 42 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 23.5 },
      { kind: 'seven_day', percentUsed: 91 },
    ],
    cost: { usd: 3.56 },
    changed: ['context', 'rateLimits', 'cost'],
  })
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })
  for await (const _chunk of stream) void _chunk
  await stream.result
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 65_000, isAborted: false, reason: 'answer' })

  const row = JSON.stringify(await $.ui.render(band('desktop')))
  // The ledger is the engine's own: no estimate mark.
  expect(row).toContain('$3.56')
  expect(row).not.toContain('≈$3.56')
  expect(row).toContain('%42')
  expect(row).toContain('5 sa')
  expect(row).toContain('%24')

  const pane = JSON.stringify(
    await $.ui.render({
      surface: 'desktop',
      component: 'Pane',
      requestId: 'savvy-agents',
      props: { title: 'Oturum', isFocused: true, bodyColumns: 60 } as never,
    }),
  )
  expect(pane).toContain('Oturum maliyeti')
  expect(pane).toContain('/cost')
  expect(pane).toContain('5 saatlik pencere')
  expect(pane).toContain('7 günlük pencere')
  expect(pane).toContain('Bağlam penceresi')
  expect(pane).toContain('Token dağılımı')
  // 9000 of 9100 prompt tokens came from the cache.
  expect(pane).toContain('Önbellek isabeti %99')
  expect(pane).toContain('Henüz alt ajan yok')

  const terminal = JSON.stringify(
    await $.ui.render({
      surface: 'terminal',
      component: 'Pane',
      requestId: 'savvy-agents',
      props: { title: 'Oturum', isFocused: true, bodyColumns: 100 } as never,
    }),
  )
  // JSX splits the line into pieces: the label, a space, the 65 s turn.
  expect(terminal).toContain('"Aktif"," ","1:05"')
  expect(terminal).toContain('7 gün')
})
