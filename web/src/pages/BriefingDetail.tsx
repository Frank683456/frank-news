import { useEffect, useState } from 'react'
import { Briefing, moodColor } from '../framework/briefing'
import { BlockView } from '../framework/BriefingBlocks'

type State =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: Briefing }
  | { status: 'notfound' }

export default function BriefingDetail({ date }: { date: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [dates, setDates] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    const file = date === 'latest' ? 'briefing-latest.json' : `briefing-${date}.json`
    ;(async () => {
      try {
        const res = await fetch(`/data/${file}?t=${Date.now()}`)
        if (res.status === 404) { if (!cancelled) setState({ status: 'notfound' }); return }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as Briefing
        if (!cancelled) setState({ status: 'ready', data })
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: e instanceof Error ? e.message : 'failed' })
      }
    })()
    ;(async () => {
      try {
        const r = await fetch('/data/archive.json')
        if (r.ok) {
          const d = (await r.json()) as { dates: string[] }
          if (!cancelled) setDates(d.dates)
        }
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [date])

  const currentDate = state.status === 'ready' ? state.data.date : date
  const idx = dates.indexOf(currentDate)
  const prev = idx >= 0 && idx < dates.length - 1 ? dates[idx + 1] : null
  const next = idx > 0 ? dates[idx - 1] : null

  if (state.status === 'loading') {
    return <div className="article"><div className="loading">加载中…</div></div>
  }
  if (state.status === 'notfound') {
    return (
      <div className="article">
        <div className="article-nav"><a href="#/">← 返回首页</a></div>
        <div className="empty">未找到 {date} 的晨报。</div>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="article">
        <div className="article-nav"><a href="#/">← 返回首页</a></div>
        <div className="error">{state.error}</div>
      </div>
    )
  }

  const d = state.data
  const accent = d.mood ? moodColor[d.mood] : 'var(--text-soft)'

  return (
    <article
      className="article"
      style={{
        borderLeft: `3px solid ${accent}`,
        borderRight: `3px solid ${accent}`,
        paddingLeft: 28,
        paddingRight: 28,
      }}
    >
      <div className="article-nav">
        <a href="#/">← 返回首页</a>
        <div style={{ display: 'flex', gap: 12 }}>
          {prev && <a href={`#/briefing/${prev}`}>← {prev}</a>}
          {next && <a href={`#/briefing/${next}`}>{next} →</a>}
        </div>
      </div>

      <div className="article-meta">{d.date}</div>
      <h1>{d.title}</h1>
      {d.subtitle && <div className="article-sub">{d.subtitle}</div>}

      {d.highlights && d.highlights.length > 0 && (
        <div className="highlights">
          {d.highlights.map((h, i) => <span key={i} className="chip">{h}</span>)}
        </div>
      )}

      {d.sections.map((s) => (
        <section key={s.id}>
          <h2>
            {s.icon && <span style={{ marginRight: 8 }}>{s.icon}</span>}
            {s.title}
          </h2>
          {s.blocks.map((b, i) => <BlockView key={i} block={b} />)}
        </section>
      ))}

      {d.sources && d.sources.length > 0 && (
        <div className="sources">
          来源：
          {d.sources.map((src, i) => (
            <a key={i} href={src.url} target="_blank" rel="noopener noreferrer">{src.name}</a>
          ))}
        </div>
      )}
    </article>
  )
}
