// Subagent model routing: a built-in agent type with no model of its own (Explore,
// general-purpose) gets the configured model when the Agent call names none.
import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

type Seen = { type: string; model: string | undefined }

// What the engine would answer beneath the plugin; `seen` records what reached it.
const engine = (on: On, seen: Seen[], sets: [string, unknown][] = []) => {
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('tool.register', async (_$, e) => ({ value: { tool: `mcp__savvy-progress__${e.name}` } }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  on('clock.every', async () => ({ value: undefined }))
  on('clock.now', async () => ({ value: 1_000_000 }))
  on('config.set', async (_$, e) => {
    sets.push([e.key, e.value])
    return { value: e.value }
  })
  on('agent.spawn', async (_$, e) => {
    seen.push({ type: e.subagentType, model: e.model })
    const model = e.model === 'haiku' ? 'claude-haiku-5-5' : e.model === 'sonnet' ? 'claude-sonnet-5-5' : 'claude-opus-5-5'
    return { model, agentId: `a-${e.tool_use_id}` }
  })
}

const spawn = ($: Parameters<Parameters<typeof test>[2]>[0], id: string, fields: Record<string, unknown>) =>
  $.agent.spawn({
    tool_use_id: id,
    prompt: 'go',
    description: `Task ${id}`,
    provider: { plugin: 'core', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    ...fields,
  } as never)

test('routing is off by default: an Agent call without a model is left alone', { options: { language: 'en' } }, async ($, on) => {
  const seen: Seen[] = []
  engine(on, seen)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await spawn($, 'u1', { subagentType: 'Explore' })
  await spawn($, 'u2', { subagentType: 'general-purpose' })
  expect(seen).toEqual([
    { type: 'Explore', model: undefined },
    { type: 'general-purpose', model: undefined },
  ])
})

test(
  'routing fills only built-in types without a model, nested calls included',
  { options: { language: 'en', exploreModel: 'haiku', generalModel: 'sonnet' } },
  async ($, on) => {
    const seen: Seen[] = []
    engine(on, seen)
    await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
    await spawn($, 'u1', { subagentType: 'Explore' })
    await spawn($, 'u2', { subagentType: 'general-purpose' })
    // A subagent's own subagent follows the same rule.
    await spawn($, 'u3', { subagentType: 'Explore', parentAgentId: 'a-u2' })
    // A model the call names always wins.
    await spawn($, 'u4', { subagentType: 'Explore', model: 'opus' })
    // A defined agent keeps its frontmatter model: the hook cannot read it, so it never writes one.
    await spawn($, 'u5', { subagentType: 'opus-architect' })
    await spawn($, 'u6', { subagentType: 'savvy-flow:savvy-light' })
    // Forks always inherit, workflow agents ignore a rewrite, teammates keep their own.
    await spawn($, 'u7', { subagentType: 'general-purpose', fork: true })
    await spawn($, 'u8', { subagentType: 'general-purpose', workflow: { runId: 'w1', agentIndex: 0 } })
    await spawn($, 'u9', { subagentType: 'general-purpose', isTeammate: true })
    expect(seen).toEqual([
      { type: 'Explore', model: 'haiku' },
      { type: 'general-purpose', model: 'sonnet' },
      { type: 'Explore', model: 'haiku' },
      { type: 'Explore', model: 'opus' },
      { type: 'opus-architect', model: undefined },
      { type: 'savvy-flow:savvy-light', model: undefined },
      { type: 'general-purpose', model: undefined },
      { type: 'general-purpose', model: undefined },
      { type: 'general-purpose', model: undefined },
    ])
  },
)

test('a routed run says so in the panel; a named model does not', { options: { language: 'en', exploreModel: 'haiku' } }, async ($, on) => {
  const seen: Seen[] = []
  engine(on, seen)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await spawn($, 'r1', { subagentType: 'Explore', description: 'Scan the repo' })
  await spawn($, 'r2', { subagentType: 'Explore', description: 'Named model', model: 'sonnet' })
  const pane = JSON.stringify(
    await $.ui.render({ surface: 'desktop', component: 'Pane', requestId: 'savvy-agents', props: { title: 'Session', isFocused: true, bodyColumns: 80 } } as never),
  )
  expect(pane).toContain('Haiku 5.5 · auto')
  expect(pane).toContain('Scan the repo: Haiku 5.5, running, model set by routing')
  expect(pane).not.toContain('Sonnet 5.5 · auto')
  const terminal = JSON.stringify(
    await $.ui.render({ surface: 'terminal', component: 'Pane', requestId: 'savvy-agents', props: { title: 'Session', isFocused: true, bodyColumns: 100 } } as never),
  )
  expect(terminal).toContain('auto')
})

test('/agent-routing shows the settings and changes them', { options: { language: 'en', exploreModel: 'haiku' } }, async ($, on) => {
  const seen: Seen[] = []
  const sets: [string, unknown][] = []
  engine(on, seen, sets)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  const run = async (args: string) => (await $.command.run({ command: 'agent-routing', args } as never)).text ?? ''

  const shown = await run('')
  expect(shown).toContain('Explore: haiku')
  expect(shown).toContain('general-purpose: inherit')

  await run('on')
  expect(sets).toEqual([
    ['savvy-progress.exploreModel', 'haiku'],
    ['savvy-progress.generalModel', 'sonnet'],
  ])
  sets.length = 0
  await run('general fable')
  expect(sets).toEqual([['savvy-progress.generalModel', 'fable']])
  sets.length = 0
  await run('off')
  expect(sets).toEqual([
    ['savvy-progress.exploreModel', 'inherit'],
    ['savvy-progress.generalModel', 'inherit'],
  ])
  sets.length = 0
  // Anything else changes nothing and says how to use it.
  expect(await run('explore gpt')).toContain('/agent-routing')
  expect(sets).toEqual([])
})
