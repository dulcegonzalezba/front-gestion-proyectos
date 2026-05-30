import { useState, useEffect, ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface SplitLayoutProps {
  leftContent: ReactNode;
  children: ReactNode;
}

export default function SplitLayout({ leftContent, children }: SplitLayoutProps) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 1023px)").matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <div
          style={{
            padding: "8px 16px",
            borderBottom: "1px solid #1E2233",
            background: "#0F1117",
            flexShrink: 0,
          }}
        >
          <Sheet>
            <SheetTrigger asChild>
              <button
                style={{
                  background: "none",
                  border: "1px solid #1E2233",
                  borderRadius: 8,
                  color: "#7A7F9A",
                  cursor: "pointer",
                  padding: "8px 14px",
                  minHeight: 44,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                ☰ Filtrar
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              style={{
                width: 220,
                background: "#0F1117",
                borderRight: "1px solid #1E2233",
                padding: 0,
              }}
            >
              <SheetTitle className="sr-only">Panel de filtros</SheetTitle>
              {leftContent}
            </SheetContent>
          </Sheet>
        </div>
        <main style={{ flex: 1, overflowY: "auto", background: "#09090C" }}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <aside
        aria-label="Panel de filtros"
        style={{
          width: 220,
          flexShrink: 0,
          overflowY: "auto",
          borderRight: "1px solid #1E2233",
          background: "#0F1117",
        }}
      >
        {leftContent}
      </aside>
      <main style={{ flex: 1, overflowY: "auto", background: "#09090C" }}>
        {children}
      </main>
    </div>
  );
}
