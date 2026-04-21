import { useJson } from '../framework/useJson'
import { ColHead } from '../framework/Section'

type Event = { date: string; time?: string; country: string; name: string; importance: number }
type EconData = { events: Event[]; updatedAt: string }

export default function EconCalendar() {
  const { status, data, updatedAt, stale, error } = useJson<EconData>('/data/econ.json', 60 * 60_000)

  return (
    <>
      <ColHead
        eyebrow="Calendar · 本周"
        title="经济日历"
        meta={status === 'ready' ? `${data.events.length} 项` : undefined}
        updatedAt={updatedAt}
        stale={stale}
      />
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && data.events.length === 0 && <div className="empty">近期无重要事件</div>}
      {status === 'ready' && data.events.length > 0 && (
        <div>
          {data.events.slice(0, 12).map((e, i) => (
            <div key={i} className="cal-i">
              <div className="cal-d">
                {e.date.slice(5).replace('-', '/')} {e.time || ''}
              </div>
              <div className="cal-f">{e.country}</div>
              <div className="cal-n">{e.name}</div>
              <div className="cal-dots">
                {[0, 1, 2].map((n) => (
                  <span key={n} className={`cal-dot ${n < e.importance ? 'on' : ''}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
