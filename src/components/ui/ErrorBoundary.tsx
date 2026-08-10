import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
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
            <p className="mb-4">The application encountered a critical error. Please reload.</p>
            <pre className="bg-black/50 p-4 rounded text-sm overflow-auto max-h-[50vh]">
              {this.state.error?.toString()}
              {'\n'}
              {this.state.error?.stack}
            </pre>
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
