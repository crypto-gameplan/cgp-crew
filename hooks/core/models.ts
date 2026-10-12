// What a run costs: a static price table (USD per million tokens), so the panel's figure is an estimate, not a bill.
// Rates from the Claude API price list of 2026-10; cache writes are the 5-minute rate, 1.25x input.

export type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

type Rate = { input: number; output: number; cacheRead: number; window: number }

// First match wins, so the specific ids come before their family.
const RATES: [RegExp, Rate][] = [
  [/fable|mythos/, { input: 10, output: 50, cacheRead: 0.25, window: 1_000_000 }],
  [/opus-5-5/, { input: 4, output: 20, cacheRead: 0.2, window: 1_000_000 }],
  [/opus/, { input: 5, output: 25, cacheRead: 0.5, window: 1_000_000 }],
  [/sonnet-4/, { input: 3, output: 15, cacheRead: 0.3, window: 1_000_000 }],
  [/sonnet/, { input: 2, output: 10, cacheRead: 0.2, window: 1_000_000 }],
  [/haiku-4/, { input: 1, output: 5, cacheRead: 0.1, window: 200_000 }],
  [/haiku/, { input: 0.1, output: 0.5, cacheRead: 0.01, window: 1_000_000 }],
]

// An unknown id is priced and sized like the current Opus.
const FALLBACK: Rate = { input: 4, output: 20, cacheRead: 0.2, window: 1_000_000 }

const rateOf = (model: string): Rate => {
  const id = model.toLowerCase()
  return RATES.find(([pattern]) => pattern.test(id))?.[1] ?? FALLBACK
}

const n = (v: number | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** Every token one request moved: input, output and both cache directions. */
export const tokensOf = (u: Usage): number =>
  n(u.input_tokens) + n(u.output_tokens) + n(u.cache_read_input_tokens) + n(u.cache_creation_input_tokens)

export const costOf = (model: string, u: Usage): number => {
  const r = rateOf(model)
  const usd =
    n(u.input_tokens) * r.input +
    n(u.output_tokens) * r.output +
    n(u.cache_read_input_tokens) * r.cacheRead +
    n(u.cache_creation_input_tokens) * r.input * 1.25
  return usd / 1e6
}

export const windowOf = (model: string): number => rateOf(model).window

/** `claude-opus-5-5` → `Opus 5.5`; an id outside the known families is shown bare. */
export const modelLabel = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  if (!m) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '?'
  const [, family = '', major = '', minor] = m
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? `.${minor}` : ''}`
}
