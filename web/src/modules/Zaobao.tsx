import { useJson } from '../framework/useJson'
import { ColHead } from '../framework/Section'

type Item = { title: string; url: string; section: string; publishedAt?: string }
type ZaobaoData = { items: Item[]; updatedAt: string }

function age(publishedAt?: string): string {
  if (!publishedAt) return ''
  const ms = Date.now() - new Date(publishedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const h = ms / 3_600_000
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`
  return `${Math.round(h)}h`
}

export default function Zaobao() {
  const { status, data, updatedAt, stale, error } = useJson<ZaobaoData>('/data/zaobao.json', 30 * 60_000)

  return (
    <>
      <ColHead
        eyebrow="Newspaper · 新加坡"
        title="联合早报"
        meta={status === 'ready' ? `${data.items.length} 条` : undefined}
        updatedAt={updatedAt}
        stale={stale}
      />
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && (
        <div>
          {data.items.slice(0, 9).map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`lst-i zb ${i < 3 ? 'hot' : ''}`}
            >
              <div className="lst-n">{String(i + 1).padStart(2, '0')}</div>
              <div className="lst-t">{s.title}</div>
              <div className="lst-tag">
                {s.section}
                {age(s.publishedAt) ? ` · ${age(s.publishedAt)}` : ''}
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  )
}
