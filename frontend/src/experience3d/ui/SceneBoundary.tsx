import { Component, type ReactNode } from "react";

/** Catches failures inside the 3D scene (WebGL context creation, shader
 * compile errors…) so the rest of the dashboard is never affected. */
export class SceneBoundary extends Component<{ fallback: (retry: () => void) => ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[Mieruka 3D] scene failed, showing fallback", error);
  }
  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}
