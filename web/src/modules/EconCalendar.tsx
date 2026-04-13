import { Card } from '../framework/Card'
import { useJson } from '../framework/useJson'

type Event = { date: string; time?: string; country: string; name: string; importance: number }
type EconData = { events: Event[]; updatedAt: string }

export default function EconCalendar() {
  const { status, data, updatedAt, stale, error } = useJson<EconData>('/data/econ.json', 60 * 60_000)
  return (
    <Card title="经济日历" size="l" updatedAt={updatedAt} stale={stale}>
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && data.events.length === 0 && <div className="empty">近期无重要事件</div>}
      {status === 'ready' && data.events.length > 0 && (
        <div>
          {data.events.slice(0, 8).map((e, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, padding: '8px 0',
              borderBottom: i < 7 ? '1px solid var(--border)' : 'none',
              fontSize: 13,
            }}>
              <div className="num muted" style={{ width: 90 }}>
                {e.date.slice(5).replace('-', '/')} {e.time || ''}
              </div>
              <div className="dim" style={{ width: 32 }}>{e.country}</div>
              <div style={{ flex: 1 }}>{e.name}</div>
              <div className="dim" style={{ fontSize: 11 }}>{'●'.repeat(e.importance)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
