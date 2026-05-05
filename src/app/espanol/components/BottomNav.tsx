"use client";

import { T } from "../lib/tokens";
import { useEspanolStore } from "../lib/store";
import type { TabId } from "../lib/types";
import type { ReactNode } from "react";

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: "talk", label: "Hablar", icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { id: "shadow", label: "Shadow", icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="1.7"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M12 19v4M8 23h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg> },
  { id: "listen", label: "Escuchar", icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M3 18v-6a9 9 0 0 1 18 0v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" stroke="currentColor" strokeWidth="1.7"/></svg> },
  { id: "patterns", label: "Patrones", icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M4 6h16M4 11h16M4 16h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg> },
  { id: "missions", label: "Misiones", icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { id: "vocab", label: "Vocab", icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { id: "photo", label: "Foto", icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.7"/></svg> },
  { id: "progress", label: "Progreso", icon: <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg> },
];

export function BottomNav() {
  const { tab, setTab } = useEspanolStore();

  return (
    <div style={{ flexShrink: 0, background: T.bg, borderTop: `1px solid ${T.border}`, display: "flex", paddingBottom: "env(safe-area-inset-bottom,0px)", overflowX: "auto" }}>
      {TABS.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)}
          style={{ flex: 1, minWidth: 0, padding: "10px 2px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: tab === t.id ? T.gold : T.cream3, transition: "color .2s", background: "none", border: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
          <div style={{ opacity: tab === t.id ? 1 : .35, transition: "opacity .2s" }}>{t.icon}</div>
          <span style={{ fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" }}>{t.label}</span>
          {tab === t.id && <div style={{ width: 14, height: 2, borderRadius: 2, background: T.gold }} />}
        </button>
      ))}
    </div>
  );
}
