import { useEffect, useState } from 'react'
import { useJson } from '../framework/useJson'
import { ColHead, Skeleton } from '../framework/Section'

type Event = {
  date: string
  time?: string
  session?: '盘前' | '盘后'
  country: string
  name: string
  importance: number
}
type EconData = { events: Event[]; tz?: string; updatedAt: string }

const PT = 'America/Los_Angeles'
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
// 财报没有钟点，按盘前/盘后估一个时刻判断「已公布」（洛杉矶时间）
const SESSION_DONE = { 盘前: '06:30', 盘后: '13:30' }

function nowPT(): { date: string; hm: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: PT, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` }
}

function isPast(e: Event, now: { date: string; hm: string }): boolean {
  if (e.date !== now.date) return e.date < now.date
  const t = e.time ?? (e.session ? SESSION_DONE[e.session] : undefined)
  return t ? t <= now.hm : false
}

function weekday(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return WEEK[new Date(y, m - 1, day).getDay()]
}

function useMinuteTick() {
  const [, set] = useState(0)
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])
}

function Row({ e, today, past }: { e: Event; today: boolean; past: boolean }) {
  const imp = e.importance >= 3 ? 'hi' : e.importance === 2 ? 'mid' : 'lo'
  return (
    <div className={`cal-i imp-${imp} ${today ? 'today' : ''} ${past ? 'past' : ''}`}>
      <div className="cal-d">
        <span className="cal-md">{today ? '今天' : `${e.date.slice(5).replace('-', '/')} 周${weekday(e.date)}`}</span>
        <span className="cal-t">{e.time ?? e.session ?? ''}</span>
      </div>
      <div className="cal-f">{e.country}</div>
      <div className="cal-n">{e.name}</div>
    </div>
  )
}

export default function EconCalendar() {
  const { status, data, updatedAt, stale, error } = useJson<EconData>('/data/econ.json', 60 * 60_000)
  useMinuteTick()

  const now = nowPT()
  const events = status === 'ready' ? data.events.slice(0, 14) : []
  // 只有新格式（时间已换算成洛杉矶）才按时刻判断已公布；旧格式只按日期
  const isPT = status === 'ready' && data.tz === PT
  const pastOf = (e: Event) => (isPT ? isPast(e, now) : e.date < now.date)
  const upcoming = events.filter((e) => !pastOf(e))
  const done = events.filter(pastOf)

  return (
    <>
      <ColHead
        eyebrow={isPT ? 'Calendar · 洛杉矶时间' : 'Calendar · 近两周'}
        title="经济日历"
        meta={status === 'ready' ? `近两周 ${events.length} 项` : undefined}
        updatedAt={updatedAt}
        stale={stale}
      />
      {status === 'loading' && <Skeleton rows={10} />}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && events.length === 0 && <div className="empty">近期无重要事件</div>}
      {status === 'ready' && events.length > 0 && (
        <div className="cal">
          {upcoming.map((e, i) => <Row key={`u${i}`} e={e} today={e.date === now.date} past={false} />)}
          {done.length > 0 && <div className="cal-sep">已公布</div>}
          {done.map((e, i) => <Row key={`d${i}`} e={e} today={false} past />)}
          <div className="cal-legend">
            <span className="lg hi">高</span>
            <span className="lg mid">中</span>
            <span className="lg lo">低</span>
            <span className="lg-note">左侧色条 = 重要程度</span>
          </div>
        </div>
      )}
    </>
  )
}
