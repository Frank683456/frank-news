import { ReactNode } from 'react'

type Size = 's' | 'm' | 'l' | 'xl' | 'full'

interface CardProps {
  title: string
  size?: Size
  updatedAt?: string | null
  stale?: boolean
  children: ReactNode
}

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (isNaN(diff)) return ''
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

export function Card({ title, size = 'm', updatedAt, stale, children }: CardProps) {
  return (
    <div className={`card size-${size}`}>
      <div className="card-header">
        <div className="card-title">{title}</div>
        {updatedAt && (
          <div className={`card-meta ${stale ? 'stale' : ''}`}>
            {formatAgo(updatedAt)}
          </div>
        )}
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}
