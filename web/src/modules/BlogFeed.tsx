import { Card } from '../framework/Card'
import { useJson } from '../framework/useJson'

type Post = { title: string; url: string; cover?: string; date: string; excerpt?: string }
type BlogData = { posts: Post[]; updatedAt: string }

export default function BlogFeed() {
  const { status, data, updatedAt, stale, error } = useJson<BlogData>('/data/blog_feed.json', 30 * 60_000)
  return (
    <Card title="博客最新" size="l" updatedAt={updatedAt} stale={stale}>
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}>
          {data.posts.slice(0, 4).map((p) => (
            <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"
               style={{
                 display: 'flex', flexDirection: 'column',
                 background: 'var(--bg-sunk)',
                 border: '1px solid var(--border)',
                 borderRadius: 'var(--radius-sm)',
                 overflow: 'hidden',
                 transition: 'border-color 0.15s, transform 0.15s',
               }}
               onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-strong)')}
               onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)')}
            >
              {p.cover && (
                <div style={{
                  width: '100%',
                  aspectRatio: '16 / 9',
                  backgroundImage: `url(${p.cover})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderBottom: '1px solid var(--border)',
                }} />
              )}
              <div style={{ padding: '10px 12px 12px' }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 500,
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {p.title}
                </div>
                <div className="dim num" style={{ fontSize: 11, marginTop: 4 }}>{p.date}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </Card>
  )
}
