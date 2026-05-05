"use client";

import { useState } from "react";
import { T } from "../lib/tokens";
import { useEspanolStore } from "../lib/store";
import { MISSIONS, CULTURAL_BRIEFS, SCENARIOS } from "../lib/data";
import { speak } from "../lib/speech";

export function Missions() {
  const store = useEspanolStore();
  const { done, setTab } = store;
  const [showBrief, setShowBrief] = useState<string | null>(null);

  const weekNames: Record<number, string> = { 1: "Supervivencia", 2: "Movilidad", 3: "Social + Mujeres", 4: "Fluidez" };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.cream, marginBottom: 6 }}>15 Misiones.</div>
        <div style={{ fontSize: 14, color: T.cream3, lineHeight: 1.7 }}>Una por dia. Presion real = memoria permanente.</div>
        <div style={{ marginTop: 8, fontSize: 12, color: T.goldD }}>
          {done.length}/15 completadas
        </div>
      </div>

      {/* Cultural Brief Modal */}
      {showBrief && CULTURAL_BRIEFS[showBrief] && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setShowBrief(null)}>
          <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 18, padding: "24px 20px", maxWidth: 380, maxHeight: "80vh", overflowY: "auto", width: "100%" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 4 }}>BRIEF CULTURAL</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.cream }}>{CULTURAL_BRIEFS[showBrief].title}</div>
                <div style={{ fontSize: 11, color: T.cream3, marginTop: 2 }}>{CULTURAL_BRIEFS[showBrief].duration}</div>
              </div>
              <button onClick={() => setShowBrief(null)} style={{ color: T.cream3, fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>

            {CULTURAL_BRIEFS[showBrief].content.map((c, i) => (
              <div key={i} style={{ fontSize: 13, color: T.cream2, lineHeight: 1.8, paddingLeft: 12, borderLeft: `2px solid ${T.gold}30`, marginBottom: 10 }}>{c}</div>
            ))}

            {CULTURAL_BRIEFS[showBrief].tips.length > 0 && (
              <div style={{ marginTop: 14, background: `${T.green}08`, border: `1px solid ${T.green}20`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: T.green, fontWeight: 700, letterSpacing: "1px", marginBottom: 6 }}>TIPS</div>
                {CULTURAL_BRIEFS[showBrief].tips.map((t, i) => (
                  <div key={i} style={{ fontSize: 12, color: T.cream2, lineHeight: 1.7, marginBottom: 4 }}>• {t}</div>
                ))}
              </div>
            )}

            {CULTURAL_BRIEFS[showBrief].warnings.length > 0 && (
              <div style={{ marginTop: 10, background: `${T.red}08`, border: `1px solid ${T.red}20`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: T.red, fontWeight: 700, letterSpacing: "1px", marginBottom: 6 }}>CUIDADO</div>
                {CULTURAL_BRIEFS[showBrief].warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 12, color: T.cream2, lineHeight: 1.7, marginBottom: 4 }}>⚠ {w}</div>
                ))}
              </div>
            )}

            <button className="press" onClick={() => setShowBrief(null)}
              style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 12, background: T.gold, color: "#000", fontSize: 14, fontWeight: 700 }}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {([1, 2, 3, 4] as const).map(wk => {
        const wm = MISSIONS.filter(m => m.w === wk);
        return (
          <div key={wk} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: T.cream3, fontWeight: 700, letterSpacing: "2px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              SEMANA {wk} — {weekNames[wk]}
              <div style={{ flex: 1, height: 1, background: T.border }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {wm.map(m => {
                const isDone = done.includes(m.id);
                return (
                  <div key={m.id} style={{ background: T.s1, border: `1.5px solid ${isDone ? T.green + "30" : T.border}`, borderRadius: 14, padding: "14px 16px", opacity: isDone ? .6 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 9, color: T.cream3, fontWeight: 600, letterSpacing: "1px" }}>DIA {m.day}</span>
                          <div style={{ display: "flex", gap: 2 }}>
                            {Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i < m.diff ? T.gold : T.s2 }} />)}
                          </div>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: isDone ? T.cream3 : T.cream, marginBottom: 5 }}>{m.icon} {m.title}</div>
                        <div style={{ fontSize: 13, color: T.cream3, lineHeight: 1.65, marginBottom: 8 }}>{m.desc}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {m.vocab.map((v, i) => (
                            <button key={i} className="press" onClick={() => speak(v)}
                              style={{ fontSize: 11, color: T.cream3, background: T.s2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "3px 9px", fontStyle: "italic" }}>
                              🔊 {v}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                        {/* Cultural brief button */}
                        {m.cultural && CULTURAL_BRIEFS[m.cultural] && (
                          <button className="press" onClick={() => setShowBrief(m.cultural!)}
                            style={{ background: `${T.blue}12`, border: `1px solid ${T.blue}30`, borderRadius: 10, padding: "8px 12px", fontSize: 11, fontWeight: 600, color: T.blue }}>
                            📖 Brief
                          </button>
                        )}
                        {!isDone && (
                          <button className="press" onClick={() => { setTab("talk"); }}
                            style={{ background: T.gold, color: "#000", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700 }}>
                            Practicar
                          </button>
                        )}
                        <button className="press" onClick={() => !isDone && store.completeMission(m.id)}
                          style={{ background: isDone ? `${T.green}15` : "none", border: `1.5px solid ${isDone ? T.green + "40" : T.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, color: isDone ? T.green : T.cream3 }}>
                          {isDone ? "✓ Hecha" : "Marcar"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
