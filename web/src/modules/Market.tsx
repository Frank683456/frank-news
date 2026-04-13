import { Card } from '../framework/Card'
import { useJson } from '../framework/useJson'

type Tick = { symbol: string; name: string; price: number; change: number; changePct: number; disagree?: boolean }
type MarketData = { items: Tick[]; updatedAt: string }

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Market() {
  const { status, data, updatedAt, stale, error } = useJson<MarketData>('/data/market.json', 60_000)
  return (
    <Card title="市场速览" size="l" updatedAt={updatedAt} stale={stale}>
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 14, rowGap: 18 }}>
          {data.items.map((t) => {
            const up = t.change >= 0
            return (
              <div key={t.symbol}>
                <div className="muted" style={{ fontSize: 11 }}>
                  {t.name}
                  {t.disagree && <span title="多源分歧" style={{ color: 'var(--warn)', marginLeft: 4 }}>·</span>}
                </div>
                <div className="num" style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em' }}>{fmt(t.price)}</div>
                <div className={`num ${up ? 'up' : 'down'}`} style={{ fontSize: 12 }}>
                  {up ? '+' : ''}{fmt(t.change)} · {up ? '+' : ''}{t.changePct.toFixed(2)}%
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
