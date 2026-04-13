import { Card } from '../framework/Card'
import { useJson } from '../framework/useJson'

type Item = { title: string; url: string }
type ZhihuData = { items: Item[]; updatedAt: string }

export default function Zhihu() {
  const { status, data, updatedAt, stale, error } = useJson<ZhihuData>('/data/zhihu.json', 30 * 60_000)
  return (
    <Card title="知乎热榜" size="m" updatedAt={updatedAt} stale={stale}>
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && (
        <ol style={{ padding: 0, margin: 0, listStyle: 'none' }}>
          {data.items.slice(0, 8).map((s, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 13 }}>
              <span className="dim num" style={{ width: 18, textAlign: 'right' }}>{String(i + 1).padStart(2, '0')}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer"
                 style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
