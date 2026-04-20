import { useJson } from '../framework/useJson'
import { Briefing } from '../framework/briefing'

export default function BriefingHero() {
  const { status, data, error } = useJson<Briefing>('/data/briefing-latest.json', 5 * 60_000)

  if (status === 'loading') {
    return (
      <section className="hero">
        <div className="hero-kicker">今日 · 头条</div>
        <div className="hero-empty">晨报加载中…</div>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="hero">
        <div className="hero-kicker">今日 · 头条</div>
        <div className="hero-error">晨报尚未生成 · {error}</div>
      </section>
    )
  }

  return (
    <section className="hero">
      <div className="hero-kicker">今日 · 头条 · {data.date}</div>
      <h2 className="hero-title">{data.title}</h2>
      {data.subtitle && <p className="hero-dek">{data.subtitle}</p>}
      {data.highlights && data.highlights.length > 0 && (
        <div className="hero-highlights">
          {data.highlights.map((h, i) => (
            <span key={i} className="chip">{h}</span>
          ))}
        </div>
      )}
      <a href={`#/briefing/${data.date}`} className="hero-cta">
        阅读全文 →
      </a>
    </section>
  )
}
