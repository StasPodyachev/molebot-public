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
 * ErrorBoundary — ловит ошибки рендера в дочерних компонентах
 * Предотвращает white screen при падении PrivyProvider или других клиентских компонентов
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
            <h2 className="text-xl font-semibold">Что-то пошло не так</h2>
            <p className="text-gray-400 text-sm max-w-md text-center">
              Произошла ошибка при загрузке приложения. Попробуйте обновить страницу.
            </p>
            <pre className="text-xs text-red-400 bg-gray-900 p-3 rounded-lg max-w-lg overflow-auto">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="bg-mole-600 hover:bg-mole-500 text-white px-6 py-2 rounded-xl text-sm transition-colors"
            >
              Обновить страницу
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
