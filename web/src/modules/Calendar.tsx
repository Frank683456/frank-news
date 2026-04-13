import { Card } from '../framework/Card'
import { useJson } from '../framework/useJson'

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

function EventList({ items, limit }: { items: Event[]; limit: number }) {
  const rows = items.slice(0, limit)
  return (
    <div>
      {rows.map((e, i) => {
        const n = daysUntil(e.date)
        const urgent = n >= 0 && n < 7
        return (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '5px 0', fontSize: 13,
            borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span>{stripFlag(e.name)}</span>
            <span className={`num ${urgent ? '' : 'muted'}`} style={{ color: urgent ? 'var(--warn)' : undefined }}>
              {n > 0 ? `${n} 天` : n === 0 ? '今天' : `已过 ${-n} 天`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="muted" style={{
      fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
      marginTop: 10, marginBottom: 4,
    }}>
      {label}
    </div>
  )
}

export default function Calendar() {
  const { status, data, updatedAt, stale, error } = useJson<CalData>('/data/calendar.json', 60 * 60_000)
  return (
    <Card title="倒计时" size="m" updatedAt={updatedAt} stale={stale}>
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && data.events.length === 0 && <div className="empty">暂无事件</div>}
      {status === 'ready' && data.events.length > 0 && (() => {
        const cn = data.events.filter((e) => groupOf(e.name) === 'cn')
        const us = data.events.filter((e) => groupOf(e.name) === 'us')
        const other = data.events.filter((e) => groupOf(e.name) === 'other')
        return (
          <div>
            {cn.length > 0 && (<><SectionHeader label="🇨🇳 CN" /><EventList items={cn} limit={4} /></>)}
            {us.length > 0 && (<><SectionHeader label="🇺🇸 US" /><EventList items={us} limit={4} /></>)}
            {other.length > 0 && (<><SectionHeader label="其他" /><EventList items={other} limit={4} /></>)}
          </div>
        )
      })()}
    </Card>
  )
}
