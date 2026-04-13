export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'callout'; tone: 'info' | 'warn' | 'up' | 'down'; title?: string; text: string }
  | { type: 'table'; headers?: string[]; rows: (string | number)[][] }
  | {
      type: 'kpi'
      metrics: {
        label: string
        value: string
        delta?: string
        trend?: 'up' | 'down' | 'flat'
      }[]
    }

export type Section = { id: string; title: string; icon?: string; blocks: Block[] }
export type Source = { name: string; url: string }

export type Briefing = {
  date: string
  title: string
  subtitle?: string
  mood?: 'bull' | 'bear' | 'neutral' | 'volatile'
  highlights?: string[]
  sections: Section[]
  sources?: Source[]
  updatedAt: string
}

export const moodColor: Record<NonNullable<Briefing['mood']>, string> = {
  bull: 'var(--mood-bull)',
  bear: 'var(--mood-bear)',
  neutral: 'var(--mood-neutral)',
  volatile: 'var(--mood-volatile)',
}

export const toneColor: Record<Extract<Block, { type: 'callout' }>['tone'], string> = {
  info: 'var(--info)',
  warn: 'var(--warn)',
  up: 'var(--up)',
  down: 'var(--down)',
}
