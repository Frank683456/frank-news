import { ReactNode } from 'react'

interface ColHeadProps {
  eyebrow: string
  title: string
  meta?: string
  updatedAt?: string | null
  stale?: boolean
  /** 标题行右侧的状态小字（如市场速览的「双源核对 / 备用源异常」） */
  status?: ReactNode
}

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (isNaN(diff)) return ''
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.floor(h / 24)} d ago`
}

export function ColHead({ eyebrow, title, meta, updatedAt, stale, status }: ColHeadProps) {
  return (
    <div className="col-head">
      <div className="l">
        <div className="eyebrow">{eyebrow}</div>
        <div className="title">{title}</div>
      </div>
      <div className="r">
        {status}
        {meta && <span>{meta}</span>}
        {updatedAt && <span className={stale ? 'stale' : ''}>{formatAgo(updatedAt)}</span>}
      </div>
    </div>
  )
}

interface SectionProps {
  id?: string
  title: string
  children: ReactNode
}

export function ChapterSection({ id, title, children }: SectionProps) {
  return (
    <section className="section" id={id}>
      <div className="sec-head">
        <span className="line" />
        <div className="title">{title}</div>
        <span className="line" />
      </div>
      {children}
    </section>
  )
}

/** 加载占位：灰色条块代替「加载中…」，高度接近真实内容，数据到了页面不跳。 */
export function Skeleton({ rows = 6, tall = false }: { rows?: number; tall?: boolean }) {
  return (
    <div className={`skel ${tall ? 'tall' : ''}`} aria-busy="true" aria-label="加载中">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel-row">
          <span className="skel-bar" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
        </div>
      ))}
    </div>
  )
}
