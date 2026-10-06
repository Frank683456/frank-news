import { useJson } from '../framework/useJson'
import { ColHead, Skeleton } from '../framework/Section'

type Event = { name: string; date: string }
type CalData = { events: Event[]; updatedAt: string }

/** 按浏览器本地日历日算还有几天（不受时区/几点钟影响）：今天=0，明天=1，昨天=-1。 */
function daysUntil(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  const target = new Date(y, m - 1, day)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function groupOf(name: string): 'cn' | 'us' | 'other' {
  if (name.startsWith('🇨🇳')) return 'cn'
  if (name.startsWith('🇺🇸')) return 'us'
  return 'other'
}

const GROUP_LABEL = { cn: '中国', us: '美国', other: '其他' }

function stripFlag(name: string): string {
  return name.replace(/^🇨🇳\s*|^🇺🇸\s*/, '')
}

function fmtDate(d: string) {
  const [, m, day] = d.split('-')
  return `${Number(m)} 月 ${Number(day)} 日`
}

function Group({ label, items }: { label: string; items: (Event & { n: number })[] }) {
  if (items.length === 0) return null
  return (
    <>
      <div className="cd-group">{label}</div>
      {items.map((e) => (
        <div key={e.name + e.date} className="cd-i">
          <div className="cd-n">{stripFlag(e.name)}</div>
          <div className={`cd-d ${e.n < 7 ? 'urgent' : ''}`}>
            {e.n === 0 ? '今天' : <>{e.n}<small>天</small></>}
          </div>
        </div>
      ))}
    </>
  )
}

export default function Calendar() {
  const { status, data, updatedAt, stale, error } = useJson<CalData>('/data/calendar.json', 60 * 60_000)

  // 「过一个少一个」：过了的节日不显示
  const events = (status === 'ready' ? data.events : [])
    .map((e) => ({ ...e, n: daysUntil(e.date) }))
    .filter((e) => e.n >= 0)
    .sort((a, b) => a.n - b.n)
  const [next, ...rest] = events

  return (
    <>
      <ColHead
        eyebrow="Countdown · 节日"
        title="节日倒计时"
        meta={events.length > 0 ? `${events.length} 项` : undefined}
        updatedAt={updatedAt}
        stale={stale}
      />
      {status === 'loading' && <Skeleton rows={7} />}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && events.length === 0 && <div className="empty">今年的节日都过完了</div>}
      {next && (
        <div className="cd-hero">
          <div className="cd-hero-l">
            <div className="cd-hero-k">下一个 · {GROUP_LABEL[groupOf(next.name)]}</div>
            <div className="cd-hero-n">{stripFlag(next.name)}</div>
            <div className="cd-hero-date">{fmtDate(next.date)}</div>
          </div>
          <div className="cd-hero-d">
            {next.n === 0 ? '今天' : <>{next.n}<small>天</small></>}
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div>
          <Group label="CN · 中国" items={rest.filter((e) => groupOf(e.name) === 'cn').slice(0, 5)} />
          <Group label="US · 美国" items={rest.filter((e) => groupOf(e.name) === 'us').slice(0, 5)} />
          <Group label="Other · 其他" items={rest.filter((e) => groupOf(e.name) === 'other').slice(0, 5)} />
        </div>
      )}
    </>
  )
}
