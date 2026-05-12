'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        // In production, send to error reporting service
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.error('[ErrorBoundary]', error, info.componentStack);
        }
    }

    handleReset = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): React.ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
                    <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                        Module failed to render
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm">
                        {this.state.error?.message ?? 'An unexpected error occurred in this dashboard.'}
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
                        aria-label="Retry loading this module"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
