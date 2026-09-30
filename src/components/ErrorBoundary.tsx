import React from "react";

interface Props { children: React.ReactNode; }

export class ErrorBoundary extends React.Component<Props, { hasError: boolean; error?: Error }> {
  constructor(props: Props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="size-full flex flex-col items-center justify-center bg-[#1c1c1c] text-white gap-4 p-8">
          <p className="font-['IBM_Plex_Mono'] text-[11px] text-white/40">Something went wrong</p>
          <p className="font-['Platypi'] text-[18px] text-white/70 text-center max-w-[300px]">
            {this.state.error?.message ?? "Unexpected error"}
          </p>
          <button onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-5 py-2 rounded-full bg-white/10 text-white/70 text-[12px] active:scale-95 transition-transform">
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
