import { useJson } from '../framework/useJson'
import { ColHead } from '../framework/Section'

type Tick = {
  symbol: string
  name: string
  price: number
  change: number
  changePct: number
  disagree?: boolean
}
type MarketData = { items: Tick[]; updatedAt: string }

function fmtPrice(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtChange(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Market() {
  const { status, data, updatedAt, stale, error } = useJson<MarketData>('/data/market.json', 60_000)

  const items = status === 'ready' ? data.items.slice(0, 12) : []
  // Pad to multiples of 3 for clean grid
  const padded = [...items]
  while (padded.length > 0 && padded.length % 3 !== 0) padded.push(null as unknown as Tick)

  return (
    <>
      <ColHead
        eyebrow="Global · 全球资产"
        title="市场速览"
        meta={status === 'ready' ? `${data.items.length} 项` : undefined}
        updatedAt={updatedAt}
        stale={stale}
      />
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && (
        <div className="mk">
          {padded.map((t, i) => {
            if (!t) return <div key={`pad-${i}`} className="mk-c" />
            const up = t.change >= 0
            return (
              <div key={t.symbol} className="mk-c">
                <div className="mk-l">
                  {t.name}
                  {t.disagree && <span title="多源分歧" style={{ color: 'var(--warn)', marginLeft: 4 }}>·</span>}
                </div>
                <div className="mk-p">{fmtPrice(t.price)}</div>
                <div className={`mk-chg ${up ? 'up' : 'down'}`}>
                  <span>{up ? '▲' : '▼'}</span>
                  <span>{fmtChange(t.change)}</span>
                  <span>{up ? '+' : ''}{t.changePct.toFixed(2)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
