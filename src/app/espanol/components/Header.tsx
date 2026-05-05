"use client";

import { T } from "../lib/tokens";
import { useEspanolStore } from "../lib/store";

export function Header() {
  const { streak, stats, vocab, done, difficulty } = useEspanolStore();
  const fluency = Math.min(100, Math.round(stats.fp * 0.5 + vocab.length * 0.4 + done.length * 3 + stats.shadowSessions * 2 + stats.listenSessions * 1.5));

  return (
    <div style={{ flexShrink: 0, padding: "14px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: T.gold, fontWeight: 700 }}>Espanol</span>
        <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: T.cream3, fontStyle: "italic" }}>OS</span>
        <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 9, color: T.goldD, background: `${T.gold}15`, padding: "2px 6px", borderRadius: 4, marginLeft: 4 }}>v2</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: T.s1, padding: "5px 12px", borderRadius: 20, border: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 12, color: T.cream3 }}>LV</span>
          <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 12, color: T.purple, fontWeight: 700 }}>{difficulty.level}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: T.s1, padding: "5px 12px", borderRadius: 20, border: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 13 }}>🔥</span>
          <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 12, color: T.gold, fontWeight: 700 }}>{streak.count}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: T.s1, padding: "5px 12px", borderRadius: 20, border: `1px solid ${T.border}` }}>
          <div style={{ width: 42, height: 4, background: T.s2, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${fluency}%`, height: "100%", background: T.gold, transition: "width .5s" }} />
          </div>
          <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 12, color: T.gold, fontWeight: 700 }}>{fluency}</span>
        </div>
      </div>
    </div>
  );
}
