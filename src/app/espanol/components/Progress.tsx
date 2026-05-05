"use client";

import { useState } from "react";
import { T } from "../lib/tokens";
import { useEspanolStore } from "../lib/store";
import { ERROR_CATEGORIES } from "../lib/data";

export function Progress() {
  const { stats, vocab, done, streak, difficulty, errorPatterns, shadowHistory, listenHistory } = useEspanolStore();
  const [showPassport, setShowPassport] = useState(false);

  const fluency = Math.min(100, Math.round(stats.fp * 0.5 + vocab.length * 0.4 + done.length * 3 + stats.shadowSessions * 2 + stats.listenSessions * 1.5));
  const fluencyLabel = fluency < 15 ? "Principiante" : fluency < 35 ? "Basico" : fluency < 55 ? "Intermedio" : fluency < 75 ? "Avanzado" : "Fluido";

  const avgShadow = shadowHistory.length > 0
    ? Math.round(shadowHistory.slice(-10).reduce((a, b) => a + b.overallScore, 0) / Math.min(10, shadowHistory.length))
    : 0;
  const avgListen = listenHistory.length > 0
    ? Math.round(listenHistory.slice(-10).reduce((a, b) => a + b.score, 0) / Math.min(10, listenHistory.length))
    : 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.cream }}>Progreso</div>
        <button className="press" onClick={() => setShowPassport(true)}
          style={{ padding: "6px 14px", borderRadius: 10, background: `${T.gold}15`, border: `1px solid ${T.gold}30`, color: T.gold, fontSize: 11, fontWeight: 700 }}>
          🛂 Pasaporte
        </button>
      </div>

      {/* Fluency card */}
      <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px 18px", marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: T.cream3, fontWeight: 700, letterSpacing: "2px", marginBottom: 12 }}>FLUIDEZ</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
          <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 52, color: T.gold, fontWeight: 700, lineHeight: 1 }}>{fluency}</div>
          <div style={{ fontSize: 16, color: T.cream3 }}>/100</div>
        </div>
        <div style={{ height: 6, background: T.s2, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ width: `${fluency}%`, height: "100%", background: `linear-gradient(90deg,${T.goldD},${T.goldL})`, borderRadius: 3, transition: "width .8s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: T.cream3 }}>{fluencyLabel}</span>
          <span style={{ fontSize: 12, color: T.purple }}>Nivel adaptivo: {difficulty.level}/10</span>
        </div>
      </div>

      {/* Streak + Level */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px", flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>🔥</span>
          <div>
            <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 28, color: T.gold, fontWeight: 700, lineHeight: 1 }}>{streak.count}</div>
            <div style={{ fontSize: 10, color: T.cream3, marginTop: 2 }}>DIAS</div>
          </div>
        </div>
        <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px", flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>📊</span>
          <div>
            <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 28, color: T.blue, fontWeight: 700, lineHeight: 1 }}>{stats.avgFluency || 0}</div>
            <div style={{ fontSize: 10, color: T.cream3, marginTop: 2 }}>AVG FP</div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Mensajes", val: stats.msgs, c: T.gold },
          { label: "Correcciones", val: stats.corrections, c: T.red },
          { label: "Palabras", val: vocab.length, c: T.blue },
          { label: "Misiones", val: done.length, c: T.green },
          { label: "Shadowing", val: stats.shadowSessions, c: T.purple },
          { label: "Escuchar", val: stats.listenSessions, c: T.orange },
        ].map((s, i) => (
          <div key={i} style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px" }}>
            <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 22, color: s.c, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: T.cream3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Mode scores */}
      {(avgShadow > 0 || avgListen > 0) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {avgShadow > 0 && (
            <div style={{ flex: 1, background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: T.cream3, marginBottom: 4 }}>SHADOW AVG</div>
              <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 24, color: T.purple, fontWeight: 700 }}>{avgShadow}%</div>
            </div>
          )}
          {avgListen > 0 && (
            <div style={{ flex: 1, background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: T.cream3, marginBottom: 4 }}>LISTEN AVG</div>
              <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 24, color: T.blue, fontWeight: 700 }}>{avgListen}%</div>
            </div>
          )}
        </div>
      )}

      {/* Error Pattern Intelligence */}
      {errorPatterns.length > 0 && (
        <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: T.red, fontWeight: 700, letterSpacing: "2px", marginBottom: 12 }}>ERROR INTELLIGENCE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {errorPatterns.sort((a, b) => b.rate - a.rate).slice(0, 5).map(ep => (
              <div key={ep.category} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: T.cream, marginBottom: 2 }}>{ERROR_CATEGORIES[ep.category] || ep.label}</div>
                  <div style={{ height: 4, background: T.s2, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${ep.rate * 100}%`, height: "100%", background: ep.rate > 0.7 ? T.red : ep.rate > 0.4 ? T.orange : T.green, transition: "width .5s" }} />
                  </div>
                </div>
                <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 12, color: ep.rate > 0.7 ? T.red : ep.rate > 0.4 ? T.orange : T.green, fontWeight: 700 }}>
                  {Math.round(ep.rate * 100)}%
                </span>
                <span style={{ fontSize: 10, color: T.cream3 }}>({ep.count}/{ep.total})</span>
              </div>
            ))}
          </div>
          {errorPatterns[0]?.examples?.length > 0 && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              <div style={{ fontSize: 10, color: T.cream3, marginBottom: 6 }}>ULTIMO ERROR</div>
              <div style={{ fontSize: 12, color: T.red, fontFamily: "JetBrains Mono,monospace" }}>
                {errorPatterns.sort((a, b) => b.rate - a.rate)[0]?.examples.slice(-1)[0]?.original}
              </div>
              <div style={{ fontSize: 12, color: T.green, fontFamily: "JetBrains Mono,monospace", marginTop: 2 }}>
                → {errorPatterns.sort((a, b) => b.rate - a.rate)[0]?.examples.slice(-1)[0]?.correction}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fluency Passport Modal */}
      {showPassport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setShowPassport(false)}>
          <div style={{ background: `linear-gradient(135deg, ${T.s1}, ${T.s2})`, border: `2px solid ${T.gold}40`, borderRadius: 20, padding: "28px 24px", maxWidth: 340, width: "100%", position: "relative" }}
            onClick={e => e.stopPropagation()}>
            {/* Gold corner accents */}
            <div style={{ position: "absolute", top: 8, left: 8, width: 20, height: 20, borderTop: `2px solid ${T.gold}`, borderLeft: `2px solid ${T.gold}`, borderRadius: "4px 0 0 0" }} />
            <div style={{ position: "absolute", top: 8, right: 8, width: 20, height: 20, borderTop: `2px solid ${T.gold}`, borderRight: `2px solid ${T.gold}`, borderRadius: "0 4px 0 0" }} />
            <div style={{ position: "absolute", bottom: 8, left: 8, width: 20, height: 20, borderBottom: `2px solid ${T.gold}`, borderLeft: `2px solid ${T.gold}`, borderRadius: "0 0 0 4px" }} />
            <div style={{ position: "absolute", bottom: 8, right: 8, width: 20, height: 20, borderBottom: `2px solid ${T.gold}`, borderRight: `2px solid ${T.gold}`, borderRadius: "0 0 4px 0" }} />

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: "3px", marginBottom: 6 }}>FLUENCY PASSPORT</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: T.cream }}>Espanol OS</div>
              <div style={{ fontSize: 11, color: T.cream3, marginTop: 4 }}>Colombian Spanish</div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${T.gold}30, ${T.goldD}30)`, border: `2px solid ${T.gold}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 32, color: T.gold, fontWeight: 700 }}>{fluency}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 20, color: T.cream, fontWeight: 700 }}>{stats.msgs}</div>
                <div style={{ fontSize: 10, color: T.cream3 }}>Mensajes</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 20, color: T.cream, fontWeight: 700 }}>{stats.convos}</div>
                <div style={{ fontSize: 10, color: T.cream3 }}>Conversaciones</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 20, color: T.cream, fontWeight: 700 }}>{done.length}/15</div>
                <div style={{ fontSize: 10, color: T.cream3 }}>Misiones</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 20, color: T.cream, fontWeight: 700 }}>{streak.count}</div>
                <div style={{ fontSize: 10, color: T.cream3 }}>Dias activo</div>
              </div>
            </div>

            <div style={{ textAlign: "center", padding: "10px 0", borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.cream3 }}>{fluencyLabel} — Level {difficulty.level}</div>
              <div style={{ fontSize: 10, color: T.goldD, marginTop: 4 }}>machinemindconsulting.com/espanol</div>
            </div>

            <button className="press" onClick={() => setShowPassport(false)}
              style={{ marginTop: 12, width: "100%", padding: "12px", borderRadius: 12, background: T.s2, border: `1px solid ${T.border}`, color: T.cream3, fontSize: 13 }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
