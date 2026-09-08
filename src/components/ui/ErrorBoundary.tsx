import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  incidentId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    incidentId: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, incidentId: `PANVAS-${Date.now().toString(36).toUpperCase()}` };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-red-900 text-white p-8">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
            <p className="mb-2">The application encountered a critical error. Your local files were not deleted.</p>
            <p className="text-sm text-red-100/80">Reference: {this.state.incidentId}</p>
            {import.meta.env.DEV && <pre className="mt-4 max-h-[50vh] overflow-auto rounded bg-black/50 p-4 text-sm">
              {this.state.error?.toString()}{'\n'}{this.state.error?.stack}
            </pre>}
            <button 
              className="mt-4 px-4 py-2 bg-white text-red-900 font-bold rounded"
              onClick={() => window.location.reload()}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
