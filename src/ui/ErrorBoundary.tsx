import { Component, type ReactNode } from 'react';

/** Last line of defence: a rendering failure shows a calm recovery screen, never a blank page or internals. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="splash" role="alert">
        <div className="stack" style={{ maxWidth: 420 }}>
          <h1>Something went wrong</h1>
          <p className="muted">Your data has not been changed. Reloading usually fixes this.</p>
          <button type="button" className="btn primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
