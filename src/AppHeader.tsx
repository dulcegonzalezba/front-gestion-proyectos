import LiveModeIndicator from "./LiveModeIndicator";

interface AppHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  week?: string;
  onLogout: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  liveIndicatorState?: "live" | "saving" | "checkpoint" | "error";
  onSaveCheckpoint?: () => void;
  onGeneratePdf?: () => void;
  onBackToLive?: () => void;
  pdfGenerating?: boolean;
  userRole?: string | null;
}

const BASE_TABS: [string, string][] = [
  ["home", "Inicio"],
  ["celulas", "Células"],
  ["proyectos", "Proyectos"],
  ["pmo", "PMO"],
  ["acuerdos", "Acuerdos"],
  ["liberaciones", "Liberaciones"],
  ["historial", "Historial"],
];

const BTN_BASE = {
  background: "none", border: "none", cursor: "pointer",
  fontFamily: "system-ui,sans-serif", whiteSpace: "nowrap" as const,
};

export default function AppHeader({
  activeTab, onTabChange, week, onLogout, onRefresh,
  refreshing, liveIndicatorState, onSaveCheckpoint, onGeneratePdf, onBackToLive, pdfGenerating,
  userRole,
}: AppHeaderProps) {
  // La pestaña RH (personal) solo es visible para rol 'pmo' — datos sensibles.
  const TABS: [string, string][] = userRole === "pmo"
    ? [...BASE_TABS, ["personal", "RH"] as [string, string]]
    : BASE_TABS;
  return (
    <header
      role="banner"
      style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "#09090C",
        borderBottom: "1px solid #1E2233",
        display: "flex", alignItems: "center", flexWrap: "wrap",
        gap: 8, padding: "0 16px", minHeight: 52,
        fontFamily: "system-ui,sans-serif",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{
          background: "linear-gradient(135deg,#C9A84C,#8A6E2F)",
          borderRadius: 8, width: 30, height: 30,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
        }}>⚙️</div>
        <div className="sigob-logo-full">
          <div style={{ fontWeight: 700, fontSize: 13, color: "#E8E3D8", letterSpacing: "0.02em", lineHeight: 1.1 }}>
            SIGOB
          </div>
          {week && (
            <div style={{ fontSize: 10, color: "#3E4260", letterSpacing: "0.02em" }}>{week}</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Navegación principal"
        style={{
          display: "flex", alignItems: "center", gap: 2, flex: 1,
          overflowX: "auto", scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch", msOverflowStyle: "none", scrollbarWidth: "none",
        }}
      >
        {TABS.map(([key, label]) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(key)}
              style={{
                ...BTN_BASE,
                background: isActive ? "rgba(201,168,76,0.10)" : "none",
                border: "none",
                borderRadius: 8,
                color: isActive ? "#C9A84C" : "#7A7F9A",
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                minHeight: 44,
                padding: "0 12px",
                scrollSnapAlign: "start",
                flexShrink: 0,
                transition: "color 0.15s, background 0.15s",
                boxShadow: isActive ? "inset 0 -2px 0 #C9A84C" : "none",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Right side controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {liveIndicatorState === "checkpoint" ? (
          <>
            <button
              onClick={onBackToLive}
              title="Volver al modo edición"
              style={{
                ...BTN_BASE,
                border: "1px solid #272B40",
                borderRadius: 8, color: "#7A7F9A",
                fontSize: 11, fontWeight: 500,
                minHeight: 36, padding: "0 12px",
              }}
            >
              ← Editar
            </button>
            <button
              onClick={onSaveCheckpoint}
              disabled={pdfGenerating}
              title="Generar PDF del checkpoint"
              style={{
                ...BTN_BASE,
                border: `1px solid ${pdfGenerating ? "#272B40" : "#C9A84C"}`,
                borderRadius: 8,
                color: pdfGenerating ? "#3E4260" : "#C9A84C",
                cursor: pdfGenerating ? "default" : "pointer",
                fontSize: 11, fontWeight: 600,
                minHeight: 36, padding: "0 12px",
                opacity: pdfGenerating ? 0.6 : 1,
              }}
            >
              {pdfGenerating ? "Generando..." : "Generar PDF"}
            </button>
          </>
        ) : (
          <>
            {onGeneratePdf && (
              <button
                onClick={onGeneratePdf}
                disabled={pdfGenerating}
                title="Generar PDF del reporte semanal (datos en vivo)"
                style={{
                  ...BTN_BASE,
                  border: `1px solid ${pdfGenerating ? "#272B40" : "#818cf8"}`,
                  borderRadius: 8,
                  color: pdfGenerating ? "#3E4260" : "#818cf8",
                  cursor: pdfGenerating ? "default" : "pointer",
                  fontSize: 11, fontWeight: 600,
                  minHeight: 36, padding: "0 12px",
                  opacity: pdfGenerating ? 0.6 : 1,
                }}
              >
                {pdfGenerating ? "Generando..." : "📄 PDF"}
              </button>
            )}
            <button
              onClick={onSaveCheckpoint}
              disabled={liveIndicatorState === "saving"}
              title="Guardar Checkpoint"
              style={{
                ...BTN_BASE,
                border: `1px solid ${liveIndicatorState === "saving" ? "#272B40" : "#C9A84C"}`,
                borderRadius: 8,
                color: liveIndicatorState === "saving" ? "#3E4260" : "#C9A84C",
                cursor: liveIndicatorState === "saving" ? "default" : "pointer",
                fontSize: 11, fontWeight: 600,
                minHeight: 36, padding: "0 12px",
                opacity: liveIndicatorState === "saving" ? 0.6 : 1,
              }}
            >
              {liveIndicatorState === "saving" ? "Guardando..." : "Checkpoint"}
            </button>
          </>
        )}

        {/* Refresh */}
        <button
          onClick={onRefresh}
          title="Actualizar datos"
          aria-label="Actualizar datos"
          disabled={refreshing}
          style={{
            ...BTN_BASE,
            border: "1px solid #1E2233",
            borderRadius: 8, color: "#7A7F9A",
            cursor: refreshing ? "default" : "pointer",
            fontSize: 15, minHeight: 36, minWidth: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: refreshing ? "sigob-spin 0.8s linear infinite" : "none",
          }}
        >
          ↻
        </button>

        {/* Cerrar sesión */}
        <button
          onClick={onLogout}
          style={{
            ...BTN_BASE,
            border: "1px solid #1E2233",
            borderRadius: 8, color: "#3E4260",
            fontSize: 11, minHeight: 36, padding: "0 10px",
          }}
        >
          Salir
        </button>
      </div>

      {/* LiveModeIndicator */}
      <div className="sigob-live-indicator">
        <LiveModeIndicator state={liveIndicatorState ?? "live"} />
      </div>
    </header>
  );
}
