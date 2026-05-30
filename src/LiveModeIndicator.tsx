interface Props {
  state: "live" | "checkpoint" | "saving" | "error";
  label?: string;
}

const STATES = {
  live:       { dot: "#22C55E", pulse: true,  text: "En vivo" },
  saving:     { dot: "#F59E0B", pulse: false, text: "Guardando…" },
  checkpoint: { dot: "#C9A84C", pulse: false, text: "Checkpoint" },
  error:      { dot: "#ef4444", pulse: false, text: "Sin guardar" },
};

export default function LiveModeIndicator({ state, label }: Props) {
  const c = STATES[state];
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "3px 10px", borderRadius: 20,
        background: "#0F1117", border: "1px solid #1E2233",
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: "50%",
          background: c.dot, flexShrink: 0,
          boxShadow: `0 0 6px ${c.dot}88`,
          display: "inline-block",
          animation: c.pulse ? "sigob-pulse 2s ease-in-out infinite" : "none",
        }}
      />
      <span style={{ fontSize: 10, fontWeight: 500, color: "#7A7F9A", letterSpacing: "0.04em" }}>
        {label ?? c.text}
      </span>
    </div>
  );
}
