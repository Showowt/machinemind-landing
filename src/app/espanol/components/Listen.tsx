"use client";

import { useState, useRef, useCallback } from "react";
import { T } from "../lib/tokens";
import { useEspanolStore } from "../lib/store";
import { LISTEN_SENTENCES } from "../lib/data";
import { speak, speakSlow, speakFast, AudioRecorder, transcribeAudio } from "../lib/speech";
import { gradeListening } from "../lib/api";
import type { ListenResult } from "../lib/types";

export function Listen() {
  const store = useEspanolStore();
  const { difficulty, listenHistory } = store;

  const [phase, setPhase] = useState<"ready" | "playing" | "input" | "scoring" | "result">("ready");
  const [currentSentence, setCurrentSentence] = useState<{ es: string; en: string }>({ es: "", en: "" });
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ListenResult | null>(null);
  const [speed, setSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [mode, setMode] = useState<"type" | "voice">("type");
  const [recording, setRecording] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  const recorderRef = useRef(new AudioRecorder());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const level = Math.min(3, Math.max(1, Math.ceil(difficulty.level / 3.5)));
  const sentences = LISTEN_SENTENCES.find(s => s.level === level)?.sentences || LISTEN_SENTENCES[0].sentences;

  const playSentence = useCallback((sentence: string) => {
    const fn = speed === "slow" ? speakSlow : speed === "fast" ? speakFast : speak;
    fn(sentence);
    setPlayCount(c => c + 1);
  }, [speed]);

  const startRound = useCallback(() => {
    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    setCurrentSentence(sentence);
    setInput("");
    setResult(null);
    setPlayCount(0);
    setPhase("playing");
    const fn = speed === "slow" ? speakSlow : speed === "fast" ? speakFast : speak;
    fn(sentence.es).then(() => setPhase("input"));
  }, [sentences, speed]);

  const submitAnswer = useCallback(async (transcription: string) => {
    if (!transcription.trim()) return;
    setPhase("scoring");
    const scored = await gradeListening(currentSentence.es, transcription.trim());
    setResult(scored);
    store.addListenResult(scored);
    store.recordFluencyScore(Math.round(scored.score / 12));
    setPhase("result");
  }, [currentSentence, store]);

  const handleVoiceInput = useCallback(async () => {
    if (recording) {
      const blob = await recorderRef.current.stop();
      setRecording(false);
      const text = await transcribeAudio(blob);
      if (text) {
        setInput(text);
        submitAnswer(text);
      }
    } else {
      const ok = await recorderRef.current.start();
      if (ok) setRecording(true);
    }
  }, [recording, submitAnswer]);

  const avgScore = listenHistory.length > 0
    ? Math.round(listenHistory.slice(-10).reduce((a, b) => a + b.score, 0) / Math.min(10, listenHistory.length))
    : 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.cream, marginBottom: 6 }}>Escuchar</div>
        <div style={{ fontSize: 14, color: T.cream3, lineHeight: 1.75 }}>
          Escucha → Transcribe lo que oiste → Recibe puntuacion.
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", flex: 1 }}>
          <div style={{ fontSize: 10, color: T.cream3, marginBottom: 2 }}>SESIONES</div>
          <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 20, color: T.gold, fontWeight: 700 }}>{listenHistory.length}</div>
        </div>
        <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", flex: 1 }}>
          <div style={{ fontSize: 10, color: T.cream3, marginBottom: 2 }}>PROMEDIO</div>
          <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 20, color: avgScore >= 75 ? T.green : avgScore >= 50 ? T.gold : T.red, fontWeight: 700 }}>{avgScore}%</div>
        </div>
      </div>

      {/* Speed + mode toggles */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(["slow", "normal", "fast"] as const).map(s => (
          <button key={s} className="press" onClick={() => setSpeed(s)}
            style={{ flex: 1, padding: "8px", borderRadius: 10, background: speed === s ? `${T.blue}18` : T.s1, border: `1.5px solid ${speed === s ? T.blue + "60" : T.border}`, color: speed === s ? T.blue : T.cream3, fontSize: 12, fontWeight: 600 }}>
            {s === "slow" ? "🐢 Lento" : s === "normal" ? "🏃 Normal" : "⚡ Rapido"}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        <button className="press" onClick={() => setMode("type")}
          style={{ flex: 1, padding: "8px", borderRadius: 10, background: mode === "type" ? `${T.gold}18` : T.s1, border: `1.5px solid ${mode === "type" ? T.gold + "60" : T.border}`, color: mode === "type" ? T.gold : T.cream3, fontSize: 12, fontWeight: 600 }}>
          ⌨️ Escribir
        </button>
        <button className="press" onClick={() => setMode("voice")}
          style={{ flex: 1, padding: "8px", borderRadius: 10, background: mode === "voice" ? `${T.gold}18` : T.s1, border: `1.5px solid ${mode === "voice" ? T.gold + "60" : T.border}`, color: mode === "voice" ? T.gold : T.cream3, fontSize: 12, fontWeight: 600 }}>
          🎤 Voz
        </button>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        {phase === "ready" && (
          <>
            <div style={{ fontSize: 60 }}>👂</div>
            <div style={{ fontSize: 15, color: T.cream, textAlign: "center", lineHeight: 1.8 }}>
              Entrena tu oido.<br />Escucha y transcribe.
            </div>
            <button className="press" onClick={startRound}
              style={{ marginTop: 16, padding: "16px 40px", borderRadius: 16, background: T.gold, color: "#000", fontSize: 16, fontWeight: 700 }}>
              Empezar
            </button>
          </>
        )}

        {phase === "playing" && (
          <>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: `${T.blue}20`, border: `2px solid ${T.blue}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" stroke={T.blue} strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, color: T.blue, fontWeight: 600 }}>Escuchando...</div>
          </>
        )}

        {phase === "input" && (
          <div style={{ width: "100%" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <button className="press" onClick={() => playSentence(currentSentence.es)}
                style={{ padding: "10px 20px", borderRadius: 12, background: T.s1, border: `1.5px solid ${T.border}`, color: T.cream3, fontSize: 13 }}>
                🔊 Escuchar de nuevo ({playCount}x)
              </button>
            </div>

            {mode === "type" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitAnswer(input); } }}
                  placeholder="Escribe lo que escuchaste..."
                  rows={3}
                  autoFocus
                  style={{ background: T.s1, border: `1.5px solid ${T.border}`, borderRadius: 14, color: T.cream, fontSize: 15, padding: "12px 14px", lineHeight: 1.5, resize: "none", fontFamily: "'Plus Jakarta Sans',sans-serif" }}
                />
                <button className="press" onClick={() => submitAnswer(input)} disabled={!input.trim()}
                  style={{ padding: "14px", borderRadius: 12, background: input.trim() ? T.gold : T.s1, border: `1.5px solid ${input.trim() ? T.gold : T.border}`, color: input.trim() ? "#000" : T.cream3, fontSize: 14, fontWeight: 700 }}>
                  Enviar
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <button className={`press ${recording ? "rec-pulse" : ""}`} onClick={handleVoiceInput}
                  style={{ width: 80, height: 80, borderRadius: "50%", background: recording ? `${T.red}30` : `${T.red}15`, border: `3px solid ${recording ? T.red : T.red + "60"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                  {recording ? (
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: T.red }} />
                  ) : (
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                      <rect x="9" y="2" width="6" height="11" rx="3" stroke={T.red} strokeWidth="2" />
                      <path d="M5 10a7 7 0 0 0 14 0" stroke={T.red} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
                <div style={{ fontSize: 12, color: T.cream3, marginTop: 8 }}>
                  {recording ? "Grabando... toca para enviar" : "Repite lo que escuchaste"}
                </div>
              </div>
            )}
          </div>
        )}

        {phase === "scoring" && (
          <>
            <div className="dot" style={{ width: 8, height: 8 }} />
            <div style={{ fontSize: 15, color: T.cream3 }}>Evaluando...</div>
          </>
        )}

        {phase === "result" && result && (
          <div style={{ width: "100%" }}>
            {/* Score */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 56, color: result.score >= 80 ? T.green : result.score >= 50 ? T.gold : T.red, fontWeight: 700 }}>
                {result.score}%
              </div>
            </div>

            {/* Target vs User */}
            <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: T.green, fontWeight: 700, letterSpacing: "1px", marginBottom: 4 }}>CORRECTO</div>
              <div style={{ fontSize: 14, color: T.cream, fontStyle: "italic" }}>&ldquo;{result.targetSentence}&rdquo;</div>
              <div style={{ fontSize: 12, color: T.cream3, marginTop: 4 }}>{currentSentence.en}</div>
            </div>
            <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: T.blue, fontWeight: 700, letterSpacing: "1px", marginBottom: 4 }}>ESCRIBISTE</div>
              <div style={{ fontSize: 14, color: T.cream, fontStyle: "italic" }}>&ldquo;{result.userTranscription}&rdquo;</div>
            </div>

            {/* Missing/Extra */}
            {result.missingWords.length > 0 && (
              <div style={{ background: `${T.red}08`, border: `1px solid ${T.red}25`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: T.red, fontWeight: 700, marginBottom: 4 }}>PALABRAS QUE FALTARON</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {result.missingWords.map((w, i) => (
                    <span key={i} style={{ padding: "3px 8px", borderRadius: 6, background: `${T.red}15`, fontSize: 12, color: T.red }}>{w}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback */}
            {result.feedback && (
              <div style={{ fontSize: 13, color: T.cream2, lineHeight: 1.7, padding: "10px 0", borderTop: `1px solid ${T.border}`, marginTop: 8 }}>
                {result.feedback}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="press" onClick={() => { playSentence(currentSentence.es); setPhase("input"); setInput(""); }}
                style={{ flex: 1, padding: "14px", borderRadius: 12, background: T.s1, border: `1.5px solid ${T.border}`, color: T.cream3, fontSize: 14, fontWeight: 600 }}>
                Repetir
              </button>
              <button className="press" onClick={startRound}
                style={{ flex: 1, padding: "14px", borderRadius: 12, background: T.gold, color: "#000", fontSize: 14, fontWeight: 700 }}>
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
