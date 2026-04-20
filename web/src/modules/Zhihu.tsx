import { useJson } from '../framework/useJson'
import { ColHead } from '../framework/Section'

type Item = { title: string; url: string }
type ZhihuData = { items: Item[]; updatedAt: string }

export default function Zhihu() {
  const { status, data, updatedAt, stale, error } = useJson<ZhihuData>('/data/zhihu.json', 30 * 60_000)

  return (
    <>
      <ColHead
        eyebrow="Society · 社会"
        title="知乎热榜"
        meta={status === 'ready' ? `${data.items.length} 条` : undefined}
        updatedAt={updatedAt}
        stale={stale}
      />
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && (
        <div>
          {data.items.slice(0, 8).map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`lst-i ${i < 3 ? 'hot' : ''}`}
            >
              <div className="lst-n">{String(i + 1).padStart(2, '0')}</div>
              <div className="lst-t">{s.title}</div>
            </a>
          ))}
        </div>
      )}
    </>
  )
}
