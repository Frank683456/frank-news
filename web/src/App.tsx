import { lazy, Suspense } from 'react'
import modulesConfig from './modules.json'
import { ErrorBoundary } from './framework/ErrorBoundary'
import { useHash, parseRoute } from './framework/useHash'
import Header from './modules/Header'

const BriefingDetail = lazy(() => import('./pages/BriefingDetail'))

type ModuleConfig = {
  id: string
  title: string
  component: string
  size: 's' | 'm' | 'l' | 'xl' | 'full'
  enabled: boolean
}

const loaders: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  Briefing: () => import('./modules/Briefing'),
  Market: () => import('./modules/Market'),
  Calendar: () => import('./modules/Calendar'),
  BlogFeed: () => import('./modules/BlogFeed'),
  Archive: () => import('./modules/Archive'),
  Kr36: () => import('./modules/Kr36'),
  Zhihu: () => import('./modules/Zhihu'),
  EconCalendar: () => import('./modules/EconCalendar'),
}

function Home() {
  const modules = (modulesConfig as ModuleConfig[]).filter((m) => m.enabled)
  return (
    <>
      <Header />
      <div className="grid">
        {modules.map((m) => {
          const loader = loaders[m.component]
          if (!loader) return null
          const Comp = lazy(loader)
          return (
            <ErrorBoundary key={m.id} name={m.title}>
              <Suspense
                fallback={
                  <div className={`card size-${m.size}`}>
                    <div className="card-header"><div className="card-title">{m.title}</div></div>
                    <div className="loading">加载中…</div>
                  </div>
                }
              >
                <Comp />
              </Suspense>
            </ErrorBoundary>
          )
        })}
      </div>
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
