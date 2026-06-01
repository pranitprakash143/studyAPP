"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class GraphErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("GraphErrorBoundary caught a rendering crash:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-2xl w-full h-full min-h-[300px] text-slate-300 shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 rounded-2xl bg-indigo-500/5 blur-3xl scale-125" />
          <div className="relative flex flex-col items-center text-center max-w-md z-10">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl mb-4">
              <AlertTriangle className="h-8 w-8 text-rose-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Neural Graph Offline</h3>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              An unexpected error occurred while rendering the visual knowledge graph. This is typically caused by invalid or circular node relationships in the current study material.
            </p>
            {this.state.error && (
              <div className="w-full text-left bg-slate-950 p-4 rounded-xl border border-slate-800 text-rose-400 font-mono text-xs max-h-40 overflow-y-auto mb-6 scrollbar-thin">
                <span className="font-semibold block mb-1 text-rose-300">Error Details:</span>
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Reset & Reload Graph
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
