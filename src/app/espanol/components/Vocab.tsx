"use client";

import { useState } from "react";
import { T } from "../lib/tokens";
import { useEspanolStore } from "../lib/store";
import { speak } from "../lib/speech";

export function Vocab() {
  const { vocab } = useEspanolStore();
  const [filter, setFilter] = useState<"all" | "hard" | "recent">("all");
  const [expandedWord, setExpandedWord] = useState<string | null>(null);

  const filtered = [...vocab].reverse().filter(v => {
    if (filter === "hard") return (v.difficulty || 1) >= 2;
    if (filter === "recent") return vocab.indexOf(v) >= vocab.length - 15;
    return true;
  });

  const hardCount = vocab.filter(v => (v.difficulty || 1) >= 2).length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.cream, marginBottom: 6 }}>Tu Vocabulario</div>
        <div style={{ fontSize: 14, color: T.cream3 }}>{vocab.length} palabras • {hardCount} dificiles</div>
      </div>

      {vocab.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: T.cream3 }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>📚</div>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>Empieza a conversar.<br />Tu banco crece solo.</div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {([["all", "Todas"], ["hard", "Dificiles"], ["recent", "Recientes"]] as const).map(([id, label]) => (
              <button key={id} className="press" onClick={() => setFilter(id)}
                style={{ padding: "6px 14px", borderRadius: 10, background: filter === id ? `${T.gold}18` : T.s1, border: `1.5px solid ${filter === id ? T.gold + "50" : T.border}`, color: filter === id ? T.gold : T.cream3, fontSize: 12, fontWeight: 600 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Review section */}
          <div style={{ marginBottom: 14, background: `${T.gold}0a`, border: `1px solid ${T.gold}22`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: T.goldD, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 8 }}>REPASAR AHORA</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {vocab.slice(-8).map((v, i) => (
                <button key={i} className="press" onClick={() => speak(v.es)}
                  style={{ padding: "5px 11px", borderRadius: 12, background: `${T.gold}10`, border: `1px solid ${T.gold}22`, fontSize: 13, color: T.goldD, fontStyle: "italic" }}>
                  🔊 {v.es}
                </button>
              ))}
            </div>
          </div>

          {/* Word list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((v, i) => (
              <div key={i}
                onClick={() => setExpandedWord(expandedWord === v.es ? null : v.es)}
                style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, color: T.cream, fontStyle: "italic" }}>{v.es}</span>
                      {(v.difficulty || 1) >= 3 && <span style={{ fontSize: 9, color: T.red, background: `${T.red}15`, padding: "1px 5px", borderRadius: 4 }}>HARD</span>}
                      {(v.difficulty || 1) === 2 && <span style={{ fontSize: 9, color: T.orange, background: `${T.orange}15`, padding: "1px 5px", borderRadius: 4 }}>MED</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.cream3, marginTop: 2 }}>{v.en}</div>
                  </div>
                  <button className="press" onClick={(e) => { e.stopPropagation(); speak(v.es); }} style={{ fontSize: 18, opacity: .3, background: "none", border: "none", cursor: "pointer" }}>🔊</button>
                </div>

                {/* Expanded details */}
                {expandedWord === v.es && (
                  <div className="popIn" style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                    {v.phonetic && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: T.blue, fontWeight: 700, letterSpacing: "1px", marginBottom: 3 }}>FONETICA</div>
                        <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 13, color: T.blue }}>{v.phonetic}</div>
                      </div>
                    )}
                    {v.soundsLike && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: T.cream3, fontWeight: 700, letterSpacing: "1px", marginBottom: 3 }}>SUENA COMO</div>
                        <div style={{ fontSize: 13, color: T.cream2 }}>{v.soundsLike}</div>
                      </div>
                    )}
                    {v.pronunciationWarning && (
                      <div style={{ background: `${T.red}08`, border: `1px solid ${T.red}20`, borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 10, color: T.red, fontWeight: 700, marginBottom: 2 }}>⚠ PRONUNCIACION</div>
                        <div style={{ fontSize: 12, color: T.cream2 }}>{v.pronunciationWarning}</div>
                      </div>
                    )}
                    {v.timesSeen && (
                      <div style={{ fontSize: 11, color: T.cream3, marginTop: 6 }}>
                        Visto {v.timesSeen}x {v.lastSeen ? `• Ultimo: ${new Date(v.lastSeen).toLocaleDateString()}` : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
