import { useJson } from '../framework/useJson'
import { Briefing } from '../framework/briefing'
import { ColHead } from '../framework/Section'

type Entry = {
  date: string
  title: string
  subtitle?: string
  mood?: Briefing['mood']
}
type ArchiveData = { entries?: Entry[]; dates?: string[]; updatedAt: string }

export default function Archive() {
  const { status, data, updatedAt, stale, error } = useJson<ArchiveData>('/data/archive.json', 60 * 60_000)
  const entries: Entry[] =
    data?.entries ?? (data?.dates ?? []).map((d) => ({ date: d, title: '', mood: 'neutral' }))

  return (
    <>
      <ColHead
        eyebrow="Archive · 往期"
        title="晨报存档"
        meta={entries.length > 0 ? `${entries.length} 期` : undefined}
        updatedAt={updatedAt}
        stale={stale}
      />
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && entries.length === 0 && <div className="empty">暂无存档</div>}
      {status === 'ready' && entries.length > 0 && (
        <div>
          {entries.slice(0, 12).map((e) => (
            <a key={e.date} href={`#/briefing/${e.date}`} className="arc-i">
              <div className="arc-d">{e.date}</div>
              <div className={`arc-bar ${e.mood ?? 'neutral'}`} />
              <div className="arc-t">{e.title || `晨报 ${e.date}`}</div>
              <div className="arc-sub">{e.subtitle || ''}</div>
            </a>
          ))}
        </div>
      )}
    </>
  )
}
