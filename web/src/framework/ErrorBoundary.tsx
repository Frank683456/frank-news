import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  name: string
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name}]`, error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card size-m">
          <div className="card-header">
            <div className="card-title">{this.props.name}</div>
          </div>
          <div className="error">模块渲染出错：{this.state.message}</div>
        </div>
      )
    }
    return this.props.children
  }
}
