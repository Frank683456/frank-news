import { Card } from '../framework/Card'
import { useJson } from '../framework/useJson'
import { moodColor, Briefing } from '../framework/briefing'

type Entry = {
  date: string
  title: string
  subtitle?: string
  mood?: Briefing['mood']
}
type ArchiveData = { entries?: Entry[]; dates?: string[]; updatedAt: string }

export default function Archive() {
  const { status, data, updatedAt, stale, error } = useJson<ArchiveData>('/data/archive.json', 60 * 60_000)
  const entries: Entry[] = data?.entries ?? (data?.dates ?? []).map((d) => ({ date: d, title: '', mood: 'neutral' }))

  return (
    <Card title="晨报存档" size="l" updatedAt={updatedAt} stale={stale}>
      {status === 'loading' && <div className="loading">加载中…</div>}
      {status === 'error' && <div className="error">{error}</div>}
      {status === 'ready' && entries.length === 0 && <div className="empty">暂无存档</div>}
      {status === 'ready' && entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.slice(0, 10).map((e) => {
            const accent = moodColor[e.mood ?? 'neutral']
            return (
              <a
                key={e.date}
                href={`#/briefing/${e.date}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-sunk)',
                  border: '1px solid var(--border)',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(ev) => {
                  ;(ev.currentTarget as HTMLAnchorElement).style.background = 'var(--card)'
                  ;(ev.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border-strong)'
                }}
                onMouseLeave={(ev) => {
                  ;(ev.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-sunk)'
                  ;(ev.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'
                }}
              >
                <div style={{ width: 3, alignSelf: 'stretch', background: accent, borderRadius: 2 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                    <div className="num muted" style={{ fontSize: 11, letterSpacing: 0.5 }}>{e.date}</div>
                  </div>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {e.title || `晨报 ${e.date}`}
                  </div>
                  {e.subtitle && (
                    <div className="muted" style={{
                      fontSize: 11,
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {e.subtitle}
                    </div>
                  )}
                </div>
              </a>
            )
          })}
        </div>
      )}
    </Card>
  )
}
