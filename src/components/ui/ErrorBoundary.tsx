import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
  surface?: string;
  resetKey?: string | number | null;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  incidentId: string | null;
}

function createIncidentId(): string {
  return `PANVAS-${Date.now().toString(36).toUpperCase()}`;
}

function DefaultErrorFallback({
  surface,
  incidentId,
  error,
  onRetry,
}: {
  surface: string;
  incidentId: string;
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-panvas-bg-primary p-8 text-panvas-text-primary">
      <div className="max-w-2xl">
        <h1 className="mb-4 text-2xl font-bold">Something went wrong.</h1>
        <p className="mb-2 text-panvas-text-secondary">{surface} could not be displayed. Your local files were not deleted.</p>
        <p className="text-sm text-panvas-text-tertiary">Reference: {incidentId}</p>
        {import.meta.env?.DEV && <pre className="mt-4 max-h-[50vh] overflow-auto rounded bg-black/50 p-4 text-sm text-panvas-text-secondary">
          {error?.toString()}{'\n'}{error?.stack}
        </pre>}
        <button
          type="button"
          className="mt-4 rounded bg-panvas-text-primary px-4 py-2 font-bold text-panvas-bg-primary focus-ring"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    incidentId: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, incidentId: createIncidentId() };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const details = {
      surface: this.props.surface ?? 'Panvas application',
      incidentId: this.state.incidentId,
      message: error.message,
      componentStack: errorInfo.componentStack?.trim() || undefined,
    };
    if (import.meta.env?.DEV) {
      console.error('[Panvas] UI error boundary caught an error:', error, details);
    } else {
      console.error('[Panvas] UI surface error:', details);
    }
  }

  public componentDidUpdate(previousProps: ErrorBoundaryProps) {
    if (this.state.hasError && this.props.resetKey !== previousProps.resetKey) {
      this.retry();
    }
  }

  private readonly retry = () => {
    this.setState({ hasError: false, error: null, incidentId: null });
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      const surface = this.props.surface ?? 'Panvas';
      if (this.props.fallback) return this.props.fallback(this.state.error, this.retry);
      return (
        <DefaultErrorFallback
          surface={surface}
          incidentId={this.state.incidentId ?? createIncidentId()}
          error={this.state.error}
          onRetry={this.retry}
        />
      );
    }

    return this.props.children;
  }
}

export function ViewportErrorFallback({
  surface,
  onRetry,
  onNavigate,
}: {
  surface: string;
  onRetry: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center bg-panvas-bg-primary p-6" role="alert">
      <div className="max-w-md rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-6 text-center shadow-sm">
        <h2 className="text-base font-semibold text-panvas-text-primary">{surface} is unavailable</h2>
        <p className="mt-2 text-sm leading-5 text-panvas-text-secondary">This surface hit an unexpected error. Your local data is unchanged.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onRetry} className="panvas-action-button panvas-action-button--primary focus-ring">Retry</button>
          {onNavigate && <button type="button" onClick={onNavigate} className="panvas-action-button panvas-action-button--secondary focus-ring">Open Library</button>}
        </div>
      </div>
    </div>
  );
}

export function ViewportErrorBoundary({
  surface,
  resetKey,
  onNavigate,
  children,
}: {
  surface: string;
  resetKey?: string | number | null;
  onNavigate?: () => void;
  children: ReactNode;
}) {
  return (
    <ErrorBoundary
      surface={surface}
      resetKey={resetKey}
      fallback={(_, retry) => <ViewportErrorFallback surface={surface} onRetry={retry} onNavigate={onNavigate} />}
    >
      {children}
    </ErrorBoundary>
  );
}
