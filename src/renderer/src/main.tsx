import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error): void {
    try {
      void window.vikings.invoke('log:write', 'fatal', 'renderer', 'Unhandled UI error', {
        error: error.message,
        stack: error.stack
      });
    } catch {
      /* bridge unavailable */
    }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-app-bg p-8 text-center">
          <h1 className="text-lg font-bold text-app-danger">Something went wrong</h1>
          <p className="max-w-md select-text text-xs text-app-text-muted">{this.state.error.message}</p>
          <button
            onClick={() => location.reload()}
            className="rounded-md bg-app-accent px-4 py-1.5 text-sm text-app-accent-text"
          >
            Reload application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
