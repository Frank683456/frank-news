import { useJson } from '../framework/useJson'
import { ColHead } from '../framework/Section'

type Post = { title: string; url: string; cover?: string; date: string; excerpt?: string }
type BlogData = { posts: Post[]; updatedAt: string }

export default function BlogFeed() {
  const { status, data, updatedAt, stale, error } = useJson<BlogData>('/data/blog_feed.json', 30 * 60_000)

  return (
    <>
      <ColHead
        eyebrow="Journal · 博客"
        title="博客最新"
        meta={status === 'ready' ? `${data.posts.length} 篇` : undefined}
        updatedAt={updatedAt}
        stale={stale}
      />
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && data.posts.length === 0 && <div className="empty">暂无博文</div>}
      {status === 'ready' && data.posts.length > 0 && (
        <div>
          {data.posts.slice(0, 4).map((p) => (
            <a
              key={p.url}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="blog-i"
            >
              <div
                className="blog-cover"
                style={p.cover ? { backgroundImage: `url(${p.cover})` } : undefined}
              />
              <div className="blog-meta">
                <div className="blog-title">{p.title}</div>
                <div className="blog-date">{p.date}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  )
}
