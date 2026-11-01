import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Call, Counts, Outcome, Tokens } from '../types'

const PANE = 'activity'
const TITLE = 'Activity'
const MAX_RECENT = 100

const startedAt = atom({ plugin: 'activity', key: 'startedAt' } as const, 0, { shape: 'startedAt-1' })
const now = atom({ plugin: 'activity', key: 'now' } as const, 0, { shape: 'now-1' })
const counts = atom(
  { plugin: 'activity', key: 'counts' } as const,
  { prompts: 0, calls: 0, errors: 0 } as Counts,
  { shape: 'counts-1' },
)
const byTool = atom({ plugin: 'activity', key: 'byTool' } as const, {} as Record<string, number>, {
  shape: 'byTool-1',
})
const recent = atom({ plugin: 'activity', key: 'recent' } as const, [] as Call[], { shape: 'recent-1' })
const tokens = atom(
  { plugin: 'activity', key: 'tokens' } as const,
  { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } as Tokens,
  { shape: 'tokens-1' },
)
const background = atom({ plugin: 'activity', key: 'background' } as const, '', { shape: 'background-1' })

const slash = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')

const configDirs = async ($: EngineInterface) => {
  const dirs: string[] = []
  const fromEnv = await $.env.get('CLAUDE_CONFIG_DIR')
  if (fromEnv) dirs.push(slash(fromEnv))
  const home = await $.env.get('HOME')
  if (home) dirs.push(`${slash(home)}/.claude`)
  const profile = await $.env.get('USERPROFILE')
  if (profile) dirs.push(`${slash(profile)}/.claude`)
  const root = slash($.plugin.root)
  const i = root.lastIndexOf('/.claude/')
  if (i >= 0) dirs.push(root.slice(0, i + '/.claude'.length))
  return [...new Set(dirs)]
}

const currentTheme = async ($: EngineInterface) => {
  try {
    const fromSettings: unknown = await $.settings.read({ key: 'theme' })
    if (typeof fromSettings === 'string') return fromSettings
  } catch {}
  try {
    const row = (await $.config.list()).find(r => r.key === 'theme')?.value
    if (typeof row === 'string') return row
  } catch {}
  return undefined
}

const loadBackground = async ($: EngineInterface) => {
  const theme = await currentTheme($)
  if (!theme?.startsWith('custom:')) {
    await update($, background, () => '')
    return
  }
  const name = theme.slice('custom:'.length)
  const tried: string[] = []
  for (const dir of await configDirs($)) {
    const file = `${dir}/themes/${name}.json`
    tried.push(file)
    try {
      const color: unknown = JSON.parse(await $.fs.read(file)).overrides?.background
      if (typeof color === 'string') {
        await update($, background, () => color)
        return
      }
    } catch {}
  }
  await update($, background, () => '')
  $.ui.log(`activity: no background found for theme "${name}" (tried ${tried.join(', ') || 'no folders'})`, {
    to: 'debug',
  })
}

const T = {
  title: 'claude',
  rule: 'promptBorder',
  label: 'inactive',
  value: 'text',
  input: 'suggestion',
  output: 'permission',
  ok: 'success',
  warn: 'warning',
  error: 'error',
} as const

const duration = (ms: number) => {
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'under a minute'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

const compact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

const COLOR: Record<Outcome, string> = { running: T.warn, ok: T.ok, error: T.error, denied: T.label }
const SYMBOL: Record<Outcome, string> = { running: '…', ok: '✓', error: '✗', denied: '⊘' }

let isBackgroundLoaded = false

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'activity', description: 'Open the Activity pane' })
    const t = await $.clock.now()
    await update($, startedAt, v => (v === 0 ? t : v))
    await update($, now, () => t)
    isBackgroundLoaded = true
    await loadBackground($)
    $.clock.every(30000, async () => {
      const t2 = await $.clock.now()
      await update($, now, () => t2)
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'activity' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Activity pane opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!e.command) await update($, counts, c => ({ ...c, prompts: c.prompts + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const id = e.tool_use_id
    await update($, recent, l => [...l, { id, tool: e.tool, outcome: 'running' as Outcome }].slice(-MAX_RECENT))
    await update($, counts, c => ({ ...c, calls: c.calls + 1 }))
    await update($, byTool, m => ({ ...m, [e.tool]: (m[e.tool] ?? 0) + 1 }))

    const ran = await next(e)
    const outcome: Outcome = ran.deny !== undefined ? 'denied' : ran.isError ? 'error' : 'ok'
    await update($, recent, l => l.map(c => (c.id === id ? { ...c, outcome } : c)))
    if (outcome === 'error') await update($, counts, c => ({ ...c, errors: c.errors + 1 }))

    return ran
  }).catch(($, e, next) => next(e))

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const ran = await next(e)
    await loadBackground($)

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    const u = e.usage
    if (u) {
      await update($, tokens, t => ({
        input: t.input + u.input_tokens,
        output: t.output + u.output_tokens,
        cacheRead: t.cacheRead + u.cache_read_input_tokens,
        cacheWrite: t.cacheWrite + u.cache_creation_input_tokens,
      }))
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (!isBackgroundLoaded) {
      isBackgroundLoaded = true
      void loadBackground($)
    }
    const els = $.ui.resolve(e)
    const { Box, Text } = els
    const Client = 'Client' in els ? els.Client : undefined
    const [t0, t, c, tools, list, tok, usage, bgRaw] = await Promise.all([
      read($, startedAt),
      read($, now),
      read($, counts),
      read($, byTool),
      read($, recent),
      read($, tokens),
      $.session.usage().catch(() => undefined),
      read($, background),
    ])
    const bg = bgRaw || undefined
    const top = Object.entries(tools)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    const bodyRows = e.props.scroll.bodyRows
    const bodyCols = e.props.bodyColumns
    const isDocked = e.props.placement === 'dock'
    const rows = bodyRows
    const cols = bodyCols - 2
    const showMascot = Client !== undefined && rows >= 24
    const room = Math.max(1, rows - 18 - top.length - (showMascot ? 7 : 0))

    const ctx = usage?.context
    const pct = ctx?.percent ?? 0
    const ctxColor = pct < 60 ? T.ok : pct < 85 ? T.warn : T.error
    const barWidth = Math.max(8, Math.min(30, cols - 10))
    const filled = Math.round((pct / 100) * barWidth)

    const Heading = ({ text }: { text: string }) => (
      <Text>
        <Text weight="bold" color={T.title}>{text} </Text>
        <Text color={T.rule}>{'─'.repeat(Math.max(2, Math.min(40, cols - text.length - 3)))}</Text>
      </Text>
    )
    const Row = ({ name, value, color }: { name: string; value: string; color?: string }) => (
      <Text>
        <Text color={T.label}>{name} </Text>
        <Text color={color ?? T.value}>{value}</Text>
      </Text>
    )

    return (
      <Box
        flexDirection="column"
        backgroundColor={bg}
        width={bodyCols}
        minHeight={isDocked ? bodyRows : undefined}
        paddingX={1}
      >
        {showMascot && Client && (
          <Box flexShrink={0} height={7}>
            <Client key="mascot" module="./mascot.tsx" props={{ background: bgRaw }} width="100%" height={7} />
          </Box>
        )}
        <Heading text="Session" />
        <Row name="Duration" value={t0 > 0 ? duration(t - t0) : '—'} />
        <Text>
          <Text color={T.label}>Prompts </Text>
          <Text color={T.value}>{c.prompts}</Text>
          <Text color={T.label}>  Tools </Text>
          <Text color={T.value}>{c.calls}</Text>
          <Text color={T.label}>  Errors </Text>
          <Text color={c.errors > 0 ? T.error : T.value}>{c.errors}</Text>
        </Text>
        <Text> </Text>
        <Heading text="Tokens" />
        <Text>
          <Text color={T.label}>Context </Text>
          <Text color={ctxColor}>{'█'.repeat(filled)}</Text>
          <Text color={T.rule}>{'░'.repeat(barWidth - filled)}</Text>
          <Text color={ctxColor}> {ctx?.percent !== undefined ? `${pct}%` : '—'}</Text>
        </Text>
        {ctx && <Row name="       " value={`${compact(ctx.tokens ?? 0)} / ${compact(ctx.window)}`} color={T.label} />}
        <Text>
          <Text color={T.label}>Input </Text>
          <Text color={T.input}>{compact(tok.input)}</Text>
          <Text color={T.label}>  Output </Text>
          <Text color={T.output}>{compact(tok.output)}</Text>
        </Text>
        <Text>
          <Text color={T.label}>Cache read </Text>
          <Text color={T.value}>{compact(tok.cacheRead)}</Text>
          <Text color={T.label}>  write </Text>
          <Text color={T.value}>{compact(tok.cacheWrite)}</Text>
        </Text>
        {usage?.cost && <Row name="Cost" value={`$${usage.cost.usd.toFixed(2)}`} color={T.warn} />}
        <Text> </Text>
        <Heading text="Most used" />
        {top.length === 0 && <Text color={T.label}>None yet.</Text>}
        {top.map(([name, n]) => (
          <Text>
            <Text color={T.value}>{name}</Text>
            <Text color={T.label}> ×{n}</Text>
          </Text>
        ))}
        <Text> </Text>
        <Heading text="Recent activity" />
        {list.length === 0 && <Text color={T.label}>None yet.</Text>}
        {list
          .slice(-room)
          .reverse()
          .map(x => (
            <Text>
              <Text color={COLOR[x.outcome]}>{SYMBOL[x.outcome]}</Text>
              <Text color={T.value}> {x.tool}</Text>
            </Text>
          ))}
      </Box>
    )
  })
}
