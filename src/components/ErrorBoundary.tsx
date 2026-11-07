import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
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
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    // Automatisches Bereinigen veralteter Browser-Caches / Service Worker bei Fehlern
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        window.caches.keys().then((keys) => {
          keys.forEach((k) => {
            window.caches.delete(k).catch(() => {});
          });
        }).catch(() => {});
      }
    } catch {
      // Ignorieren falls im iFrame gesperrt
    }
  }

  private handleHardReload = async () => {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
        for (const registration of registrations) {
          await registration.unregister().catch(() => {});
        }
      }
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys().catch(() => []);
        await Promise.all(keys.map((k) => window.caches.delete(k).catch(() => {})));
      }
    } catch (e) {
      console.warn('Cache clearing notice:', e);
    }
    this.setState({ hasError: false, error: null });
    // Sicheres Neuladen ohne URL-Param-Manipulation im iFrame
    try {
      window.location.reload();
    } catch {
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Ein Fehler ist aufgetreten</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Die Anwendung wurde isoliert, um Datenverlust zu verhindern.
            </p>
            {this.state.error && (
              <pre className="text-[11px] font-mono text-red-300/80 bg-slate-950 p-3 rounded-xl overflow-x-auto text-left max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={this.handleHardReload}
                className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Cache leeren &amp; Neu laden</span>
              </button>
            </div>
            <p className="text-[10.5px] text-slate-500">
              Tipp: Drücke am PC einmalig <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Strg + F5</kbd> (Mac: <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Cmd + Shift + R</kbd>), falls dein Browser veraltete Skripte im Zwischenspeicher hält.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
