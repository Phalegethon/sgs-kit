# savvy-progress

> **Fork (sgs-kit, 1.2.0-sgs.1).** Local changes on top of upstream `johnnyvizz/claude-kit`:
> the main session's own model requests are priced too (header: main session, subagents, tokens, time;
> an API-equivalent estimate from token counts, not a bill — useful on a subscription),
> planned tasks take an optional `model`/`effort` so a Haiku or Sonnet task is not shown as Opus,
> while a reported flow runs any subagent opens the panel, and the panel speaks Turkish (`language: tr`).
> Install: `claude plugin marketplace add <path to this repo>`, then `claude plugin install savvy-progress@sgs-kit`
> and `claude plugin disable savvy-progress@claude-kit`. Upstream changes are merged by hand
> (`git fetch upstream && git merge upstream/main`); pushing to upstream is disabled.

A Claude Code mod: a progress bar above the prompt and a live panel of subagents. Made for the [savvy-flow](../savvy-flow) skill, and useful with any subagents.

- **Progress bar**: the flow's title, phase, accepted tasks out of planned, and a button with the crew size that opens the panel. It appears once something reports progress (savvy-flow does) or a `savvy-*` worker starts.
- **Agents panel** (`/agents-info` toggles it): running, finished and planned subagents with model, effort, task progress, context, estimated cost and time. Working crabs walk, and each savvy tier animates its prop: the astronaut floats, the detective sweeps the magnifier, the engineer turns the wrench, the chef tosses the omelette, the racer runs with a fluttering flag. `prefers-reduced-motion` stops them.

## Tools it adds

- `mcp__savvy-progress__progress`: the orchestrator reports the plan, phase and accepted tasks (each task may name its `model` and `effort`).
- `mcp__savvy-progress__step`: a worker reports its own steps (`done`, `total`, `note`). A worker that does not report shows its context fill in grey instead.

Cost is a rough estimate from token counts and a built-in per-model price table (`PRICES` in `hooks/register.tsx`), not a bill.

## Settings

`language`: `auto` (default), `en`, `ru` or `tr`. `auto` follows Claude Code's `language` setting, then the system locale, and falls back to English. Set it in `/config`, or, for a mod loaded by hand, in `~/.claude/settings.json`:

```json
{ "pluginConfigs": { "savvy-progress": { "options": { "language": "ru" } } } }
```

Install instructions are in the [repository README](../../README.md).
