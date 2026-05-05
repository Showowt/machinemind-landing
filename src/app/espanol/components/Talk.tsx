"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { T } from "../lib/tokens";
import { useEspanolStore } from "../lib/store";
import { SCENARIOS, QUICK } from "../lib/data";
import { buildConversationPrompt, sendMessage } from "../lib/api";
import { speak, AudioRecorder, transcribeAudio } from "../lib/speech";
import type { Scenario, Message, AIData, CorrectionData } from "../lib/types";

export function Talk() {
  const store = useEspanolStore();
  const { messages, corrections, vocab, stats, difficulty, errorPatterns } = store;

  const [sc, setSc] = useState<Scenario>(SCENARIOS[0]);
  const [inp, setInp] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showEN, setShowEN] = useState(true);
  const [showQuick, setShowQuick] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState<number | null>(null);

  const recorderRef = useRef(new AudioRecorder());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const toggleRecord = useCallback(async () => {
    if (recording) {
      const blob = await recorderRef.current.stop();
      setRecording(false);
      const text = await transcribeAudio(blob);
      if (text) { setInp(prev => (prev ? prev + " " : "") + text); inputRef.current?.focus(); }
    } else {
      const ok = await recorderRef.current.start();
      if (ok) setRecording(true);
      else alert("Microphone access required.");
    }
  }, [recording]);

  const send = useCallback(async () => {
    if (!inp.trim() || loading) return;
    const txt = inp.trim();
    const userMsgId = Date.now();
    const uMsg: Message = { role: "user", text: txt, id: userMsgId };
    store.addMessage(uMsg);
    setInp(""); setLoading(true); setShowQuick(false); setExpandedMsg(null);
    store.updateStreak();

    const allMsgs = [...messages, uMsg];
    const apiMsgs = allMsgs.map(m => ({
      role: m.role === "user" ? "user" as const : "assistant" as const,
      content: m.role === "user" ? (m.text || "") : (m.raw || "{}"),
    }));

    const weakPatterns = store.getWeakestPatterns(3).map(p => p.label);
    const system = buildConversationPrompt(sc, difficulty.level, weakPatterns);

    try {
      const d: AIData = await sendMessage(system, apiMsgs);
      const aiMsg: Message = { role: "ai", d, raw: JSON.stringify(d), id: Date.now(), userMsgId };
      store.addMessage(aiMsg);

      // Store correction data
      const corrData: CorrectionData = {
        correction: d.correction || null,
        correction_note: d.correction_note || null,
        fp: d.fluency_points || 0,
        pattern_name: d.pattern_name || null,
        pattern_formula: d.pattern_formula || null,
        flow_connector: d.flow_connector || null,
        flow_connector_meaning: d.flow_connector_meaning || null,
        new_vocab: d.new_vocab || [],
        vibe: d.vibe || null,
        error_category: d.error_category || undefined,
      };
      store.setCorrection(userMsgId, corrData);

      // Auto-expand if correction
      if (d.correction) setExpandedMsg(userMsgId);

      // Record error pattern
      if (d.correction && d.error_category) {
        store.recordError(d.error_category, txt, d.correction);
      }

      // Record fluency for adaptive difficulty
      if (d.fluency_points) store.recordFluencyScore(d.fluency_points);

      // Add vocab
      if (d.new_vocab && d.new_vocab.length > 0) store.addVocab(d.new_vocab);

      // Update stats
      store.updateStats(prev => ({
        ...prev,
        msgs: prev.msgs + 1,
        corrections: prev.corrections + (d.correction ? 1 : 0),
        fp: prev.fp + (d.fluency_points || 0),
        avgFluency: Math.round(((prev.avgFluency * prev.msgs) + (d.fluency_points || 0)) / (prev.msgs + 1)),
      }));

      // Periodic sync
      if ((stats.msgs + 1) % 5 === 0) store.syncToSupabase();
    } catch {
      store.addMessage({ role: "ai", d: { response_es: "Error de conexion. Intenta de nuevo.", response_en: "Connection error." }, raw: "{}", id: Date.now(), userMsgId });
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [inp, loading, messages, sc, difficulty, stats, store]);

  const newConvo = useCallback(() => {
    store.clearMessages(); store.clearCorrections(); setShowQuick(false); setExpandedMsg(null);
    store.updateStats(prev => ({ ...prev, convos: prev.convos + 1 }));
  }, [store]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Scenario pills */}
      <div style={{ flexShrink: 0, overflowX: "auto", display: "flex", gap: 7, padding: "4px 18px 12px" }}>
        {SCENARIOS.map(s => (
          <button key={s.id} className="press"
            onClick={() => { setSc(s); newConvo(); }}
            style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${sc.id === s.id ? s.color + "70" : T.border}`, background: sc.id === s.id ? s.color + "15" : T.s1, color: sc.id === s.id ? s.color : T.cream3, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, transition: "all .18s" }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Persona header */}
      <div style={{ flexShrink: 0, marginBottom: 2, padding: "6px 18px 8px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: sc.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{sc.avatarLetter}</span>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.cream, lineHeight: 1.2 }}>{sc.personaName}, {sc.personaAge}</div>
          <div style={{ fontSize: 11, color: T.cream3 }}>{sc.personaDesc}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }} />
          <span style={{ fontSize: 11, color: T.cream3 }}>en linea</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px 0" }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80%", gap: 10, textAlign: "center", padding: "0 16px 60px" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: sc.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 2 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{sc.avatarLetter}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.cream }}>{sc.personaName}</div>
            <div style={{ fontSize: 13, color: T.cream3, lineHeight: 1.7, maxWidth: 240 }}>{sc.personaDesc}</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, color: T.s3, fontStyle: "italic", marginTop: 8 }}>Habla.</div>
            <div style={{ fontSize: 13, color: T.cream3, lineHeight: 1.8 }}>Escribe cualquier cosa en espanol.<br /><span style={{ color: T.goldD }}>Roto esta bien.</span></div>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {(QUICK[sc.id] || []).map((q, i) => (
                <button key={i} className="press" onClick={() => setInp(q)}
                  style={{ padding: "7px 13px", borderRadius: 16, border: `1px solid ${T.border}`, background: T.s1, color: T.cream2, fontSize: 12, fontStyle: "italic" }}>
                  &ldquo;{q}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 12 }}>
          {messages.map(msg => {
            if (msg.role === "user") {
              const corrData = corrections[msg.id];
              const isExpanded = expandedMsg === msg.id;
              const hasCorrData = corrData !== undefined;
              const hasError = hasCorrData && corrData.correction;

              return (
                <div key={msg.id} className="msg" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                    {hasCorrData && (
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: hasError ? T.red : T.green, flexShrink: 0, marginTop: 6 }} />
                    )}
                    <button className="press" onClick={() => { if (hasCorrData) setExpandedMsg(isExpanded ? null : msg.id); }}
                      style={{ background: T.s2, borderLeft: `3px solid ${sc.color}`, borderRadius: "18px 18px 4px 18px", padding: "11px 15px", maxWidth: "80%", fontSize: 15, lineHeight: 1.6, color: T.cream, textAlign: "left", cursor: hasCorrData ? "pointer" : "default", borderTop: "none", borderRight: "none", borderBottom: "none" }}>
                      {msg.text}
                    </button>
                  </div>
                  {hasCorrData && !isExpanded && (
                    <div style={{ fontSize: 10, color: T.cream3, paddingRight: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: hasError ? T.red : T.green }} />
                      {hasError ? "Toca para ver correccion" : "correcto"}
                    </div>
                  )}
                  {isExpanded && hasCorrData && (
                    <div className="popIn" style={{ width: "86%", background: T.s1, border: `1px solid ${hasError ? T.red + "40" : T.green + "40"}`, borderRadius: 12, padding: "12px 14px" }}>
                      {/* FP bar */}
                      <div style={{ display: "flex", gap: 2, marginBottom: 8, alignItems: "center" }}>
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} style={{ width: 16, height: 4, borderRadius: 2, background: i < (corrData.fp || 0) ? T.gold : T.s3, flex: 1 }} />
                        ))}
                        <span style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: T.gold, marginLeft: 6, flexShrink: 0 }}>{corrData.fp}/10</span>
                      </div>

                      {!hasError && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: T.green, fontSize: 15 }}>✓</span>
                          <span style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>Sin errores gramaticales</span>
                        </div>
                      )}

                      {hasError && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: T.red, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 5 }}>CORRECCION</div>
                          <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 13, color: T.red, lineHeight: 1.5, background: `${T.red}0d`, padding: "8px 10px", borderRadius: 8 }}>
                            {corrData.correction}
                          </div>
                          {corrData.correction_note && (
                            <div style={{ fontSize: 12, color: "#8a5555", marginTop: 5, lineHeight: 1.6 }}>{corrData.correction_note}</div>
                          )}
                          {corrData.error_category && (
                            <div style={{ fontSize: 10, color: T.orange, marginTop: 4, fontStyle: "italic" }}>Categoria: {corrData.error_category.replace(/_/g, " ")}</div>
                          )}
                        </div>
                      )}

                      {corrData.vibe && (
                        <div style={{ fontSize: 12, color: T.goldD, fontStyle: "italic", borderTop: `1px solid ${T.border}`, paddingTop: 6, marginTop: 6 }}>{corrData.vibe}</div>
                      )}

                      {corrData.pattern_name && (
                        <div style={{ marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
                          <div style={{ fontSize: 10, color: T.goldD, fontWeight: 700, letterSpacing: "1px", marginBottom: 3 }}>PATRON</div>
                          <div style={{ fontSize: 12, color: T.gold }}>{corrData.pattern_name}</div>
                          {corrData.pattern_formula && <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 10, color: T.goldD, marginTop: 2 }}>{corrData.pattern_formula}</div>}
                        </div>
                      )}

                      {corrData.flow_connector && (
                        <button className="press" onClick={() => { setInp(p => (p ? p + " " : "") + corrData.flow_connector); setExpandedMsg(null); inputRef.current?.focus(); }}
                          style={{ marginTop: 8, width: "100%", padding: "8px 12px", borderRadius: 10, background: `${T.blue}12`, border: `1px solid ${T.blue}35`, color: T.blue, fontSize: 13, fontWeight: 600, fontStyle: "italic", textAlign: "left" }}>
                          Di ahora → &ldquo;{corrData.flow_connector}&rdquo;
                          <span style={{ fontSize: 11, color: T.cream3, fontStyle: "normal", marginLeft: 4 }}>({corrData.flow_connector_meaning})</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // AI message
            return (
              <div key={msg.id} className="msg" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: sc.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{sc.avatarLetter}</span>
                  </div>
                  <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", fontSize: 15, lineHeight: 1.7, color: T.cream, maxWidth: "82%" }}>
                    {msg.d?.response_es}
                  </div>
                  {msg.d?.response_es && (
                    <button onClick={() => speak(msg.d!.response_es!)} style={{ opacity: .3, fontSize: 15, paddingBottom: 4, flexShrink: 0, background: "none", border: "none", cursor: "pointer" }}>🔊</button>
                  )}
                </div>
                {showEN && msg.d?.response_en && (
                  <div style={{ fontSize: 12, color: T.cream3, paddingLeft: 34, fontStyle: "italic", lineHeight: 1.6 }}>{msg.d.response_en}</div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: sc.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{sc.avatarLetter}</span>
              </div>
              <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px" }}>
                <div className="dot" /><div className="dot" /><div className="dot" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Quick phrases */}
      {showQuick && (
        <div style={{ flexShrink: 0, background: T.s1, borderTop: `1px solid ${T.border}`, padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(QUICK[sc.id] || []).map((q, i) => (
            <button key={i} className="press" onClick={() => { setInp(q); setShowQuick(false); inputRef.current?.focus(); }}
              style={{ padding: "6px 12px", borderRadius: 14, background: T.s2, border: `1px solid ${T.border}`, color: T.cream2, fontSize: 13, fontStyle: "italic" }}>
              &ldquo;{q}&rdquo;
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ flexShrink: 0, padding: "10px 14px", paddingBottom: "calc(10px + env(safe-area-inset-bottom,0px))", background: T.bg, borderTop: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto" }}>
          <button className="press" onClick={() => setShowQuick(p => !p)}
            style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 14, background: showQuick ? `${T.blue}18` : T.s1, border: `1px solid ${showQuick ? T.blue + "50" : T.border}`, color: showQuick ? T.blue : T.cream3, fontSize: 12, fontWeight: 600 }}>
            Frases
          </button>
          <button className="press" onClick={() => setShowEN(p => !p)}
            style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 14, background: T.s1, border: `1px solid ${T.border}`, color: T.cream3, fontSize: 12, fontWeight: 600 }}>
            EN {showEN ? "✓" : "✗"}
          </button>
          <button className="press" onClick={newConvo}
            style={{ flexShrink: 0, padding: "5px 12px", borderRadius: 14, background: T.s1, border: `1px solid ${T.border}`, color: T.cream3, fontSize: 12, fontWeight: 600, marginLeft: "auto" }}>
            Nueva
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button className={`press ${recording ? "rec-pulse" : ""}`} onClick={toggleRecord}
            style={{ width: 48, height: 48, borderRadius: 14, background: recording ? `${T.red}20` : T.s1, border: `1.5px solid ${recording ? T.red + "70" : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {recording ? (
              <div style={{ width: 10, height: 10, borderRadius: 2, background: T.red }} />
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <rect x="9" y="2" width="6" height="11" rx="3" stroke={T.cream2} strokeWidth="1.7" />
                <path d="M5 10a7 7 0 0 0 14 0" stroke={T.cream2} strokeWidth="1.7" strokeLinecap="round" />
                <path d="M12 19v3M9 22h6" stroke={T.cream2} strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            )}
          </button>

          <textarea ref={inputRef} value={inp} onChange={e => setInp(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 500) { e.preventDefault(); send(); } }}
            placeholder="Escribe en espanol..."
            rows={2}
            style={{ flex: 1, background: T.s1, border: `1.5px solid ${inp.trim() ? T.gold + "50" : T.border}`, borderRadius: 14, color: T.cream, fontSize: 15, padding: "11px 14px", lineHeight: 1.5, minHeight: 48, maxHeight: 100, transition: "border-color .2s", resize: "none", fontFamily: "'Plus Jakarta Sans',sans-serif" }}
          />

          <button className="press" onClick={send} disabled={loading || !inp.trim()}
            style={{ width: 48, height: 48, borderRadius: 14, background: inp.trim() && !loading ? T.gold : T.s1, border: `1.5px solid ${inp.trim() && !loading ? T.gold : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .18s" }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke={inp.trim() && !loading ? "#000" : T.cream3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
