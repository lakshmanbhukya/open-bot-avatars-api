import { Component, Suspense, useEffect, type ReactNode } from "react";

function LoadingPreview({ children, onTimeout }: { children: ReactNode; onTimeout: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onTimeout, 15_000);
    return () => window.clearTimeout(timer);
  }, [onTimeout]);
  return children;
}

/** A failed or stalled animation must leave the returned PNG and picker usable. */
export class PreviewBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
  failure: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  private fail = () => this.setState({ failed: true });

  render() {
    if (this.state.failed) return this.props.failure;
    return <Suspense fallback={<LoadingPreview onTimeout={this.fail}>{this.props.fallback}</LoadingPreview>}>
      {this.props.children}
    </Suspense>;
  }
}
