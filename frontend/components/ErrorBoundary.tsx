'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches render errors in child components
 * Prevents white screen when PrivyProvider or other client components crash
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 bg-gray-950 text-gray-100">
            <span className="text-4xl">⚠️</span>
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-gray-400 text-sm max-w-md text-center">
              An error occurred while loading the app. Try refreshing the page.
            </p>
            <pre className="text-xs text-red-400 bg-gray-900 p-3 rounded-lg max-w-lg overflow-auto">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="bg-mole-600 hover:bg-mole-500 text-white px-6 py-2 rounded-xl text-sm transition-colors"
            >
              Refresh page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
