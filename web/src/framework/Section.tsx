import { ReactNode } from 'react'

interface ColHeadProps {
  eyebrow: string
  title: string
  meta?: string
  updatedAt?: string | null
  stale?: boolean
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

export function ColHead({ eyebrow, title, meta, updatedAt, stale }: ColHeadProps) {
  return (
    <div className="col-head">
      <div className="l">
        <div className="eyebrow">{eyebrow}</div>
        <div className="title">{title}</div>
      </div>
      <div className="r">
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
