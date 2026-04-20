import { lazy, Suspense } from 'react'
import { ErrorBoundary } from './framework/ErrorBoundary'
import { useHash, parseRoute } from './framework/useHash'
import { ChapterSection } from './framework/Section'
import Header from './modules/Header'
import Briefing from './modules/Briefing'

const Market = lazy(() => import('./modules/Market'))
const EconCalendar = lazy(() => import('./modules/EconCalendar'))
const Kr36 = lazy(() => import('./modules/Kr36'))
const Zhihu = lazy(() => import('./modules/Zhihu'))
const Calendar = lazy(() => import('./modules/Calendar'))
const BlogFeed = lazy(() => import('./modules/BlogFeed'))
const Archive = lazy(() => import('./modules/Archive'))
const BriefingDetail = lazy(() => import('./pages/BriefingDetail'))

function Cell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="cell">
      <ErrorBoundary name={name}>
        <Suspense fallback={<div className="loading">加载中…</div>}>{children}</Suspense>
      </ErrorBoundary>
    </div>
  )
}

function Home() {
  return (
    <>
      <Header />

      <ErrorBoundary name="今日头条">
        <Briefing />
      </ErrorBoundary>

      <ChapterSection title="市 场 · Markets">
        <div className="row r2">
          <Cell name="市场速览"><Market /></Cell>
          <Cell name="经济日历"><EconCalendar /></Cell>
        </div>
      </ChapterSection>

      <ChapterSection title="热 榜 · Hot">
        <div className="row r2">
          <Cell name="36氪"><Kr36 /></Cell>
          <Cell name="知乎"><Zhihu /></Cell>
        </div>
      </ChapterSection>

      <ChapterSection title="日 程 · Agenda">
        <div className="row r2">
          <Cell name="节日倒计时"><Calendar /></Cell>
          <Cell name="博客最新"><BlogFeed /></Cell>
        </div>
      </ChapterSection>

      <ChapterSection title="存 档 · Archive">
        <div className="row r1">
          <Cell name="晨报存档"><Archive /></Cell>
        </div>
      </ChapterSection>

      <footer className="foot">
        <div>© 2024 – 2026 Frank</div>
        <div>Morning Brief · Editorial</div>
      </footer>
    </>
  )
}

export default function App() {
  const hash = useHash()
  const route = parseRoute(hash)

  return (
    <div className="app">
      {route.kind === 'home' && <Home />}
      {route.kind === 'briefing' && (
        <Suspense fallback={<div className="article"><div className="loading">加载中…</div></div>}>
          <BriefingDetail date={route.date} />
        </Suspense>
      )}
    </div>
  )
}
