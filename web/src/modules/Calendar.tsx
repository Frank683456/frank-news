import { useJson } from '../framework/useJson'
import { ColHead } from '../framework/Section'

type Event = { name: string; date: string }
type CalData = { events: Event[]; updatedAt: string }

function daysUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function groupOf(name: string): 'cn' | 'us' | 'other' {
  if (name.startsWith('🇨🇳')) return 'cn'
  if (name.startsWith('🇺🇸')) return 'us'
  return 'other'
}

function stripFlag(name: string): string {
  return name.replace(/^🇨🇳\s*|^🇺🇸\s*/, '')
}

function Group({ label, items, limit }: { label: string; items: Event[]; limit: number }) {
  const rows = items.slice(0, limit)
  if (rows.length === 0) return null
  return (
    <>
      <div className="cd-group">{label}</div>
      {rows.map((e, i) => {
        const n = daysUntil(e.date)
        const urgent = n >= 0 && n < 7
        const past = n < 0
        return (
          <div key={i} className="cd-i">
            <div className="cd-n">{stripFlag(e.name)}</div>
            <div className={`cd-d ${urgent ? 'urgent' : ''} ${past ? 'past' : ''}`}>
              {n > 0 ? (
                <>
                  {n}
                  <small>天</small>
                </>
              ) : n === 0 ? (
                <>
                  今
                  <small>天</small>
                </>
              ) : (
                <>
                  {-n}
                  <small>天前</small>
                </>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

export default function Calendar() {
  const { status, data, updatedAt, stale, error } = useJson<CalData>('/data/calendar.json', 60 * 60_000)

  const total = status === 'ready' ? data.events.length : 0

  return (
    <>
      <ColHead
        eyebrow="Countdown · 节日"
        title="节日倒计时"
        meta={total > 0 ? `${total} 项` : undefined}
        updatedAt={updatedAt}
        stale={stale}
      />
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && data.events.length === 0 && <div className="empty">暂无事件</div>}
      {status === 'ready' && data.events.length > 0 && (
        <div>
          <Group label="CN · 中国" items={data.events.filter((e) => groupOf(e.name) === 'cn')} limit={4} />
          <Group label="US · 美国" items={data.events.filter((e) => groupOf(e.name) === 'us')} limit={4} />
          <Group label="Other · 其他" items={data.events.filter((e) => groupOf(e.name) === 'other')} limit={4} />
        </div>
      )}
    </>
  )
}
