import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-[60vh] place-items-center p-6 text-center">
        <div className="grid gap-3">
          <p className="font-medium">This view ran into a problem.</p>
          <button className="rounded-xl bg-ink px-4 py-2 text-sm text-bg" onClick={() => { this.setState({ error: null }); location.reload(); }}>Reload</button>
        </div>
      </div>
    );
  }
}
