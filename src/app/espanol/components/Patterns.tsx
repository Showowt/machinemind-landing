"use client";

import { useState } from "react";
import { T } from "../lib/tokens";
import { useEspanolStore } from "../lib/store";
import { PATTERNS } from "../lib/data";
import { speak } from "../lib/speech";

export function Patterns() {
  const { errorPatterns, setTab } = useEspanolStore();
  const [expandPat, setExpandPat] = useState<string | null>(null);
  const [practiceText, setPracticeText] = useState<Record<string, string>>({});

  // Sort patterns by weakness — put user's weak areas first
  const weakCategories = errorPatterns.map(e => e.category);
  const sortedPatterns = [...PATTERNS].sort((a, b) => {
    const aWeak = weakCategories.includes(a.id) ? 1 : 0;
    const bWeak = weakCategories.includes(b.id) ? 1 : 0;
    return bWeak - aWeak;
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.cream, marginBottom: 6 }}>10 Patrones.</div>
        <div style={{ fontSize: 14, color: T.cream3, lineHeight: 1.75 }}>Cada uno desbloquea cientos de frases. Los marcados con 🔴 son tus areas debiles.</div>
      </div>

      {/* Weak patterns alert */}
      {errorPatterns.length > 0 && (
        <div style={{ background: `${T.red}08`, border: `1px solid ${T.red}25`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: T.red, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 8 }}>TUS ERRORES MAS FRECUENTES</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {errorPatterns.slice(0, 4).sort((a, b) => b.rate - a.rate).map(ep => (
              <div key={ep.category} style={{ padding: "5px 10px", borderRadius: 8, background: `${T.red}12`, border: `1px solid ${T.red}20`, fontSize: 12, color: T.red }}>
                {ep.label} ({Math.round(ep.rate * 100)}%)
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sortedPatterns.map(p => {
          const weakMatch = errorPatterns.find(e => e.category === p.id);
          return (
            <div key={p.id} className="press" onClick={() => setExpandPat(expandPat === p.id ? null : p.id)}
              style={{ background: T.s1, border: `1.5px solid ${expandPat === p.id ? p.color + "50" : weakMatch ? T.red + "30" : T.border}`, borderRadius: 14, overflow: "hidden", transition: "border-color .2s", cursor: "pointer" }}>
              <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: T.cream3 }}>#{p.n.toString().padStart(2, "0")}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.cream }}>{p.name}</span>
                    {weakMatch && <span style={{ fontSize: 10, color: T.red }}>🔴 {Math.round(weakMatch.rate * 100)}%</span>}
                  </div>
                  <div style={{ fontSize: 12, color: T.cream3, marginBottom: 6 }}>{p.sub}</div>
                  <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 11, color: p.color, background: `${p.color}12`, padding: "3px 9px", borderRadius: 6, display: "inline-block" }}>{p.formula}</div>
                </div>
                <span style={{ color: T.cream3, fontSize: 12, marginTop: 2, flexShrink: 0 }}>{expandPat === p.id ? "▲" : "▼"}</span>
              </div>
              {expandPat === p.id && (
                <div style={{ borderTop: `1px solid ${T.border}`, padding: "14px 16px" }} onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: 13, color: T.cream2, lineHeight: 1.8, background: T.s2, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>{p.rule}</div>
                  {p.ex.map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
                      <button onClick={() => speak(e.es)} style={{ opacity: .35, fontSize: 15, flexShrink: 0, background: "none", border: "none", cursor: "pointer" }}>🔊</button>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: T.cream, fontStyle: "italic", marginBottom: 2 }}>&ldquo;{e.es}&rdquo;</div>
                        <div style={{ fontSize: 12, color: T.cream3 }}>{e.en}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 12, background: `${p.color}0d`, border: `1px solid ${p.color}25`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: p.color, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 4 }}>DRILL</div>
                    <div style={{ fontSize: 13, color: T.cream3, lineHeight: 1.7 }}>{p.drill}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={practiceText[p.id] || ""} onChange={e => setPracticeText(prev => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="Tu intento en espanol..."
                      style={{ flex: 1, background: T.s2, border: `1.5px solid ${T.border}`, borderRadius: 10, color: T.cream, fontSize: 14, padding: "10px 13px", fontFamily: "'Plus Jakarta Sans',sans-serif" }} />
                    <button className="press" style={{ background: p.color, color: "#000", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}
                      onClick={() => { if (practiceText[p.id]) { setTab("talk"); } }}>
                      Practicar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
