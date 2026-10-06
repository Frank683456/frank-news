import { useJson } from '../framework/useJson'
import { ColHead, Skeleton } from '../framework/Section'

type Item = { title: string; url: string; section: string; publishedAt?: string }
type ZaobaoData = { items: Item[]; updatedAt: string }

const SECTION_KEY: Record<string, string> = { 中国: 'cn', 国际: 'world', 财经: 'fin' }

function age(publishedAt?: string): string {
  if (!publishedAt) return ''
  const ms = Date.now() - new Date(publishedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const h = ms / 3_600_000
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} 分钟前`
  return `${Math.round(h)} 小时前`
}

export default function Zaobao() {
  const { status, data, updatedAt, stale, error } = useJson<ZaobaoData>('/data/zaobao.json', 30 * 60_000)
  const items = status === 'ready' ? data.items.slice(0, 8) : []

  return (
    <>
      <ColHead
        eyebrow="Newspaper · 新加坡"
        title="联合早报"
        meta={status === 'ready' ? `${items.length} 条` : undefined}
        updatedAt={updatedAt}
        stale={stale}
      />
      {status === 'loading' && <Skeleton rows={8} />}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && (
        <div>
          {items.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`lst-i ${i < 3 ? 'hot' : ''}`}
            >
              <div className="lst-n">{String(i + 1).padStart(2, '0')}</div>
              <div className="lst-b">
                <div className="lst-t">{s.title}</div>
                <div className="lst-meta">
                  <span className={`sec-tag sec-${SECTION_KEY[s.section] ?? 'other'}`}>{s.section}</span>
                  {age(s.publishedAt) && <span>{age(s.publishedAt)}</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  )
}
