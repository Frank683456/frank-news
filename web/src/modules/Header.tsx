import { useEffect, useState } from 'react'
import { useJson } from '../framework/useJson'

type Hitokoto = { text: string; from?: string }

type Theme = 'light' | 'dark'

const CN_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function useNow() {
  const [n, setN] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setN(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return n
}

function fmtDateInTZ(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value ?? ''
  const m = parts.find((p) => p.type === 'month')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d)
  const dayIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd)
  const cn = dayIdx >= 0 ? CN_WEEKDAYS[dayIdx] : ''
  return `${y}.${m}.${day} · 周${cn}`
}

function fmtTimeInTZ(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}

function greeting(d: Date, tz: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(d),
  )
  if (hour < 5) return 'Dawn · 凌晨'
  if (hour < 11) return 'Morning · 早安'
  if (hour < 13) return 'Noon · 午安'
  if (hour < 18) return 'Afternoon · 下午好'
  return 'Evening · 晚安'
}

const Icons = {
  sun: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="8" cy="8" r="3" />
      <path
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M13 9.5A5 5 0 016.5 3a5 5 0 107 6.5z" strokeLinejoin="round" />
    </svg>
  ),
}

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('fd_theme') as Theme | null
    return saved === 'dark' ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('fd_theme', theme)
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))]
}

export default function Header() {
  const now = useNow()
  const hi = useJson<Hitokoto>('/data/hitokoto.json', 5 * 60_000)
  const [theme, toggleTheme] = useTheme()

  const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
  const primaryDate = fmtDateInTZ(now, localTZ)
  const primaryTime = fmtTimeInTZ(now, localTZ)
  const bjTime = fmtTimeInTZ(now, 'Asia/Shanghai')
  const hello = greeting(now, localTZ)

  return (
    <>
      <header className="mast">
        <div className="mast-l">
          <div>Today · 今日</div>
          <div className="mast-value">{primaryDate}</div>
        </div>
        <div className="mast-c">
          <h1 className="mast-title">
            晨 <em>报</em>
          </h1>
          <div className="mast-sub">Frank's Morning Brief · Est. 2024</div>
        </div>
        <div className="mast-r">
          <div>{hello}</div>
          <div className="mast-value">
            {primaryTime} <span style={{ color: 'var(--ink-4)', marginLeft: 8 }}>BJ {bjTime}</span>
          </div>
        </div>
      </header>
      <div className="mast-rule" />

      <div className="topbar">
        <div className="topbar-hitokoto">
          {hi.status === 'ready' ? (
            <>
              「{hi.data.text}」
              {hi.data.from ? <span style={{ color: 'var(--ink-3)' }}> —— {hi.data.from}</span> : null}
            </>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>
        <div className="topbar-actions">
          <button
            className="btn"
            onClick={toggleTheme}
            aria-label="toggle color scheme"
            title={theme === 'light' ? '切换暗色' : '切换亮色'}
          >
            {theme === 'light' ? Icons.moon : Icons.sun}
            <span>{theme === 'light' ? '暗色' : '亮色'}</span>
          </button>
        </div>
      </div>
    </>
  )
}
