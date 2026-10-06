import { useId } from 'react'
import { useJson } from '../framework/useJson'
import { ColHead, Skeleton } from '../framework/Section'

type Tick = {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  disagree?: boolean
  sources?: number
  closed?: boolean
  spark?: number[]
}
type Backup = { name: string; ok: boolean; covered: number; expected: number }
type MarketData = { items: Tick[]; backup?: Backup; updatedAt: string }

// 5 组 × 3 格：每组一行，桌面和手机都是 3 列
const GROUPS: { label: string; symbols: string[] }[] = [
  { label: '美股', symbols: ['SPX', 'IXIC', 'DJI'] },
  { label: '亚太', symbols: ['HSI', 'N225', 'CSI300'] },
  { label: '利率 · 美元', symbols: ['US10Y', 'DXY', 'VIX'] },
  { label: '汇率 · 加密', symbols: ['USDCNY', 'USDJPY', 'BTC'] },
  { label: '大宗商品', symbols: ['GOLD', 'SILVER', 'WTI'] },
]

function fmtPrice(n: number) {
  const digits = Math.abs(n) >= 20000 ? 0 : 2
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

/** 面积走势图：线下渐变填充，颜色跟当天涨跌走（红涨绿跌）。 */
function Spark({ points, up }: { points: number[]; up: boolean }) {
  const gid = useId()
  if (points.length < 2) return <div className="mk-spark-empty" />
  const w = 100
  const h = 28
  const min = Math.min(...points)
  const span = Math.max(...points) - min || 1
  const xy = points.map((p, i) => [
    (i / (points.length - 1)) * w,
    h - 2 - ((p - min) / span) * (h - 6),
  ])
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg className={`mk-spark ${up ? 'up' : 'down'}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

function Tile({ t }: { t: Tick }) {
  const up = t.change >= 0
  // 涨跌热度：幅度 0→3% 对应底色 0→最深
  const heat = Math.min(Math.abs(t.changePct) / 3, 1)
  return (
    <div className={`mk-c ${up ? 'up' : 'down'}`} style={{ ['--heat' as string]: heat.toFixed(2) }}>
      <div className="mk-l">
        <span className="mk-name">{t.name}</span>
        {t.closed && <span className="mk-closed">休市</span>}
        {t.disagree && <span className="mk-warn" title="两个数据源差距超过 0.5%">≠</span>}
      </div>
      <div className="mk-p">{fmtPrice(t.price)}</div>
      <div className="mk-chg">
        <span className="mk-pct">{fmtPct(t.changePct)}</span>
        <span className="mk-abs">{t.change >= 0 ? '+' : ''}{fmtPrice(t.change)}</span>
      </div>
      <Spark points={t.spark ?? []} up={up} />
    </div>
  )
}

export default function Market() {
  const { status, data, updatedAt, stale, error } = useJson<MarketData>('/data/market.json', 60_000)

  const bySym = new Map((status === 'ready' ? data.items : []).map((t) => [t.symbol, t]))
  const grouped = new Set(GROUPS.flatMap((g) => g.symbols))
  const extra = status === 'ready' ? data.items.filter((t) => !grouped.has(t.symbol)) : []
  const backup = status === 'ready' ? data.backup : undefined

  return (
    <>
      <ColHead
        eyebrow="Global · 全球资产"
        title="市场速览"
        status={
          backup ? (
            backup.ok ? (
              <span className="src-ok" title={`主源 Yahoo，备源 ${backup.name} 覆盖 ${backup.covered}/${backup.expected}`}>双源核对</span>
            ) : (
              <span className="src-bad" title={`备源 ${backup.name} 只拿到 ${backup.covered}/${backup.expected}`}>备用源异常</span>
            )
          ) : undefined
        }
        updatedAt={updatedAt}
        stale={stale}
      />
      {status === 'loading' && <Skeleton rows={10} />}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && (
        <div className="mk">
          {GROUPS.map((g) => {
            const ticks = g.symbols.map((s) => bySym.get(s)).filter((t): t is Tick => !!t)
            if (ticks.length === 0) return null
            return (
              <div key={g.label} className="mk-g">
                <div className="mk-gl">{g.label}</div>
                <div className="mk-row">
                  {ticks.map((t) => <Tile key={t.symbol} t={t} />)}
                </div>
              </div>
            )
          })}
          {extra.length > 0 && (
            <div className="mk-g">
              <div className="mk-gl">其他</div>
              <div className="mk-row">{extra.map((t) => <Tile key={t.symbol} t={t} />)}</div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
