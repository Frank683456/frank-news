import { Block, toneColor } from './briefing'

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'paragraph':
      return <p>{block.text}</p>
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag>
          {block.items.map((it, i) => <li key={i}>{it}</li>)}
        </Tag>
      )
    }
    case 'quote':
      return (
        <blockquote>
          {block.text}
          {block.cite && <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>—— {block.cite}</div>}
        </blockquote>
      )
    case 'callout':
      return (
        <div className="callout" style={{ ['--tone-color' as string]: toneColor[block.tone] }}>
          {block.title && <div className="callout-title">{block.title}</div>}
          <div>{block.text}</div>
        </div>
      )
    case 'table':
      return (
        <div className="table-wrap" tabIndex={0}>
          <table>
            {block.headers && (
              <thead>
                <tr>{block.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => <td key={j}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'kpi': {
      // 按个数排成均衡的几行（5 个=3+2、7 个=4+3），最后一行自动撑满，不留空格子
      const n = block.metrics.length
      const cols = Math.ceil(n / Math.ceil(n / 4))
      return (
        <div className="kpi-grid" style={{ ['--cols' as string]: cols }}>
          {block.metrics.map((m, i) => {
            const cls = m.trend === 'up' ? 'up' : m.trend === 'down' ? 'down' : 'muted'
            return (
              <div key={i} className="kpi">
                <div className="kpi-label">{m.label}</div>
                <div className="kpi-value">{m.value}</div>
                {m.delta && <div className={`kpi-delta ${cls}`}>{m.delta}</div>}
              </div>
            )
          })}
        </div>
      )
    }
  }
}
