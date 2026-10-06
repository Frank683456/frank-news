import { useEffect, useState } from 'react'
import { Briefing, moodColor, moodLabel } from '../framework/briefing'
import { BlockView } from '../framework/BriefingBlocks'
import { Skeleton } from '../framework/Section'

type State =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: Briefing }
  | { status: 'notfound' }

// 小标题去掉模型带的 emoji 前缀（数据里有 icon 字段，标题本身偶尔也带）
const stripEmoji = (s: string) => s.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '')

/** 滚动位置 → 阅读进度（0–1）+ 当前所在板块序号 */
function useReadingState(count: number, ready: boolean) {
  const [progress, setProgress] = useState(0)
  const [current, setCurrent] = useState(-1)
  useEffect(() => {
    if (!ready) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const doc = document.documentElement
        const max = doc.scrollHeight - window.innerHeight
        setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0)
        let cur = -1
        for (let i = 0; i < count; i++) {
          const el = document.getElementById(`sec-${i}`)
          if (el && el.getBoundingClientRect().top < 120) cur = i
        }
        setCurrent(cur)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [count, ready])
  return { progress, current }
}

// 路由用的是 #/briefing/...，不能用 #锚点 跳转，改成点击后滚动
function jumpTo(i: number) {
  const el = document.getElementById(`sec-${i}`)
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: 'smooth' })
}

function PrevNext({ prev, next }: { prev: string | null; next: string | null }) {
  return (
    <div className="article-pn">
      {prev ? <a href={`#/briefing/${prev}`}>← 上一期 · {prev}</a> : <span />}
      {next ? <a href={`#/briefing/${next}`}>下一期 · {next} →</a> : <span />}
    </div>
  )
}

export default function BriefingDetail({ date }: { date: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [dates, setDates] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    window.scrollTo(0, 0)
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

  const sections = state.status === 'ready' ? state.data.sections : []
  const { progress, current } = useReadingState(sections.length, state.status === 'ready')

  const currentDate = state.status === 'ready' ? state.data.date : date
  const idx = dates.indexOf(currentDate)
  const prev = idx >= 0 && idx < dates.length - 1 ? dates[idx + 1] : null
  const next = idx > 0 ? dates[idx - 1] : null

  if (state.status === 'loading') {
    return <div className="article"><Skeleton rows={12} tall /></div>
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
  const accent = d.mood ? moodColor[d.mood] : 'var(--mood-neutral)'

  return (
    <>
      <div className="read-progress" style={{ transform: `scaleX(${progress})`, background: accent }} />
      <div className={`read-bar ${current >= 0 ? 'on' : ''}`}>
        <a href="#/" className="rb-home">← 晨报</a>
        <span className="rb-cur">
          {current >= 0 && (
            <>
              <b>{String(current + 1).padStart(2, '0')}</b> {stripEmoji(sections[current].title)}
            </>
          )}
        </span>
        <span className="rb-date">{d.date}</span>
      </div>

      <article className="article" style={{ ['--mood' as string]: accent }}>
        <div className="article-nav">
          <a href="#/">← 返回首页</a>
          <div style={{ display: 'flex', gap: 12 }}>
            {prev && <a href={`#/briefing/${prev}`}>← {prev}</a>}
            {next && <a href={`#/briefing/${next}`}>{next} →</a>}
          </div>
        </div>

        <div className="article-meta">
          <span>{d.date}</span>
          {d.mood && (
            <span className="hero-mood" style={{ ['--mood' as string]: accent }}>
              <i />市场情绪 · {moodLabel[d.mood]}
            </span>
          )}
        </div>
        <h1>{d.title}</h1>
        {d.subtitle && <div className="article-sub">{d.subtitle}</div>}

        {d.highlights && d.highlights.length > 0 && (
          <ol className="hero-points article-points">
            {d.highlights.map((h, i) => (
              <li key={i}>
                <span className="hp-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="hp-t">{h}</span>
              </li>
            ))}
          </ol>
        )}

        {sections.length > 1 && (
          <nav className="toc" aria-label="本期目录">
            <div className="toc-k">本期目录</div>
            <ol>
              {sections.map((s, i) => (
                <li key={s.id}>
                  <button type="button" onClick={() => jumpTo(i)} className={current === i ? 'on' : ''}>
                    <span className="toc-n">{String(i + 1).padStart(2, '0')}</span>
                    {stripEmoji(s.title)}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {sections.map((s, i) => (
          <section key={s.id} id={`sec-${i}`}>
            <h2>
              <span className="sec-n">{String(i + 1).padStart(2, '0')}</span>
              {stripEmoji(s.title)}
            </h2>
            {s.blocks.map((b, j) => <BlockView key={j} block={b} />)}
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

        <PrevNext prev={prev} next={next} />
        <div className="article-back">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑ 回到顶部</button>
          <a href="#/">返回首页</a>
        </div>
      </article>
    </>
  )
}
