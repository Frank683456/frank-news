import { useEffect, useState } from 'react'
import { useJson } from '../framework/useJson'

type Hitokoto = { text: string; from?: string }

function useClock(tz: string) {
  const [t, setT] = useState(() => new Date())
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(i)
  }, [])
  return t.toLocaleTimeString('zh-CN', { timeZone: tz, hour12: false })
}

export default function Header() {
  const la = useClock('America/Los_Angeles')
  const bj = useClock('Asia/Shanghai')
  const hi = useJson<Hitokoto>('/data/hitokoto.json', 5 * 60_000)

  const dateStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  return (
    <header className="header">
      <div className="header-brand">
        <h1>Frank 简报中心</h1>
        <div className="sub">{dateStr}</div>
      </div>
      <div className="header-meta">
        {hi.status === 'ready' && (
          <div className="hitokoto">
            「{hi.data.text}」{hi.data.from ? ` —— ${hi.data.from}` : ''}
          </div>
        )}
        <div className="clock">
          <div className="clock-label">LA</div>
          <div className="clock-time num">{la}</div>
        </div>
        <div className="clock">
          <div className="clock-label">BJ</div>
          <div className="clock-time num">{bj}</div>
        </div>
      </div>
    </header>
  )
}
