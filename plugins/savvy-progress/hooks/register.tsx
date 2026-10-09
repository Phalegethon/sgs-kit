import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRun, Flow, MainUsage, Meter, Panel, Phase, PlannedTask, RateWindow, TokenSplit } from '../types'

const flow = atom({ plugin: 'savvy-progress', key: 'flow' } as const, null)
const agents = atom({ plugin: 'savvy-progress', key: 'agents' } as const, [])
const panel = atom({ plugin: 'savvy-progress', key: 'panel' } as const, {
  isCompact: false,
  isDoneCollapsed: false,
  autoOpenedFor: '',
})
const now = atom({ plugin: 'savvy-progress', key: 'now' } as const, 0)
const main = atom({ plugin: 'savvy-progress', key: 'main' } as const, {
  model: '',
  tokens: 0,
  costUsd: 0,
  steps: 0,
} as MainUsage)
const meter = atom({ plugin: 'savvy-progress', key: 'meter' } as const, {
  startedAt: 0,
  contextWindow: 0,
  rateLimits: [],
} as Meter)

const TOOL = 'mcp__savvy-progress__progress'
const STEP_TOOL = 'mcp__savvy-progress__step'
const PANE = 'savvy-agents'
const PHASES: readonly Phase[] = ['plan', 'design', 'delegate', 'review', 'close']
const ACCENT = '#8f8cf4'
const DONE = '#5fbf8f'
const WARN = '#D9A23A'
const ALERT = '#D0453F'

type ProgressInput = {
  title?: string
  total?: number
  done?: number
  phase?: Phase
  finished?: boolean
  tasks?: { title?: string; tier?: string; after?: number[]; model?: string; effort?: string }[]
}

// ---------------------------------------------------------------------------
// Language: the `language` option, else Claude Code's `language` setting, else the
// process locale; English when nothing says Russian or Turkish.

type Lang = 'en' | 'ru' | 'tr'

const STRINGS = {
  en: {
    pane: 'Session',
    details: 'Details',
    context: 'Context',
    sessionCost: 'Session cost',
    estimated: 'estimated',
    elapsed: 'Elapsed',
    active: 'Active',
    limits: 'Usage limits',
    fiveHour: '5-hour window',
    fiveShort: '5h',
    sevenDay: '7-day window',
    sevenShort: '7d',
    spend: 'Spend limit',
    spendShort: 'limit',
    ctxWindow: 'Context window',
    noReading: 'No reading yet',
    tokenSplit: 'Tokens',
    input: 'Input',
    output: 'Output',
    cacheRead: 'Cache read',
    cacheWrite: 'Cache write',
    cacheHit: 'Cache hit',
    requests: 'model requests',
    byModel: 'By model',
    emptyHint: 'A subagent shows up here with its model, context and cost once it starts.',
    d: 'd',
    h: 'h',
    min: 'min',
    lessMin: '<1 min',
    cost: 'Cost',
    tokens: 'Tokens',
    time: 'Time',
    collapse: 'Collapse',
    expand: 'Expand',
    running: 'Running',
    finished: 'Finished',
    planned: 'Planned',
    empty: 'No subagents yet.',
    round: 'round',
    failed: 'error',
    after: 'after',
    tokensWord: 'tokens',
    agentsCount: 'agents',
    isRunning: 'running',
    isFinished: 'finished',
    isPlanned: 'planned',
    opened: 'Agents panel opened.',
    closed: 'Agents panel closed.',
    done: 'Done',
    plan: 'Plan',
    design: 'Design',
    tasks: 'Tasks',
    review: 'Review',
    busy: 'running',
    mainSession: 'Main session',
    subagents: 'Subagents',
    estimate: '≈ API-equivalent estimate from token counts; not a bill',
  },
  ru: {
    pane: 'Сессия',
    details: 'Подробнее',
    context: 'Контекст',
    sessionCost: 'Стоимость сессии',
    estimated: 'оценка',
    elapsed: 'Прошло',
    active: 'Активно',
    limits: 'Лимиты',
    fiveHour: '5-часовое окно',
    fiveShort: '5ч',
    sevenDay: '7-дневное окно',
    sevenShort: '7д',
    spend: 'Лимит расходов',
    spendShort: 'лимит',
    ctxWindow: 'Контекстное окно',
    noReading: 'Пока нет данных',
    tokenSplit: 'Токены',
    input: 'Ввод',
    output: 'Вывод',
    cacheRead: 'Чтение кэша',
    cacheWrite: 'Запись кэша',
    cacheHit: 'Попадание в кэш',
    requests: 'запросов к модели',
    byModel: 'По моделям',
    emptyHint: 'Субагент появится здесь с моделью, контекстом и стоимостью, как только начнёт работу.',
    d: 'д',
    h: 'ч',
    min: 'мин',
    lessMin: '<1 мин',
    cost: 'Стоимость',
    tokens: 'Токены',
    time: 'Время',
    collapse: 'Свернуть',
    expand: 'Развернуть',
    running: 'Работают',
    finished: 'Завершены',
    planned: 'Запланированы',
    empty: 'Субагентов пока нет.',
    round: 'раунд',
    failed: 'ошибка',
    after: 'после',
    tokensWord: 'токенов',
    agentsCount: 'агентов',
    isRunning: 'работает',
    isFinished: 'завершён',
    isPlanned: 'запланирована',
    opened: 'Панель агентов открыта.',
    closed: 'Панель агентов закрыта.',
    done: 'Готово',
    plan: 'План',
    design: 'Дизайн',
    tasks: 'Задачи',
    review: 'Ревью',
    busy: 'в работе',
    mainSession: 'Основная сессия',
    subagents: 'Субагенты',
    estimate: '≈ оценка по ценам API из числа токенов; не счёт',
  },
  tr: {
    pane: 'Oturum',
    details: 'Ayrıntılar',
    context: 'Bağlam',
    sessionCost: 'Oturum maliyeti',
    estimated: 'tahmini',
    elapsed: 'Süre',
    active: 'Aktif',
    limits: 'Kullanım limitleri',
    fiveHour: '5 saatlik pencere',
    fiveShort: '5 sa',
    sevenDay: '7 günlük pencere',
    sevenShort: '7 gün',
    spend: 'Harcama limiti',
    spendShort: 'limit',
    ctxWindow: 'Bağlam penceresi',
    noReading: 'Henüz ölçüm yok',
    tokenSplit: 'Token dağılımı',
    input: 'Girdi',
    output: 'Çıktı',
    cacheRead: 'Önbellek okuma',
    cacheWrite: 'Önbellek yazma',
    cacheHit: 'Önbellek isabeti',
    requests: 'model isteği',
    byModel: 'Modellere göre',
    emptyHint: 'Bir alt ajan başladığında modeli, bağlamı ve maliyetiyle burada görünür.',
    d: 'gün',
    h: 'sa',
    min: 'dk',
    lessMin: '<1 dk',
    cost: 'Maliyet',
    tokens: 'Token',
    time: 'Süre',
    collapse: 'Daralt',
    expand: 'Genişlet',
    running: 'Çalışıyor',
    finished: 'Bitti',
    planned: 'Planlandı',
    empty: 'Henüz alt ajan yok.',
    round: 'tur',
    failed: 'hata',
    after: 'sonra',
    tokensWord: 'token',
    agentsCount: 'ajan',
    isRunning: 'çalışıyor',
    isFinished: 'bitti',
    isPlanned: 'planlandı',
    opened: 'Ajan paneli açıldı.',
    closed: 'Ajan paneli kapandı.',
    done: 'Bitti',
    plan: 'Plan',
    design: 'Tasarım',
    tasks: 'Görevler',
    review: 'İnceleme',
    busy: 'çalışıyor',
    mainSession: 'Ana oturum',
    subagents: 'Alt ajanlar',
    estimate: '≈ token sayısından API fiyatıyla tahmin; fatura değil',
  },
} as const

// Module scope is fine here: session.start sets it again on every (re)load.
let lang: Lang = 'en'
const tr = () => STRINGS[lang]

const langOf = (v: unknown): Lang =>
  typeof v !== 'string' ? 'en' : /^(ru|russian|рус)/i.test(v.trim()) ? 'ru' : /^(tr|turkish|türk)/i.test(v.trim()) ? 'tr' : 'en'

async function detectLang($: EngineInterface, option: unknown): Promise<Lang> {
  if (option === 'en' || option === 'ru' || option === 'tr') return option
  try {
    const settings = (await $.settings.read()) as Record<string, unknown>
    if (typeof settings.language === 'string' && settings.language.trim()) return langOf(settings.language)
  } catch {
    // No settings: fall through to the locale.
  }
  const locale = (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))
  return langOf(locale)
}

const blank = (): Flow => ({
  title: 'savvy-flow',
  total: 0,
  done: 0,
  running: 0,
  phase: 'plan',
  isFinished: false,
  tasks: [],
})

const isNewFlow = (prev: Flow | null, input: ProgressInput): boolean =>
  !prev || prev.isFinished || (input.title !== undefined && input.title.trim() !== prev.title)

const cleanTasks = (tasks: ProgressInput['tasks']): PlannedTask[] | undefined =>
  tasks
    ?.filter(t => t.title?.trim())
    .map(t => ({
      title: (t.title ?? '').trim(),
      tier: (t.tier ?? '').replace(/^savvy-/, '').trim().toLowerCase(),
      after: (t.after ?? []).filter(n => Number.isInteger(n) && n > 0),
      ...(t.model?.trim() ? { model: t.model.trim().toLowerCase() } : {}),
      ...(t.effort?.trim() ? { effort: t.effort.trim().toLowerCase() } : {}),
    }))

const merge = (prev: Flow | null, input: ProgressInput): Flow => {
  // A new title means a new flow: never carry counters over from an earlier one.
  const base = isNewFlow(prev, input) || !prev ? blank() : { ...blank(), ...prev }
  const tasks = cleanTasks(input.tasks) ?? base.tasks
  const total = Math.max(0, Math.round(input.total ?? (input.tasks ? tasks.length : base.total)))
  const done = Math.min(total || Infinity, Math.max(0, Math.round(input.done ?? base.done)))
  const phase = input.phase && PHASES.includes(input.phase) ? input.phase : base.phase
  return {
    ...base,
    title: input.title?.trim() || base.title,
    total,
    done,
    phase: input.finished ? 'close' : phase,
    isFinished: input.finished === true,
    tasks,
  }
}

const label = (f: Flow): string => {
  const s = tr()
  if (f.isFinished) return s.done
  if (f.phase === 'plan') return s.plan
  if (f.phase === 'design') return s.design
  const count = f.total ? `${f.done}/${f.total}` : `${f.running} ${s.busy}`
  return `${f.phase === 'review' ? s.review : s.tasks} ${count}`
}

const ratio = (f: Flow): number => (f.isFinished ? 1 : f.total ? f.done / f.total : 0)

// Deterministic noise so the dither does not shimmer between redraws.
const noise = (x: number, y: number): number => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return s - Math.floor(s)
}

// The whole row is one SVG: the desktop wraps sibling elements onto new lines,
// so title, bar, percent and the crab live in one drawing; only the count and
// the dismiss are Buttons beside it.
const H = 22
const BAR_H = 16
const CRAB_W = 26
const CELL = 3
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',sans-serif"

const xml = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s)

// Rough advance of system UI text, in em; good enough to size the title's slot.
const charEm = (ch: string): number =>
  /[\s.,:;'|!il1()[\]]/.test(ch) ? 0.3 : /[A-ZА-ЯЁmwшщжюМШЩЖЮ@%]/.test(ch) ? 0.72 : 0.56

const textWidth = (s: string, size: number): number => [...s].reduce((w, ch) => w + charEm(ch) * size, 0)

// Cuts `s` to fit `maxW` pixels, with an ellipsis when it had to cut.
const fitText = (s: string, size: number, maxW: number): string => {
  if (textWidth(s, size) <= maxW) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(out + ch + '…', size) > maxW) break
    out += ch
  }
  return out + '…'
}

const rowSvg = (f: Flow, W: number, isWorking: boolean): string => {
  // The title takes what it needs, up to 40% of the row; the bar takes the rest.
  const title = fitText(f.title, 13, Math.max(60, W * 0.4))
  const BAR_X = Math.round(16 + textWidth(title, 13) + 12)
  const BAR_W = Math.max(60, W - BAR_X - 46 - CRAB_W)
  const color = f.isFinished ? DONE : ACCENT
  const y0 = (H - BAR_H) / 2
  const fillW = Math.round(BAR_W * ratio(f))
  const runW = f.total ? Math.round((BAR_W * Math.min(f.total, f.done + f.running)) / f.total) : 0
  const dots: string[] = []

  // Dithered fill: sparse at the start, dense toward the head.
  const cols = Math.floor(fillW / CELL)
  const rows = Math.floor(BAR_H / CELL)
  for (let c = 0; c < cols; c++) {
    const density = 0.35 + 0.6 * Math.pow(c / Math.max(1, cols), 1.2)
    for (let r = 0; r < rows; r++) {
      if (noise(c, r) < density) dots.push(`<rect class="t${Math.floor(noise(r, c) * 4)}" x="${c * CELL + 1}" y="${r * CELL + 1}" width="2" height="2"/>`)
    }
  }
  // Handed to workers, not yet accepted: a faint second layer.
  const faint: string[] = []
  for (let c = cols; c < Math.floor(runW / CELL); c++) {
    for (let r = 0; r < rows; r++) {
      if (noise(c + 7, r + 3) < 0.2) faint.push(`<rect class="t${Math.floor(noise(r + 5, c) * 4)}" x="${c * CELL + 1}" y="${r * CELL + 1}" width="1.7" height="1.7"/>`)
    }
  }

  const ticks: string[] = []
  for (let i = 1; i < f.total; i++) {
    const x = Math.round((BAR_W * i) / f.total)
    if (x > fillW + 4) ticks.push(`<rect x="${x}" y="${BAR_H / 2 - 4}" width="1.5" height="8" rx="0.75"/>`)
  }

  const text = label(f)
  const pillW = Math.round(18 + text.length * 6.6)
  const pillX = Math.max(0, Math.min(BAR_W - pillW, fillW - pillW))
  const percent = fmtPct(ratio(f) * 100)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
.t{fill:#1f1f1f}.m{fill:#8a8a8a}.k{fill:#e4e4e2}.tk{fill:#b4b4b0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.m{fill:#9a9a9a}.k{fill:#2c2c2c}.tk{fill:#5a5a5a}}
/* Pixels twinkle in four out-of-phase groups; a finished bar settles to a slow glow. */
.t0,.t1,.t2,.t3{animation:tw ${f.isFinished ? 3.2 : 2.2}s ease-in-out infinite}
.t1{animation-duration:${f.isFinished ? 3.8 : 2.8}s;animation-delay:-.7s}.t2{animation-duration:${f.isFinished ? 4.4 : 1.9}s;animation-delay:-1.3s}.t3{animation-duration:${f.isFinished ? 3.5 : 3.3}s;animation-delay:-.4s}
@keyframes tw{0%,100%{opacity:1}50%{opacity:${f.isFinished ? 0.8 : 0.3}}}
@media (prefers-reduced-motion: reduce){.t0,.t1,.t2,.t3{animation:none}}
</style>
<defs><clipPath id="c"><rect x="0" y="0" width="${BAR_W}" height="${BAR_H}" rx="${BAR_H / 2}"/></clipPath></defs>
<circle cx="5" cy="${H / 2}" r="4" fill="${color}"/>
<text class="t" x="16" y="${H / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="500">${xml(title)}</text>
<g transform="translate(${BAR_X},${y0})">
<rect class="k" width="${BAR_W}" height="${BAR_H}" rx="${BAR_H / 2}"/>
<g clip-path="url(#c)">
<g fill="${color}">${dots.join('')}</g>
<g fill="${color}" opacity="0.45">${faint.join('')}</g>
<g class="tk">${ticks.join('')}</g>
</g>
<rect x="${pillX}" width="${pillW}" height="${BAR_H}" rx="${BAR_H / 2}" fill="${color}"/>
<text x="${pillX + pillW / 2}" y="${BAR_H / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" fill="#ffffff">${xml(text)}</text>
</g>
<text class="m" x="${W - CRAB_W - 6}" y="${H / 2 + 4.5}" text-anchor="end" font-family="${FONT}" font-size="12.5" font-variant-numeric="tabular-nums">${percent}</text>
${CRAB_CSS}${crab(W - CRAB_W + 1, 0, 'other', false, isWorking, 0.8)}
</svg>`
}

const barText = (f: Flow, width: number): string => {
  const filled = Math.round(width * ratio(f))
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

// ---------------------------------------------------------------------------
// Agents panel: every subagent of the session, plus the tasks the flow planned.

const TIER_COLOR: Record<string, string> = {
  fable: '#7F77DD',
  heavy: '#D85A30',
  careful: '#BA7517',
  medium: '#378ADD',
  light: '#1D9E75',
  other: '#888780',
}

const colorOf = (tier: string): string => TIER_COLOR[tier] ?? '#888780'

// What each savvy tier runs on, for planned tasks that have no run yet and name no model.

const TIER_MODEL: Record<string, string> = {
  fable: 'Fable · high',
  heavy: 'Opus · xhigh',
  careful: 'Opus · high',
  medium: 'Opus · medium',
  light: 'Opus · low',
}

// USD per million tokens: input, output, cache read, cache write (5-minute TTL).
// The engine reports tokens, not money, so the panel's cost is an estimate.
const PRICES: [RegExp, [number, number, number, number]][] = [
  [/fable|mythos/, [10, 50, 0.25, 12.5]],
  [/opus-5-5/, [4, 20, 0.2, 5]],
  [/opus/, [5, 25, 0.5, 6.25]],
  [/sonnet/, [2, 10, 0.2, 2.5]],
  [/haiku/, [1, 5, 0.1, 1.25]],
]

type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const priceOf = (model: string): [number, number, number, number] =>
  PRICES.find(([re]) => re.test(model.toLowerCase()))?.[1] ?? [4, 20, 0.2, 5]

const costOf = (model: string, u: Usage): number => {
  const [i, o, r, w] = priceOf(model)
  return (
    ((u.input_tokens || 0) * i +
      (u.output_tokens || 0) * o +
      (u.cache_read_input_tokens || 0) * r +
      (u.cache_creation_input_tokens || 0) * w) /
    1e6
  )
}

// A planned task's model: the one the orchestrator named, else its tier's default.
const plannedModel = (p: PlannedTask, tier: string): string =>
  p.model ? `${modelName(p.model)}${p.effort ? ' · ' + p.effort : ''}` : (TIER_MODEL[tier] ?? '')

const windowOf = (model: string): number => (/haiku/i.test(model) ? 200_000 : 1_000_000)

// `savvy-careful`, or `savvy-flow:savvy-careful` when the agents ship in a plugin.
const tierOf = (type: string): string => {
  const bare = type.replace(/^[^:]*:/, '')
  const t = bare.replace(/^savvy-/, '').toLowerCase()
  return t in TIER_COLOR && bare.startsWith('savvy-') ? t : 'other'
}

const modelName = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  const [, family = '', major = '', minor] = m ?? []
  if (!family) {
    const bare = /^(fable|mythos|opus|sonnet|haiku)$/i.exec(id.trim())?.[1]
    if (bare) return bare.charAt(0).toUpperCase() + bare.slice(1).toLowerCase()
    return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  }
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? '.' + minor : ''}`
}

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const fmtTokens = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`

const fmtCost = (usd: number): string => `$${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}`

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const fmtPct = (n: number): string => (lang === 'tr' ? `%${Math.round(n)}` : `${Math.round(n)}%`)

// A share that is neither none nor all never rounds to 0 or 100.
const fmtShare = (n: number): string =>
  n > 0 && n < 1 ? (lang === 'tr' ? '<%1' : '<1%') : n < 100 && n > 99 ? (lang === 'tr' ? '>%99' : '>99%') : fmtPct(n)

// A coarse span for the band and reset times: "2 d 21 h", "1 h 12 min", "12 min", "<1 min".
const fmtSpan = (ms: number): string => {
  const s = tr()
  const min = Math.floor(Math.max(0, ms) / 60000)
  if (min < 1) return s.lessMin
  const h = Math.floor(min / 60)
  if (h >= 24) return `${Math.floor(h / 24)} ${s.d} ${h % 24} ${s.h}`
  return h ? `${h} ${s.h} ${min % 60} ${s.min}` : `${min} ${s.min}`
}

const resetsIn = (span: string): string =>
  lang === 'tr' ? `${span} sonra sıfırlanır` : lang === 'ru' ? `сброс через ${span}` : `resets in ${span}`

// Gauges turn amber, then red, as a window fills; the figure is always printed beside them.
const levelColor = (pct: number): string => (pct >= 90 ? ALERT : pct >= 70 ? WARN : ACCENT)

const rateLabel = (kind: string, isShort: boolean): string => {
  const s = tr()
  if (kind === 'five_hour') return isShort ? s.fiveShort : s.fiveHour
  if (kind === 'seven_day') return isShort ? s.sevenShort : s.sevenDay
  if (kind === 'spend_limit') return isShort ? s.spendShort : s.spend
  return kind.replace(/_/g, ' ')
}

// /context's category names, in the panel's language where it is not English.
const CATEGORY_TR: Record<string, string> = {
  'system prompt': 'Sistem istemi',
  'system tools': 'Sistem araçları',
  'mcp tools': 'MCP araçları',
  'custom agents': 'Özel ajanlar',
  'memory files': 'Bellek dosyaları',
  skills: 'Beceriler',
  'slash commands': 'Komutlar',
  messages: 'Mesajlar',
  'free space': 'Boş alan',
  'autocompact buffer': 'Otomatik sıkıştırma payı',
}

const categoryName = (name: string): string => (lang === 'tr' ? (CATEGORY_TR[name.trim().toLowerCase()] ?? name) : name)

const ZERO: TokenSplit = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

const splitOf = (u: Usage): TokenSplit => ({
  input: u.input_tokens || 0,
  output: u.output_tokens || 0,
  cacheRead: u.cache_read_input_tokens || 0,
  cacheWrite: u.cache_creation_input_tokens || 0,
})

const addSplit = (a: TokenSplit | undefined, b: TokenSplit | undefined): TokenSplit => ({
  input: (a?.input ?? 0) + (b?.input ?? 0),
  output: (a?.output ?? 0) + (b?.output ?? 0),
  cacheRead: (a?.cacheRead ?? 0) + (b?.cacheRead ?? 0),
  cacheWrite: (a?.cacheWrite ?? 0) + (b?.cacheWrite ?? 0),
})

const sumSplit = (t: TokenSplit): number => t.input + t.output + t.cacheRead + t.cacheWrite

const rateWindows = (list: readonly { kind: string; percentUsed: number; resetsAt?: string }[]): RateWindow[] =>
  list.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, ...(r.resetsAt ? { resetsAt: r.resetsAt } : {}) }))

const elapsed = (a: AgentRun, at: number): number => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt

type Planned = PlannedTask & { n: number }

const plannedOf = (f: Flow | null, list: AgentRun[]): Planned[] => {
  if (!f || f.isFinished) return []
  const started = new Set(list.map(a => norm(a.description)))
  return (f.tasks ?? []).map((t, i) => ({ ...t, n: i + 1 })).filter(t => !started.has(norm(t.title)))
}

// Subagents and the main loop, both priced from their token counts; the headline
// cost is the engine's own ledger (/cost) when the host keeps one.
const totals = (list: AgentRun[], at: number, m?: MainUsage, mt?: Meter) => {
  const agentsCost = list.reduce((s, a) => s + a.costUsd, 0)
  const mainCost = m?.costUsd ?? 0
  const tokens = list.reduce((s, a) => s + a.tokens, 0) + (m?.tokens ?? 0)
  const start = Math.min(...list.map(a => a.startedAt))
  const end = Math.max(...list.map(a => a.endedAt ?? Math.max(at, a.startedAt)))
  const split = list.reduce((s, a) => addSplit(s, a.split), addSplit(ZERO, m?.split))
  const isLedger = mt?.costUsd !== undefined && mt.costUsd > 0
  const estimate = agentsCost + mainCost
  // Splits are priced from token counts; with a ledger they are scaled to it, so
  // the parts always add up to the headline.
  const k = isLedger && estimate > 0 ? (mt?.costUsd ?? 0) / estimate : 1
  return {
    cost: isLedger ? (mt?.costUsd ?? 0) : estimate,
    isLedger,
    k,
    agentsCost: agentsCost * k,
    mainCost: mainCost * k,
    tokens,
    split,
    steps: (m?.steps ?? 0) + list.reduce((s, a) => s + a.steps, 0),
    time: list.length ? end - start : 0,
    sessionMs: mt?.startedAt ? Math.max(0, at - mt.startedAt) : 0,
    activeMs: (m?.activeMs ?? 0) + (m?.turnStartedAt ? Math.max(0, at - m.turnStartedAt) : 0),
  }
}

type Totals = ReturnType<typeof totals>

// --- desktop drawings: each row is one SVG, as the band above the prompt is.

const PANE_CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.m{fill:#9a9a96}.k{fill:#ecebe8}.ln{stroke:#e4e4e1}.tile{fill:#f4f3f0}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.m{fill:#7d7d79}.k{fill:#2c2c2b}.ln{stroke:#333331}.tile{fill:#262625}}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>`

// Pixel Clawd from DockCrab (Clawdy): a 24×18 crab on a 30×28 grid, one costume per tier.
// The body keeps the brand clay; the tier's color lives in the costume's accent.
const CLAY = '#D97757'
const INK = '#1F1E1D'

// `cls` puts a pixel in a named group: `bd` (the default) is the body and its
// costume, `la`/`lb` the leg pairs, anything else a prop with its own motion.
type Fill = (x: number, y: number, w: number, h: number, c: string, cls?: string) => void

const stamp = (f: Fill, x: number, y: number, rows: string[], map: Record<string, string>, cls?: string): void =>
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => map[ch] && f(x + dx, y + dy, 1, 1, map[ch] ?? '', cls)))

// `armCls` lets a raised claw travel with the prop it holds.
const crabBody = (f: Fill, armFront = 0, armCls?: string): void => {
  f(7, 10, 16, 12, CLAY)
  f(3, 14, 4, 4, CLAY)
  f(23, 14 + armFront, 4, 4, CLAY, armCls)
  f(9, 12, 2, 2, INK)
  f(19, 12, 2, 2, INK)
  f(7, 22, 2, 4, CLAY, 'la')
  f(17, 22, 2, 4, CLAY, 'la')
  f(11, 22, 2, 4, CLAY, 'lb')
  f(21, 22, 2, 4, CLAY, 'lb')
}

// Pure CSS, run by the compositor: no redraws. Periods divide one second, so the
// once-a-second redraw of a running row restarts them in phase. Every crab walks;
// each costume adds its prop's own motion on top.
const CRAB_CSS = `<style>
.run .la{animation:st .5s steps(1) infinite}.run .lb{animation:st .5s steps(1) infinite -.25s}
.run .bd{animation:bob .5s steps(1) infinite -.125s}
.run g{transform-box:fill-box}
@keyframes st{50%{transform:translateY(-1px)}}@keyframes bob{50%{transform:translateY(1px)}}
.c-fable.run{animation:float 1s ease-in-out infinite}
.c-fable.run .la,.c-fable.run .lb,.c-fable.run .bd{animation:none}
.c-fable.run .ant{animation:blink 1s steps(1) infinite}
.c-fable.run .star{animation:blink .5s steps(1) infinite -.25s}
@keyframes float{50%{transform:translateY(-2px)}}@keyframes blink{50%{opacity:.15}}
.c-heavy.run .it{animation:scan 1s steps(1) infinite}
.c-heavy.run .gl{animation:blink 1s steps(1) infinite -.5s}
@keyframes scan{25%{transform:translate(-1px,1px)}50%{transform:translate(-2px,2px)}75%{transform:translate(-1px,1px)}}
.c-careful.run .it{transform-origin:100% 100%;animation:twist .5s ease-in-out infinite}
@keyframes twist{50%{transform:rotate(-35deg)}}
.c-medium.run .pan{transform-origin:0 50%;animation:tilt 1s ease-in-out infinite}
.c-medium.run .egg{animation:flip 1s ease-in-out infinite}
@keyframes tilt{20%,40%{transform:rotate(-12deg)}}@keyframes flip{30%{transform:translateY(-5px) scaleY(-1)}60%{transform:translateY(0)}}
.c-light.run .la{animation-duration:.25s}.c-light.run .lb{animation-duration:.25s;animation-delay:-.125s}
.c-light.run .flag{transform-origin:0 50%;animation:wave .25s steps(1) infinite}
@keyframes wave{50%{transform:skewY(-12deg) scaleX(.85)}}
.c-explore.run .it{transform-origin:50% 100%;animation:fence .5s ease-in-out infinite}
@keyframes fence{50%{transform:rotate(25deg)}}
@media (prefers-reduced-motion: reduce){.run,.run g{animation:none!important}}
</style>`

const COSTUMES: Record<string, (f: Fill, t: string) => void> = {
  // Fable: astronaut in a glass dome; floats instead of walking, the antenna and the star blink.
  fable: (f, t) => {
    crabBody(f)
    f(6, 7, 18, 1, '#E6E8EE'); f(5, 8, 1, 14, '#E6E8EE'); f(24, 8, 1, 14, '#E6E8EE'); f(6, 22, 18, 1, '#C9CCD2')
    f(6, 8, 18, 14, 'rgba(169,214,245,.32)'); f(8, 9, 2, 1, '#fff'); f(8, 10, 1, 2, '#fff')
    f(14, 4, 2, 3, '#C9CCD2'); f(14, 2, 2, 2, t, 'ant'); f(13, 18, 4, 2, t)
    f(27, 3, 1, 3, '#F5C542', 'star'); f(26, 4, 3, 1, '#F5C542', 'star')
  },
  // Heavy: detective with a deerstalker; the magnifier sweeps and glints.
  heavy: (f, t) => {
    crabBody(f, -4, 'it')
    stamp(f, 6, 3, ['......bbbbbb......', '....bbcbbcbbbb....', '...bbbbbbbbbbbb...', '..bcbbcbbcbbcbbb..', '.bbbbbbbbbbbbbbbb.', 'dddddddddddddddddd'], { b: '#7A4A26', c: '#A0703F', d: '#5A3519' })
    f(6, 9, 18, 1, t)
    stamp(f, 23, 1, ['.kkk.', 'k...k', 'k...k', 'k...k', '.kkk.'], { k: '#3A3A3C' }, 'it')
    f(24, 2, 3, 3, 'rgba(169,214,245,.7)', 'it'); f(25, 6, 1, 4, '#7A4A26', 'it'); f(24, 2, 1, 1, '#fff', 'gl')
  },
  // Careful: engineer in a hard hat; the wrench turns a bolt.
  careful: (f, t) => {
    crabBody(f)
    stamp(f, 6, 4, ['.....yyyyyyyy.....', '...yyyyyhhyyyyy...', '..yyyyyyhhyyyyyy..', '..yyyyyyhhyyyyyy..', '.yyyyyyyhhyyyyyyy.', 'dddddddddddddddddd'], { y: '#F5C542', h: '#FBE08A', d: '#C99A1E' })
    f(13, 5, 4, 2, t)
    stamp(f, 0, 10, ['.s.s', 'sss.', '.s..', '.s..'], { s: '#8E929A' }, 'it')
  },
  // Medium: chef, the toque traced from DockCrab's Sprites.chefHat; tosses the omelette.
  medium: (f, t) => {
    crabBody(f, -4, 'pan')
    stamp(f, 6, 0, ['........lll.......', '.......lllll......', '.wwwwgwwwwwwgwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwwwww', 'wwwwwgwwwwwggwwwww', '.wwwwgwwwwwggwwwww', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.', '.dddbbbbbbbbbbbbb.'], { w: '#F4F3EE', l: '#F7F6F2', g: '#D2D1C8', b: t, d: '#B45F43' })
    f(22, 8, 7, 2, '#4A4A48', 'pan'); f(26, 10, 1, 1, '#4A4A48', 'pan'); f(24, 7, 3, 1, '#F5B731', 'egg')
  },
  // Light: racer in a helmet; runs at double pace, the checkered flag flutters.
  light: (f, t) => {
    crabBody(f, -4)
    stamp(f, 6, 5, ['....rrrrrrrrrr....', '..rrrrrrwwrrrrrr..', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.rrrrrrrwwrrrrrrr.', '.kkkkkkkkkkkkkkkkr'], { r: t, w: '#F8F6F1', k: INK })
    f(25, 1, 1, 9, '#8E929A')
    stamp(f, 26, 1, ['wkwk', 'kwkw', 'wkwk'], { w: '#F8F6F1', k: INK }, 'flag')
  },
  // Explore: pirate scouting the code; the cutlass fences.
  explore: f => {
    crabBody(f)
    stamp(f, 5, 3, ['.kk..............kk.', '.kkk....kkkk....kkk.', '..kkkkkkkwwkkkkkkk..', '..kkkkkkkkkkkkkkkk..', '.gggggggggggggggggg.'], { k: '#55514C', w: '#F8F6F1', g: '#F5C542' })
    f(7, 11, 11, 1, INK); f(18, 11, 4, 3, INK)
    f(27, 6, 1, 9, '#C9CCD2', 'it'); f(26, 15, 3, 1, '#7A4A26', 'it')
  },
  other: f => crabBody(f),
}

const costumeOf = (type: string): string => (type === 'Explore' ? 'explore' : tierOf(type))

const CRAB_SCALE = 1.1

// Body and props nest inside `bd` so a prop rides the bob and adds its own motion;
// legs stay outside it and step on their own.
const crab = (x: number, y: number, costume: string, dim = false, isWalking = false, scale = CRAB_SCALE): string => {
  const groups = new Map<string, string[]>([['bd', []]])
  const f: Fill = (cx, cy, w, h, c, cls = 'bd') => {
    if (!groups.has(cls)) groups.set(cls, [])
    groups.get(cls)?.push(`<rect x="${cx}" y="${cy}" width="${w}" height="${h}" fill="${c}"/>`)
  }
  const draw = COSTUMES[costume] ?? ((g: Fill) => crabBody(g))
  draw(f, colorOf(costume))
  const group = (cls: string) => `<g class="${cls}">${(groups.get(cls) ?? []).join('')}</g>`
  const props = [...groups.keys()].filter(k => k !== 'bd' && k !== 'la' && k !== 'lb')
  const body = `<g class="bd">${(groups.get('bd') ?? []).join('')}${props.map(group).join('')}</g>`
  return `<g transform="translate(${x},${y}) scale(${scale})" opacity="${dim ? 0.45 : 1}" shape-rendering="crispEdges"><g class="c-${costume}${isWalking ? ' run' : ''}">${body}${group('la')}${group('lb')}</g></g>`
}

const statusMark = (x: number, y: number, status: string, color: string): string => {
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done') return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="#3B9C5F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed') return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="#D0453F" stroke-width="1.8" stroke-linecap="round"/>`
  return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#9a9a96" stroke-width="1.4"/><path d="M${x} ${y - 2.5}v2.8l1.8 1.2" fill="none" stroke="#9a9a96" stroke-width="1.4" stroke-linecap="round"/>`
}

const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}${CRAB_CSS}${body}</svg>`

type TextOpts = {
  size?: number
  weight?: number
  cls?: string
  anchor?: 'middle' | 'end'
  fill?: string
  num?: boolean
}

const txt = (x: number, y: number, s: string, o: TextOpts = {}): string =>
  `<text${o.fill ? ` fill="${o.fill}"` : ` class="${o.cls ?? 't'}"`} x="${x}" y="${y}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''} font-family="${FONT}" font-size="${o.size ?? 12}"${o.weight ? ` font-weight="${o.weight}"` : ''}${o.num ? ' font-variant-numeric="tabular-nums"' : ''}>${xml(s)}</text>`

// A rounded track with a fill from the left; `pct` is 0 to 100.
const meterBar = (x: number, y: number, w: number, h: number, pct: number, color: string): string => {
  const fill = Math.round((w * Math.max(0, Math.min(100, pct))) / 100)
  return `<rect class="k" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>${fill > 0 ? `<rect x="${x}" y="${y}" width="${Math.max(h, fill)}" height="${h}" rx="${h / 2}" fill="${color}"/>` : ''}`
}

// Segments laid end to end inside one rounded track, a hairline between them.
const stackBar = (x: number, y: number, w: number, h: number, parts: { w: number; color: string }[]): string => {
  let cx = x
  const segs = parts
    .filter(p => p.w >= 1)
    .map(p => {
      const r = `<rect x="${cx}" y="${y}" width="${Math.max(1, p.w - 1)}" height="${h}" fill="${p.color}"/>`
      cx += p.w
      return r
    })
  return `<defs><clipPath id="sb"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/></clipPath></defs>
<rect class="k" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/><g clip-path="url(#sb)">${segs.join('')}</g>`
}

const PAD = 14

const card = (W: number, H: number, title: string, right: string, body: string): string =>
  svg(
    W,
    H,
    `<rect class="tile" width="${W}" height="${H}" rx="10"/>
${txt(PAD, 22, fitText(title, 11.5, right ? W * 0.55 : W - PAD * 2), { size: 11.5, weight: 600, cls: 's' })}
${right ? txt(W - PAD, 22, fitText(right, 11.5, W * 0.4), { size: 11.5, cls: 's', anchor: 'end', num: true }) : ''}
${body}`,
  )

const swatch = (x: number, y: number, color: string): string =>
  `<rect x="${x}" y="${y - 8}" width="8" height="8" rx="2" fill="${color}"/>`

// Two-column legend rows: swatch, name, and a value right-aligned in its column.
const legend = (W: number, top: number, rows: { name: string; value: string; color: string }[], rowH = 20): string => {
  const colW = (W - PAD * 2 - 16) / 2
  return rows
    .map((r, i) => {
      const x = PAD + (i % 2) * (colW + 16)
      const y = top + Math.floor(i / 2) * rowH
      const vw = textWidth(r.value, 11.5)
      return `${swatch(x, y, r.color)}${txt(x + 13, y, fitText(r.name, 11.5, colW - vw - 22), { size: 11.5, cls: 's' })}${txt(x + colW, y, r.value, { size: 11.5, anchor: 'end', num: true })}`
    })
    .join('')
}

// Cost first: the engine's ledger when there is one, else the estimate; the split
// bar is always the estimate, labelled so.
const HERO_H = 118

const heroSvg = (W: number, t: Totals): string => {
  const s = tr()
  const inner = W - PAD * 2
  const sum = t.mainCost + t.agentsCost
  const mainW = sum ? Math.round((inner * t.mainCost) / sum) : 0
  const cost = (t.isLedger ? '' : '≈') + fmtCost(t.cost)
  const stat = (x: number, label: string, value: string) =>
    `${txt(x, 40, label, { size: 11, cls: 'm', anchor: 'end' })}${txt(x, 59, value, { size: 15, weight: 600, anchor: 'end', num: true })}`
  const hasActive = W >= 340
  const mainLegend = `${s.mainSession} ≈${fmtCost(t.mainCost)}`
  const agentsX = PAD + 13 + textWidth(mainLegend, 11.5) + 18
  return card(
    W,
    HERO_H,
    s.sessionCost,
    t.isLedger ? '/cost' : s.estimated,
    `${txt(PAD, 60, cost, { size: 28, weight: 650, num: true })}
${stat(W - PAD, hasActive ? s.active : s.elapsed, fmtTime(hasActive ? t.activeMs : t.sessionMs))}
${hasActive ? stat(W - PAD - 86, s.elapsed, fmtTime(t.sessionMs)) : ''}
${sum ? stackBar(PAD, 74, inner, 8, [{ w: mainW, color: ACCENT }, { w: inner - mainW, color: CLAY }]) : meterBar(PAD, 74, inner, 8, 0, ACCENT)}
${swatch(PAD, 104, ACCENT)}${txt(PAD + 13, 104, mainLegend, { size: 11.5, cls: 's', num: true })}
${swatch(agentsX, 104, CLAY)}${txt(agentsX + 13, 104, `${s.subagents} ≈${fmtCost(t.agentsCost)}`, { size: 11.5, cls: 's', num: true })}`,
  )
}

const limitsHeight = (n: number): number => 34 + n * 46

const limitsSvg = (W: number, rl: RateWindow[], at: number): string =>
  card(
    W,
    limitsHeight(rl.length),
    tr().limits,
    '',
    rl
      .map((r, i) => {
        const y0 = 34 + i * 46
        const pct = r.percentUsed
        const color = levelColor(pct)
        const left = r.resetsAt ? Date.parse(r.resetsAt) - at : NaN
        return `${txt(PAD, y0 + 10, rateLabel(r.kind, false), { size: 12.5, weight: 500 })}
${txt(W - PAD, y0 + 10, fmtPct(pct), { size: 12.5, weight: 600, anchor: 'end', num: true, ...(pct >= 70 ? { fill: color } : {}) })}
${meterBar(PAD, y0 + 17, W - PAD * 2, 6, pct, color)}
${Number.isFinite(left) && left > 0 ? txt(PAD, y0 + 37, resetsIn(fmtSpan(left)), { size: 11, cls: 'm' }) : ''}`
      })
      .join(''),
  )

const PALETTE = ['#8f8cf4', '#378ADD', '#1D9E75', '#BA7517', '#D97757', '#7F77DD', '#D85A30', '#888780']

const contextSlices = (mt: Meter) => (mt.categories ?? []).filter(c => c.kind === 'used' && c.tokens > 0).slice(0, 8)

const contextHeight = (mt: Meter): number => {
  if (mt.contextTokens === undefined) return 70
  const rows = Math.ceil(contextSlices(mt).length / 2)
  return rows ? 58 + rows * 20 : 54
}

const contextSvg = (W: number, mt: Meter): string => {
  const s = tr()
  const inner = W - PAD * 2
  if (mt.contextTokens === undefined) {
    return card(W, contextHeight(mt), s.ctxWindow, '', `${meterBar(PAD, 32, inner, 10, 0, ACCENT)}${txt(PAD, 60, s.noReading, { size: 11.5, cls: 'm' })}`)
  }
  const pct = mt.contextPercent ?? (mt.contextWindow ? (mt.contextTokens / mt.contextWindow) * 100 : 0)
  const right = `${fmtPct(pct)} · ${fmtTokens(mt.contextTokens)} / ${fmtTokens(mt.contextWindow)}`
  const slices = contextSlices(mt)
  const used = slices.reduce((a, c) => a + c.tokens, 0)
  // The categories are estimates against the compaction window: scale them to the measured fill.
  const bar = slices.length
    ? stackBar(
        PAD,
        32,
        inner,
        10,
        slices.map((c, i) => ({ w: Math.round((inner * (pct / 100) * c.tokens) / used), color: PALETTE[i % PALETTE.length] ?? ACCENT })),
      )
    : meterBar(PAD, 32, inner, 10, pct, levelColor(pct))
  const rows = slices.map((c, i) => ({ name: categoryName(c.name), value: fmtTokens(c.tokens), color: PALETTE[i % PALETTE.length] ?? ACCENT }))
  return card(W, contextHeight(mt), s.ctxWindow, right, `${bar}${legend(W, 66, rows)}`)
}

const TOKEN_COLORS = { input: '#378ADD', output: ACCENT, cacheRead: '#1D9E75', cacheWrite: '#BA7517' }

const tokensHeight = (t: Totals): number => (sumSplit(t.split) ? 120 : 70)

const tokensSvg = (W: number, t: Totals): string => {
  const s = tr()
  const inner = W - PAD * 2
  const total = sumSplit(t.split)
  if (!total) return card(W, tokensHeight(t), s.tokenSplit, '', `${meterBar(PAD, 32, inner, 10, 0, ACCENT)}${txt(PAD, 60, s.noReading, { size: 11.5, cls: 'm' })}`)
  const kinds = [
    { name: s.input, v: t.split.input, color: TOKEN_COLORS.input },
    { name: s.output, v: t.split.output, color: TOKEN_COLORS.output },
    { name: s.cacheRead, v: t.split.cacheRead, color: TOKEN_COLORS.cacheRead },
    { name: s.cacheWrite, v: t.split.cacheWrite, color: TOKEN_COLORS.cacheWrite },
  ]
  const prompt = t.split.input + t.split.cacheRead + t.split.cacheWrite
  const hit = prompt ? (t.split.cacheRead / prompt) * 100 : 0
  return card(
    W,
    tokensHeight(t),
    s.tokenSplit,
    fmtTokens(total),
    `${stackBar(PAD, 32, inner, 10, kinds.map(k => ({ w: Math.round((inner * k.v) / total), color: k.color })))}
${legend(W, 66, kinds.map(k => ({ name: k.name, value: `${fmtTokens(k.v)} · ${fmtShare((k.v / total) * 100)}`, color: k.color })))}
${txt(PAD, 108, fitText(`${s.cacheHit} ${fmtShare(hit)} · ${t.steps} ${s.requests}`, 11, inner), { size: 11, cls: 'm', num: true })}`,
  )
}

type ModelRow = { name: string; costUsd: number; tokens: number }

const modelRows = (m: MainUsage, list: AgentRun[], k: number): ModelRow[] => {
  const rows = new Map<string, ModelRow>()
  const add = (name: string, costUsd: number, tokens: number) => {
    if (!name || (!costUsd && !tokens)) return
    const r = rows.get(name) ?? { name, costUsd: 0, tokens: 0 }
    rows.set(name, { name, costUsd: r.costUsd + costUsd * k, tokens: r.tokens + tokens })
  }
  for (const [name, v] of Object.entries(m.byModel ?? {})) add(name, v.costUsd, v.tokens)
  for (const a of list) add(modelName(a.model), a.costUsd, a.tokens)
  return [...rows.values()].sort((a, b) => b.costUsd - a.costUsd).slice(0, 6)
}

const modelsHeight = (n: number): number => 36 + n * 24

const modelsSvg = (W: number, rows: ModelRow[]): string => {
  const top = Math.max(...rows.map(r => r.costUsd), 0.000001)
  const nameW = 96
  const valueW = 108
  const barW = Math.max(30, W - PAD * 2 - nameW - valueW)
  return card(
    W,
    modelsHeight(rows.length),
    tr().byModel,
    '',
    rows
      .map((r, i) => {
        const y = 44 + i * 24
        return `${txt(PAD, y, fitText(r.name, 12, nameW - 8), { size: 12, weight: 500 })}
${meterBar(PAD + nameW, y - 7, barW, 6, (r.costUsd / top) * 100, PALETTE[i % PALETTE.length] ?? ACCENT)}
${txt(W - PAD, y, `≈${fmtCost(r.costUsd)} · ${fmtTokens(r.tokens)}`, { size: 11.5, cls: 's', anchor: 'end', num: true })}`
      })
      .join(''),
  )
}

const emptySvg = (W: number): string => {
  const s = tr()
  return svg(
    W,
    54,
    `${crab(2, 10, 'other', true)}
${txt(44, 24, s.empty, { size: 12.5, weight: 500, cls: 's' })}
${txt(44, 41, fitText(s.emptyHint, 11, W - 46), { size: 11, cls: 'm' })}`,
  )
}

// --- the band's session row: one SVG of labelled figures, dropped by priority as it narrows.

type Seg = { prio: number; w: number; draw: (x: number) => string }

const BAND_Y = 15.5

const figure = (label: string, value: string, prio: number, color?: string): Seg => {
  const lw = label ? textWidth(label, 11.5) + 5 : 0
  return {
    prio,
    w: lw + textWidth(value, 12.5),
    draw: x =>
      (label ? txt(x, BAND_Y, label, { size: 11.5, cls: 'm' }) : '') +
      txt(x + lw, BAND_Y, value, { size: 12.5, weight: 600, num: true, ...(color ? { fill: color } : {}) }),
  }
}

const gauge = (label: string, pct: number, prio: number): Seg => {
  const lw = textWidth(label, 11.5) + 6
  const bw = 30
  const v = fmtPct(pct)
  const color = levelColor(pct)
  return {
    prio,
    w: lw + bw + 6 + textWidth(v, 12.5),
    draw: x =>
      txt(x, BAND_Y, label, { size: 11.5, cls: 'm' }) +
      meterBar(x + lw, 8, bw, 6, pct, color) +
      txt(x + lw + bw + 6, BAND_Y, v, { size: 12.5, weight: 600, num: true, ...(pct >= 70 ? { fill: color } : {}) }),
  }
}

const RATE_PRIO: Record<string, number> = { five_hour: 3, spend_limit: 3, seven_day: 6 }

const bandSegs = (t: Totals, m: MainUsage, mt: Meter): Seg[] => {
  const s = tr()
  const segs: Seg[] = []
  if (m.model) segs.push(figure('', modelName(m.model), 7))
  segs.push(figure(s.cost, (t.isLedger ? '' : '≈') + fmtCost(t.cost), 1))
  segs.push(figure(s.tokens, fmtTokens(t.tokens), 4))
  if (mt.contextTokens !== undefined && mt.contextPercent !== undefined) segs.push(gauge(s.context, mt.contextPercent, 2))
  for (const r of mt.rateLimits) segs.push(gauge(rateLabel(r.kind, true), r.percentUsed, RATE_PRIO[r.kind] ?? 8))
  if (t.sessionMs) segs.push(figure(s.elapsed, fmtSpan(t.sessionMs), 5))
  return segs
}

const bandText = (t: Totals, m: MainUsage, mt: Meter): string => {
  const s = tr()
  const parts: string[] = []
  if (m.model) parts.push(modelName(m.model))
  parts.push(`${s.cost} ${t.isLedger ? '' : '≈'}${fmtCost(t.cost)}`)
  if (mt.contextPercent !== undefined) parts.push(`${s.context} ${fmtPct(mt.contextPercent)}`)
  for (const r of mt.rateLimits) parts.push(`${rateLabel(r.kind, true)} ${fmtPct(r.percentUsed)}`)
  parts.push(`${s.tokens} ${fmtTokens(t.tokens)}`)
  if (t.sessionMs) parts.push(`${s.elapsed} ${fmtSpan(t.sessionMs)}`)
  return parts.join(' · ')
}

const BAND_GAP = 19

// Returns the drawing and its width: the figures that fit, so the button sits right after them.
const statsSvg = (W: number, segs: Seg[], isWorking: boolean): { source: string; width: number } => {
  // Keep the most important figures that fit, then draw them in their own order.
  let used = 16
  const kept = new Set<Seg>()
  for (const seg of [...segs].sort((a, b) => a.prio - b.prio)) {
    const w = seg.w + (kept.size ? BAND_GAP : 0)
    if (used + w > W) continue
    kept.add(seg)
    used += w
  }
  let x = 16
  const body = segs
    .filter(seg => kept.has(seg))
    .map((seg, i) => {
      const sep = i ? `<rect class="k" x="${x + Math.floor(BAND_GAP / 2) - 0.5}" y="5" width="1" height="12"/>` : ''
      if (i) x += BAND_GAP
      const out = sep + seg.draw(x)
      x += seg.w
      return out
    })
    .join('')
  const width = Math.ceil(x + 4)
  return { source: svg(width, H, `<circle${isWorking ? ' class="live"' : ''} cx="5" cy="${H / 2}" r="4" fill="${isWorking ? ACCENT : DONE}"/>${body}`), width }
}

// The task's own progress when the worker reports steps; a finished run is full.
const progressOf = (a: AgentRun): number | null => {
  if (a.status === 'done') return 1
  if (a.stepTotal) return Math.min(1, (a.stepDone ?? 0) / a.stepTotal)
  return null
}

const ctxOf = (a: AgentRun): number => (a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0)

const agentSvg = (W: number, a: AgentRun, at: number, k = 1): string => {
  const s = tr()
  const tier = tierOf(a.type)
  const color = colorOf(tier)
  const ctx = ctxOf(a)
  const textW = W - 42 - 22
  const meta = [a.effort ? `${modelName(a.model)} · ${a.effort}` : modelName(a.model)]
  if (a.round > 1) meta.push(`${s.round} ${a.round}`)
  if (a.status === 'failed') meta.push(s.failed)
  const barW = textW
  const progress = progressOf(a)
  const stats = `ctx ${fmtPct(ctx)} · ${fmtTokens(a.contextTokens)}  ≈${fmtCost(a.costUsd * k)}  ${fmtTime(elapsed(a, at))}`
  const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' · ' + a.stepNote : ''}` : ''
  const stepsW = Math.max(0, barW - textWidth(stats, 11) - 12)
  // Without reported steps the bar falls back to the context, drawn grey.
  const fillW = Math.round(barW * (progress ?? ctx / 100))
  return svg(
    W,
    66,
    `${crab(0, 14, costumeOf(a.type), false, a.status === 'running')}
<text class="t" x="42" y="18" font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(a.description || a.type, 13, textW))}</text>
<text x="42" y="34" font-family="${FONT}" font-size="11"><tspan fill="${color}">${xml(tier === 'other' ? a.type : tier)}</tspan><tspan class="s">  ${xml(meta.join('  ·  '))}</tspan></text>
${steps && stepsW > 30 ? `<text class="t" x="42" y="49" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(fitText(steps, 11, stepsW))}</text>` : ''}
<text class="s" x="${42 + barW}" y="49" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${stats}</text>
<rect class="k" x="42" y="55" width="${barW}" height="4" rx="2"/><rect${progress === null ? ' class="m"' : ''} x="42" y="55" width="${fillW}" height="4" rx="2"${progress === null ? '' : ` fill="${color}"`}/>
${statusMark(W - 8, 16, a.status, color)}
<line class="ln" x1="0" y1="65.5" x2="${W}" y2="65.5"/>`,
  )
}

const plannedSvg = (W: number, p: Planned): string => {
  const tier = p.tier in TIER_COLOR ? p.tier : 'other'
  const color = colorOf(tier)
  const textW = W - 42 - 22
  const meta = [plannedModel(p, tier)]
  if (p.after.length) meta.push(`${tr().after} ${p.after.join(', ')}`)
  return svg(
    W,
    46,
    `${crab(0, 6, tier, true)}
<text class="s" x="42" y="18" font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(`${p.n}. ${p.title}`, 13, textW))}</text>
<text x="42" y="34" font-family="${FONT}" font-size="11"><tspan fill="${color}">${xml(tier)}</tspan><tspan class="m">  ${xml(meta.filter(Boolean).join('  ·  '))}</tspan></text>
${statusMark(W - 8, 16, 'planned', color)}
<line class="ln" x1="0" y1="45.5" x2="${W}" y2="45.5"/>`,
  )
}

const compactSvg = (W: number, list: AgentRun[], planned: Planned[], t: Totals): string => {
  const icons = [
    ...list.filter(a => a.status === 'running').map(a => ({ k: costumeOf(a.type), c: colorOf(tierOf(a.type)), s: 'running', dim: false })),
    ...list.filter(a => a.status !== 'running').map(a => ({ k: costumeOf(a.type), c: colorOf(tierOf(a.type)), s: a.status, dim: false })),
    ...planned.map(p => ({ k: p.tier in TIER_COLOR ? p.tier : 'other', c: colorOf(p.tier), s: 'planned', dim: true })),
  ]
  const fit = Math.max(1, Math.floor((W - 150) / 36))
  const shown = icons.slice(0, fit)
  const more = icons.length - shown.length
  const body = shown
    .map((ic, i) => crab(i * 36, 0, ic.k, ic.dim, ic.s === 'running') + (ic.s === 'running' ? `<circle class="live" cx="${i * 36 + 32}" cy="4" r="3" fill="${ic.c}"/>` : ''))
    .join('')
  const x = shown.length * 36 + (more ? 4 : 0)
  return svg(
    W,
    32,
    `${body}${more ? `<text class="s" x="${x}" y="21" font-family="${FONT}" font-size="12">+${more}</text>` : ''}
<text class="s" x="${W}" y="21" text-anchor="end" font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums">≈${fmtCost(t.cost)} · ${fmtTokens(t.tokens)} · ${fmtTime(t.time)}</text>`,
  )
}

// --- terminal drawing: the same rows in text.

const ctxBar = (pct: number, width: number): string => {
  const filled = Math.round((width * pct) / 100)
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

const STATUS_GLYPH: Record<string, string> = { running: '●', done: '✓', failed: '✗', planned: '◷' }

// Opens the agents pane, or closes it when it is up; true when it ends up open.
async function togglePane($: EngineInterface): Promise<boolean> {
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen) {
    await $.ui.close({ id: PANE })
    return false
  }
  const at = await $.clock.now()
  await update($, now, () => at)
  await $.ui.open({ id: PANE, title: tr().pane })
  void refreshBreakdown($)
  return true
}

const isPaneOpen = async ($: EngineInterface): Promise<boolean> => {
  try {
    return (await $.ui.panes()).some(p => p.id === PANE)
  } catch {
    return false
  }
}

// The engine's figures as `$.session.usage()` and `session.measure` report them.
const meterFrom = (u: {
  context: { tokens?: number; window: number; percent?: number }
  rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[]
  cost?: { usd: number }
}): Partial<Meter> => ({
  contextTokens: u.context.tokens,
  contextWindow: u.context.window,
  contextPercent: u.context.percent,
  rateLimits: rateWindows(u.rateLimits),
  ...(u.cost ? { costUsd: u.cost.usd } : {}),
})

// /context's categories, estimated locally (`summary` sends no request); for the pane only.
async function refreshBreakdown($: EngineInterface): Promise<void> {
  try {
    const at = await $.clock.now()
    await update($, meter, m => ({ ...m, breakdownAt: at }))
    const u = await $.session.usage({ breakdown: 'summary' })
    const b = u.context.breakdown
    await update($, meter, m => ({
      ...m,
      ...meterFrom(u),
      startedAt: u.startedAt,
      ...(b
        ? {
            categories: b.categories.filter(c => !c.isDeferred).map(c => ({ name: c.name, tokens: c.tokens, kind: c.kind })),
            categoriesMax: b.rawMaxTokens,
          }
        : {}),
    }))
  } catch {
    // No session bound or no breakdown on this host: the pane draws the plain fill.
  }
}

async function autoOpen($: EngineInterface, key: string): Promise<void> {
  const p = await read($, panel)
  if (p.autoOpenedFor === key) return
  await update($, panel, prev => ({ ...prev, autoOpenedFor: key }))
  void $.ui.open({ id: PANE, title: tr().pane })
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    lang = await detectLang($, options.language)
    await $.tool.register({
      name: 'progress',
      description:
        'Report /savvy-flow progress to the progress bar above the prompt and the agents panel. ' +
        'Call it after presenting the plan (title, total, tasks, phase "delegate"), each time a task is accepted (done), ' +
        'when switching phase or re-planning (tasks), and once at the end with finished: true. Fields left out keep their previous value.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short name of the overall task, a few words.' },
          total: { type: 'integer', minimum: 0, description: 'Number of planned worker tasks.' },
          done: { type: 'integer', minimum: 0, description: 'Number of tasks accepted after review.' },
          phase: { type: 'string', enum: [...PHASES] },
          finished: { type: 'boolean', description: 'True once the flow is closed.' },
          tasks: {
            type: 'array',
            description:
              'The planned worker tasks in order, numbered from 1. Each title must equal the Agent tool `description` the task will be delegated with, so the panel can match runs to tasks.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'A few words; reused verbatim as the Agent description.' },
                tier: { type: 'string', enum: ['fable', 'heavy', 'careful', 'medium', 'light'] },
                model: {
                  type: 'string',
                  enum: ['haiku', 'sonnet', 'opus', 'fable'],
                  description: 'The model the task is delegated to, when it is not the tier default; shown on the planned row.',
                },
                effort: { type: 'string', enum: ['low', 'medium', 'high', 'xhigh', 'max'] },
                after: { type: 'array', items: { type: 'integer' }, description: 'Numbers of the tasks this one waits for.' },
              },
              required: ['title', 'tier'],
            },
          },
        },
      },
    })
    await $.tool.register({
      name: 'step',
      description:
        'For subagents (savvy-flow workers or any other): report progress on your own task to the agents panel. ' +
        'Right after reading the brief, call it with `total` (your plan in 3-8 steps) and `done: 0`; ' +
        'call it again as each step finishes. Cheap and silent: it only draws a bar.',
      inputSchema: {
        type: 'object',
        properties: {
          done: { type: 'integer', minimum: 0, description: 'Steps finished so far.' },
          total: { type: 'integer', minimum: 1, description: 'Steps planned; may change if the plan changes.' },
          note: { type: 'string', description: 'The step in progress, a few words.' },
        },
        required: ['done'],
      },
    })
    await $.command.register({
      name: 'agents-info',
      description: 'Show or hide the panel of subagents: running, finished and planned, with model, context, cost and time',
    })

    try {
      const u = await $.session.usage()
      await update($, meter, m => ({ ...m, ...meterFrom(u), startedAt: u.startedAt }))
    } catch {
      // No session figures on this host: the band shows the plugin's own estimate.
    }
    const at0 = await $.clock.now()
    await update($, now, () => at0)

    // Every second while the pane is open; otherwise once a minute, which is all
    // the band's coarse session time needs.
    $.clock.every(1000, () => {
      void (async () => {
        const at = await $.clock.now()
        const prev = await read($, now)
        if (Math.floor(at / 60000) === Math.floor(prev / 60000) && !(await isPaneOpen($))) return
        await update($, now, () => at)
      })()
    })
    return started
  })

  // The engine's own figures: context fill, rate-limit windows, the /cost ledger.
  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    await update($, meter, m => ({ ...m, ...meterFrom(e) }))
    if (e.changed.includes('context')) {
      const at = await $.clock.now()
      const m = await read($, meter)
      if (at - (m.breakdownAt ?? 0) > 15000 && (await isPaneOpen($))) void refreshBreakdown($)
    }
    return result
  })

  // Main-loop turns only: a subagent's run raises no turn.start.
  on('turn.start', async ($, e, next) => {
    const at = await $.clock.now()
    await update($, main, m => ({ ...m, turnStartedAt: at }))
    await update($, now, () => at)
    return next(e)
  })

  on('command.run', { command: 'agents-info' }, async $ => {
    const isOpen = await togglePane($)
    return { text: isOpen ? tr().opened : tr().closed }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const input = e as unknown as ProgressInput
    const prev = await read($, flow)
    if (isNewFlow(prev, input) && input.title !== undefined) {
      // A new flow starts with a clean list; agents still running stay.
      await update($, agents, list => list.filter(a => a.status === 'running'))
    }
    const next = await update($, flow, p => merge(p, input))
    if (next && input.tasks?.length) await autoOpen($, next.title)
    return { result: `ok: ${label(next ?? blank())}` }
  })

  // A worker's own progress: the call runs in the worker's loop, so agentId names it.
  on('tool.call', { tool: STEP_TOOL }, async ($, e) => {
    const input = e as unknown as { done?: number; total?: number; note?: string }
    const agentId = e.agentId
    if (!agentId) return { result: 'ignored: only subagents report steps' }
    await update($, agents, list =>
      list.map(a => {
        if (a.agentId !== agentId) return a
        const total = Math.max(0, Math.round(input.total ?? a.stepTotal ?? 0))
        const done = Math.max(0, Math.round(input.done ?? a.stepDone ?? 0))
        return { ...a, stepTotal: total, stepDone: total ? Math.min(total, done) : done, stepNote: input.note?.trim() || undefined }
      }),
    )
    return { result: 'ok' }
  })

  // Safety net: worker launches move the faint layer even if the orchestrator forgets to report.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const type = String(e.subagent_type ?? '')
    if (!type.startsWith('savvy-')) return next(e)

    await update($, flow, prev => {
      const base = prev && !prev.isFinished ? { ...blank(), ...prev } : blank()
      return { ...base, running: base.running + 1, phase: base.phase === 'plan' ? 'delegate' : base.phase }
    })
    try {
      return await next(e)
    } finally {
      await update($, flow, prev => (prev ? { ...prev, running: Math.max(0, prev.running - 1) } : prev))
    }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started

    const at = await $.clock.now()
    await update($, agents, list => {
      const round = 1 + list.filter(a => norm(a.description) === norm(e.description) && e.description).length
      const run: AgentRun = {
        id: started.agentId ?? e.tool_use_id,
        agentId: started.agentId,
        type: e.subagentType,
        description: e.description,
        model: started.model,
        status: 'running',
        startedAt: at,
        contextTokens: 0,
        contextMax: windowOf(started.model),
        tokens: 0,
        costUsd: 0,
        steps: 0,
        round,
      }
      return [...list.filter(a => a.id !== run.id), run].slice(-200)
    })
    await update($, now, () => at)
    const f = await read($, flow)
    const isActive = f !== null && !f.isFinished
    // savvy workers open the panel; while a reported flow runs, any subagent does.
    if (e.subagentType.startsWith('savvy-') || isActive) {
      await autoOpen($, f && !f.isFinished ? f.title : 'savvy-flow')
    }
    return started
  })

  // Each model request of a subagent: live context, tokens and cost.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const agentId = e.agentId
    const usage = result.usage
    if (!usage) return result
    if (!agentId) {
      // The main loop: priced like a subagent so a subscription session sees its API-equivalent cost.
      const model = usage.model || e.model
      const split = splitOf(usage)
      const cost = costOf(model, usage)
      const name = modelName(model)
      await update($, main, m => {
        const prev = m.byModel?.[name] ?? { costUsd: 0, tokens: 0 }
        return {
          ...m,
          model,
          tokens: m.tokens + sumSplit(split),
          costUsd: m.costUsd + cost,
          steps: m.steps + 1,
          split: addSplit(m.split, split),
          byModel: { ...m.byModel, [name]: { costUsd: prev.costUsd + cost, tokens: prev.tokens + sumSplit(split) } },
        }
      })
      return result
    }

    const model = usage.model || e.model
    await update($, agents, list =>
      list.map(a =>
        a.agentId !== agentId
          ? a
          : {
              ...a,
              model,
              effort: typeof e.effort === 'string' ? e.effort : a.effort,
              status: 'running',
              endedAt: undefined,
              contextTokens:
                (usage.input_tokens || 0) +
                (usage.cache_read_input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0) +
                (usage.output_tokens || 0),
              contextMax: windowOf(model),
              tokens:
                a.tokens +
                (usage.input_tokens || 0) +
                (usage.output_tokens || 0) +
                (usage.cache_read_input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0),
              costUsd: a.costUsd + costOf(model, usage),
              steps: a.steps + 1,
              split: addSplit(a.split, splitOf(usage)),
            },
      ),
    )
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId) {
      const at = await $.clock.now()
      await update($, agents, list =>
        list.map(a => {
          if (a.agentId !== agentId) return a
          // A run whose steps went unseen still gets the turn's own sum.
          const fallback = a.steps === 0 && e.usage
          return {
            ...a,
            status: e.reason === 'answer' ? 'done' : 'failed',
            endedAt: at,
            ...(fallback && e.usage
              ? {
                  model: e.usage.model || a.model,
                  tokens:
                    e.usage.input_tokens +
                    e.usage.output_tokens +
                    e.usage.cache_read_input_tokens +
                    e.usage.cache_creation_input_tokens,
                  costUsd: costOf(e.usage.model || a.model, e.usage),
                  split: splitOf(e.usage),
                }
              : {}),
          }
        }),
      )
      await update($, now, () => at)
    } else {
      const at = await $.clock.now()
      await update($, main, m => ({
        ...m,
        activeMs: (m.activeMs ?? 0) + Math.max(0, e.durationMs || (m.turnStartedAt ? at - m.turnStartedAt : 0)),
        turns: (m.turns ?? 0) + 1,
        turnStartedAt: undefined,
      }))
      await update($, now, () => at)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const s = tr()
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const list = await read($, agents)
    const f = await read($, flow)
    const p: Panel = await read($, panel)
    const m = await read($, main)
    const mt = await read($, meter)
    const at = Math.max(await read($, now), ...list.map(a => a.startedAt), 0)

    const running = list.filter(a => a.status === 'running').reverse()
    const finished = list.filter(a => a.status !== 'running').reverse()
    const planned = plannedOf(f, list)
    const t = totals(list, at, m, mt)
    const models = modelRows(m, list, t.k)
    // The pane's title says "Session"; inside, only the flow's own name.
    const title = f && !f.isFinished ? f.title : ''
    const cost = (t.isLedger ? '' : '≈') + fmtCost(t.cost)

    const toggleCompact = (
      <Button
        key="compact"
        label={p.isCompact ? s.expand : s.collapse}
        plain
        dimColor
        onPress={() => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact }))}
      />
    )
    const toggleDone = (
      <Button
        key="done"
        label={`${p.isDoneCollapsed ? '▸' : '▾'} ${s.finished} · ${finished.length}`}
        plain
        dimColor
        onPress={() => update($, panel, prev => ({ ...prev, isDoneCollapsed: !prev.isDoneCollapsed }))}
      />
    )
    const isEmpty = list.length === 0 && planned.length === 0
    const summary = `${cost}, ${fmtTokens(t.tokens)} ${s.tokensWord}, ${fmtTime(t.sessionMs)}`
    const agentsHeader = (
      <Box key="agents-h" flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text bold>
          {s.subagents}
          {list.length ? ` · ${list.length}` : ''}
        </Text>
        {isEmpty ? null : toggleCompact}
      </Box>
    )

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      const section = (key: string, text: string) => (
        <Text key={key} dimColor>
          {text}
        </Text>
      )
      const pct = mt.contextPercent
      const ctxAlt = pct === undefined ? s.noReading : `${fmtPct(pct)}, ${fmtTokens(mt.contextTokens ?? 0)} / ${fmtTokens(mt.contextWindow)}`
      const limitsAlt = mt.rateLimits.map(r => `${rateLabel(r.kind, false)} ${fmtPct(r.percentUsed)}`).join(', ')

      let agentsBody
      if (isEmpty) agentsBody = <Svg key="empty" source={emptySvg(W)} alt={`${s.empty} ${s.emptyHint}`} width={W} height={54} />
      else if (p.isCompact)
        agentsBody = <Svg key="compact" source={compactSvg(W, list, planned, t)} alt={`${list.length} ${s.agentsCount}`} width={W} height={32} />
      else
        agentsBody = (
          <Box key="rows" flexDirection="column">
            {running.length > 0 && section('h-run', `${s.running} · ${running.length}`)}
            {running.map(a => (
              <Svg key={a.id} source={agentSvg(W, a, at, t.k)} alt={`${a.description}: ${modelName(a.model)}, ${s.isRunning}`} width={W} height={66} />
            ))}
            {finished.length > 0 && toggleDone}
            {!p.isDoneCollapsed &&
              finished.map(a => (
                <Svg key={a.id} source={agentSvg(W, a, at, t.k)} alt={`${a.description}: ${modelName(a.model)}, ${s.isFinished}`} width={W} height={66} />
              ))}
            {planned.length > 0 && section('h-plan', `${s.planned} · ${planned.length}`)}
            {planned.map(pl => (
              <Svg key={`plan-${pl.n}`} source={plannedSvg(W, pl)} alt={`${pl.n}. ${pl.title}: ${s.isPlanned}`} width={W} height={46} />
            ))}
          </Box>
        )

      return (
        <Box flexDirection="column" gap={1}>
          {title ? (
            <Text bold wrap="truncate-end">
              {title}
            </Text>
          ) : null}
          <Svg source={heroSvg(W, t)} alt={`${s.sessionCost}: ${summary}`} width={W} height={HERO_H} />
          {mt.rateLimits.length > 0 && (
            <Svg source={limitsSvg(W, mt.rateLimits, at)} alt={`${s.limits}: ${limitsAlt}`} width={W} height={limitsHeight(mt.rateLimits.length)} />
          )}
          <Svg source={contextSvg(W, mt)} alt={`${s.ctxWindow}: ${ctxAlt}`} width={W} height={contextHeight(mt)} />
          <Svg source={tokensSvg(W, t)} alt={`${s.tokenSplit}: ${fmtTokens(t.tokens)}`} width={W} height={tokensHeight(t)} />
          {models.length > 1 && (
            <Svg source={modelsSvg(W, models)} alt={`${s.byModel}: ${models.map(r => `${r.name} ≈${fmtCost(r.costUsd)}`).join(', ')}`} width={W} height={modelsHeight(models.length)} />
          )}
          <Text dimColor>{s.estimate}</Text>
          {agentsHeader}
          {agentsBody}
        </Box>
      )
    }

    // Terminal: the same content in text rows.
    const cols = Math.max(24, e.props.bodyColumns || 40)
    const barW = Math.max(6, Math.min(20, cols - 34))
    const row = (a: AgentRun) => {
      const tier = tierOf(a.type)
      const color = colorOf(tier)
      const ctx = ctxOf(a)
      const progress = progressOf(a)
      const model = a.effort ? `${modelName(a.model)} · ${a.effort}` : modelName(a.model)
      const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' ' + a.stepNote : ''} · ` : ''
      return (
        <Box key={a.id} flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={color}>▣</Text>
            <Text bold wrap="truncate-end">
              {a.description || a.type}
            </Text>
            <Text color={a.status === 'failed' ? 'red' : a.status === 'done' ? 'green' : color}>{STATUS_GLYPH[a.status]}</Text>
          </Box>
          <Text dimColor wrap="truncate-end">
            {'  '}
            {tier === 'other' ? a.type : tier} · {model}
            {a.round > 1 ? ` · ${s.round} ${a.round}` : ''}
          </Text>
          <Text wrap="truncate-end">
            {'  '}
            {progress === null ? <Text dimColor>{ctxBar(ctx, barW)}</Text> : <Text color={color}>{ctxBar(progress * 100, barW)}</Text>}
            <Text dimColor>
              {' '}
              {steps}ctx {fmtPct(ctx)} · {fmtTokens(a.contextTokens)} ≈{fmtCost(a.costUsd * t.k)} {fmtTime(elapsed(a, at))}
            </Text>
          </Text>
        </Box>
      )
    }
    const labelW = Math.max(...mt.rateLimits.map(r => rateLabel(r.kind, true).length), s.context.length)
    const gaugeRow = (key: string, name: string, pct: number, note: string) => (
      <Text key={key} wrap="truncate-end">
        {name.padEnd(labelW)} <Text color={levelColor(pct)}>{ctxBar(pct, barW)}</Text> {fmtPct(pct)}
        <Text dimColor> {note}</Text>
      </Text>
    )
    const total = sumSplit(t.split)
    const prompt = t.split.input + t.split.cacheRead + t.split.cacheWrite

    return (
      <Box flexDirection="column">
        {title ? (
          <Text bold wrap="truncate-end">
            {title}
          </Text>
        ) : null}
        <Text wrap="truncate-end">
          <Text bold>{cost}</Text>
          <Text dimColor>
            {' '}
            {t.isLedger ? '/cost' : s.estimated} · {s.elapsed} {fmtTime(t.sessionMs)} · {s.active} {fmtTime(t.activeMs)}
          </Text>
        </Text>
        <Text dimColor wrap="truncate-end">
          {s.mainSession} ≈{fmtCost(t.mainCost)} · {s.subagents} ≈{fmtCost(t.agentsCost)} · {fmtTokens(t.tokens)} {s.tokensWord}
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {mt.rateLimits.map(r => {
            const left = r.resetsAt ? Date.parse(r.resetsAt) - at : NaN
            return gaugeRow(r.kind, rateLabel(r.kind, true), r.percentUsed, Number.isFinite(left) && left > 0 ? resetsIn(fmtSpan(left)) : '')
          })}
          {mt.contextPercent === undefined ? (
            <Text dimColor>
              {s.context}: {s.noReading}
            </Text>
          ) : (
            gaugeRow('ctx', s.context, mt.contextPercent, `${fmtTokens(mt.contextTokens ?? 0)} / ${fmtTokens(mt.contextWindow)}`)
          )}
        </Box>
        {total > 0 ? (
          <Text dimColor wrap="truncate-end">
            {s.input} {fmtTokens(t.split.input)} · {s.output} {fmtTokens(t.split.output)} · {s.cacheRead} {fmtTokens(t.split.cacheRead)} · {s.cacheWrite}{' '}
            {fmtTokens(t.split.cacheWrite)} · {s.cacheHit} {fmtShare(prompt ? (t.split.cacheRead / prompt) * 100 : 0)}
          </Text>
        ) : null}
        <Text dimColor wrap="truncate-end">
          {s.estimate}
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {agentsHeader}
          {isEmpty ? (
            <Text dimColor>{s.empty}</Text>
          ) : p.isCompact ? (
            <Text wrap="truncate-end">
              {[...running, ...finished].map(a => (
                <Text key={a.id} color={colorOf(tierOf(a.type))}>
                  {STATUS_GLYPH[a.status]}{' '}
                </Text>
              ))}
              {planned.map(pl => (
                <Text key={`plan-${pl.n}`} dimColor>
                  ◷{' '}
                </Text>
              ))}
            </Text>
          ) : (
            <Box flexDirection="column">
              {running.length > 0 && <Text dimColor>{s.running} · {running.length}</Text>}
              {running.map(row)}
              {finished.length > 0 && toggleDone}
              {!p.isDoneCollapsed && finished.map(row)}
              {planned.length > 0 && <Text dimColor>{s.planned} · {planned.length}</Text>}
              {planned.map(pl => {
                const tier = pl.tier in TIER_COLOR ? pl.tier : 'other'
                return (
                  <Box key={`plan-${pl.n}`} flexDirection="column" marginBottom={1}>
                    <Text dimColor wrap="truncate-end">
                      <Text color={colorOf(tier)}>▢</Text> {pl.n}. {pl.title} ◷
                    </Text>
                    <Text dimColor wrap="truncate-end">
                      {'  '}
                      {tier} · {plannedModel(pl, tier)}
                      {pl.after.length ? ` · ${s.after} ${pl.after.join(', ')}` : ''}
                    </Text>
                  </Box>
                )
              })}
            </Box>
          )}
        </Box>
      </Box>
    )
  })

  // The band: the session row in every session, and the flow's progress under it while one runs.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const s = tr()
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const f = await read($, flow)
    const list = await read($, agents)
    const m = await read($, main)
    const mt = await read($, meter)
    const at = Math.max(await read($, now), 0)
    const t = totals(list, at, m, mt)
    const isWorking = e.props.isWorking || list.some(a => a.status === 'running')
    const details = <Button key="savvy-details" label={s.details} plain dimColor onPress={() => void togglePane($)} />

    const crew = f ? list.length + plannedOf(f, list).length : 0
    const crewButton = <Button key="savvy-agents" label={`×${crew}`} plain onPress={() => void togglePane($)} />
    const percent = f ? fmtPct(ratio(f) * 100) : ''
    const dismiss = <Button key="savvy-dismiss" label="✕" plain role="dismiss" onPress={() => update($, flow, () => null)} />

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      // About 8 CSS px per reported column; the rest is the buttons and their gaps.
      // No floor above the slot: a row wider than it would wrap.
      const cols = e.props.bodyColumns || 100
      const stats = statsSvg(Math.max(180, Math.min(1600, cols * 8 - 120)), bandSegs(t, m, mt), isWorking)
      const flowW = Math.max(180, Math.min(1600, cols * 8 - 96))
      return (
        <Box flexDirection="column">
          <Box key="savvy-stats" flexDirection="row" alignItems="center" gap={1}>
            <Svg source={stats.source} alt={bandText(t, m, mt)} width={stats.width} height={H} />
            {details}
          </Box>
          {f && (
            <Box key="savvy-flow" flexDirection="row" alignItems="center" gap={1}>
              <Svg source={rowSvg(f, flowW, list.some(a => a.status === 'running'))} alt={`${f.title}: ${label(f)}, ${percent}`} width={flowW} height={H} />
              {crewButton}
              {dismiss}
            </Box>
          )}
        </Box>
      )
    }

    const cols = e.props.bodyColumns
    const statsRow = (
      <Box key="savvy-stats" flexDirection="row" gap={1}>
        <Text color={isWorking ? ACCENT : DONE}>●</Text>
        <Box flexGrow={1} flexShrink={1}>
          <Text dimColor wrap="truncate-end">
            {bandText(t, m, mt)}
          </Text>
        </Box>
        {details}
      </Box>
    )
    if (!f) return statsRow

    const titleW = Math.max(8, Math.min(30, f.title.length + 2, Math.floor(cols / 3)))
    const width = Math.max(6, Math.min(40, cols - titleW - 32))
    return (
      <Box flexDirection="column">
        {statsRow}
        <Box key="savvy-flow" flexDirection="row" gap={2}>
          <Box width={titleW} flexShrink={0}>
            <Text color={f.isFinished ? DONE : ACCENT}>● </Text>
            <Text wrap="truncate-end">{f.title}</Text>
          </Box>
          <Text color={f.isFinished ? DONE : ACCENT}>{barText(f, width)}</Text>
          <Text bold>{label(f)}</Text>
          <Text dimColor>{percent}</Text>
          <Text color={CLAY}>▣</Text>
          {crewButton}
          {dismiss}
        </Box>
      </Box>
    )
  })
}
