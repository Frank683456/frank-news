import { Card } from '../framework/Card'
import { useJson } from '../framework/useJson'
import { Briefing, moodColor } from '../framework/briefing'

export default function BriefingTeaser() {
  const { status, data, updatedAt, stale, error } = useJson<Briefing>(
    '/data/briefing-latest.json',
    5 * 60_000,
  )
  const accent = data?.mood ? moodColor[data.mood] : 'var(--text-soft)'

  return (
    <Card title="今日晨报" size="full" updatedAt={updatedAt} stale={stale}>
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="empty">晨报尚未生成 · {error}</div>}
      {status === 'ready' && (
        <div className="briefing-teaser" style={{ ['--mood-accent' as string]: accent }}>
          <div className="muted" style={{ fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>
            {data.date}
          </div>
          <h2>{data.title}</h2>
          {data.subtitle && <div className="sub">{data.subtitle}</div>}

          {data.highlights && data.highlights.length > 0 && (
            <div className="highlights">
              {data.highlights.map((h, i) => (
                <span key={i} className="chip">{h}</span>
              ))}
            </div>
          )}

          <a href={`#/briefing/${data.date}`} className="read-more">
            阅读全文 →
          </a>
        </div>
      )}
    </Card>
  )
}
