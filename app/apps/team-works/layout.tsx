import type { CSSProperties, ReactNode } from "react";

const teamWorksTheme = {
  "--mikke-blue": "#3f4eb5",
  "--mikke-green": "#8bc7ad",
  "--mikke-pink": "#f9d3d2",
  "--mikke-yellow": "#ffd370",
  "--mikke-orange": "#f75a3b",
  "--mikke-primary": "#3f4eb5",
  "--mikke-primary-border": "#8bc7ad",
  "--mikke-primary-soft": "#8bc7ad",
  "--mikke-accent": "#f75a3b",
  "--mikke-accent-strong": "#f75a3b",
  "--mikke-accent-soft": "#f9d3d2",
  "--mikke-success": "#1b1b1f",
  "--mikke-success-soft": "#8bc7ad",
  "--mikke-danger": "#f75a3b"
} as CSSProperties;

export default function TeamWorksLayout({ children }: { children: ReactNode }) {
  return (
    <div data-team-works-theme style={teamWorksTheme}>
      <style>{`
        [data-team-works-theme] [class~="bg-[var(--mikke-primary)]"],
        [data-team-works-theme] [class~="bg-[var(--mikke-accent)]"] {
          background-color: #8bc7ad;
        }

        [data-team-works-theme] [class~="bg-[var(--mikke-primary)]"][class~="text-white"],
        [data-team-works-theme] [class~="bg-[var(--mikke-accent)]"][class~="text-white"] {
          color: #1b1b1f;
        }
      `}</style>
      {children}
    </div>
  );
}
