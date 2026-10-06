import { useJson } from '../framework/useJson'
import { Briefing, moodColor, moodLabel } from '../framework/briefing'

export default function BriefingHero() {
  const { status, data, error } = useJson<Briefing>('/data/briefing-latest.json', 5 * 60_000)

  if (status === 'loading') {
    return (
      <section className="hero">
        <div className="hero-kicker">今日 · 头条</div>
        <div className="skel hero-skel" aria-busy="true">
          <span className="skel-bar" style={{ width: '70%', height: 44 }} />
          <span className="skel-bar" style={{ width: '45%' }} />
        </div>
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

  const mood = data.mood
  return (
    <section className="hero">
      <div className="hero-kicker">
        <span>今日 · 头条 · {data.date}</span>
        {mood && (
          <span className="hero-mood" style={{ ['--mood' as string]: moodColor[mood] }}>
            <i />市场情绪 · {moodLabel[mood]}
          </span>
        )}
      </div>
      <h2 className="hero-title">{data.title}</h2>
      {data.subtitle && <p className="hero-dek">{data.subtitle}</p>}
      {data.highlights && data.highlights.length > 0 && (
        <ol className="hero-points">
          {data.highlights.slice(0, 5).map((h, i) => (
            <li key={i}>
              <span className="hp-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="hp-t">{h}</span>
            </li>
          ))}
        </ol>
      )}
      <a href={`#/briefing/${data.date}`} className="hero-cta">
        阅读全文 <span aria-hidden="true">→</span>
      </a>
    </section>
  )
}
