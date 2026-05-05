"use client";

import { useState, useRef, useCallback } from "react";
import { T } from "../lib/tokens";
import { useEspanolStore } from "../lib/store";
import { SHADOW_SENTENCES } from "../lib/data";
import { speak, speakSlow, AudioRecorder, transcribeAudio } from "../lib/speech";
import { scorePronunciation } from "../lib/api";
import type { ShadowResult } from "../lib/types";

export function Shadow() {
  const store = useEspanolStore();
  const { difficulty, shadowHistory } = store;

  const [phase, setPhase] = useState<"ready" | "listening" | "recording" | "scoring" | "result">("ready");
  const [currentSentence, setCurrentSentence] = useState("");
  const [result, setResult] = useState<ShadowResult | null>(null);
  const [recording, setRecording] = useState(false);
  const [speed, setSpeed] = useState<"slow" | "normal">("normal");

  const recorderRef = useRef(new AudioRecorder());

  // Pick sentence based on difficulty
  const level = Math.min(4, Math.max(1, Math.ceil(difficulty.level / 2.5)));
  const sentences = SHADOW_SENTENCES.find(s => s.level === level)?.sentences || SHADOW_SENTENCES[0].sentences;

  const startRound = useCallback(() => {
    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    setCurrentSentence(sentence);
    setResult(null);
    setPhase("listening");

    // Speak the sentence
    const speakFn = speed === "slow" ? speakSlow : speak;
    speakFn(sentence).then(() => {
      setPhase("recording");
    });
  }, [sentences, speed]);

  const replaySentence = useCallback(() => {
    const speakFn = speed === "slow" ? speakSlow : speak;
    speakFn(currentSentence);
  }, [currentSentence, speed]);

  const startRecording = useCallback(async () => {
    const ok = await recorderRef.current.start();
    if (ok) setRecording(true);
  }, []);

  const stopRecording = useCallback(async () => {
    const blob = await recorderRef.current.stop();
    setRecording(false);
    setPhase("scoring");

    const transcription = await transcribeAudio(blob);
    if (!transcription) {
      setPhase("recording");
      return;
    }

    const scored = await scorePronunciation(currentSentence, transcription);
    setResult(scored);
    store.addShadowResult(scored);
    store.recordFluencyScore(Math.round(scored.overallScore / 10));
    setPhase("result");
  }, [currentSentence, store]);

  const avgScore = shadowHistory.length > 0
    ? Math.round(shadowHistory.slice(-10).reduce((a, b) => a + b.overallScore, 0) / Math.min(10, shadowHistory.length))
    : 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.cream, marginBottom: 6 }}>Shadowing</div>
        <div style={{ fontSize: 14, color: T.cream3, lineHeight: 1.75 }}>
          Escucha → Repite inmediatamente → Recibe puntuacion de pronunciacion.
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", flex: 1 }}>
          <div style={{ fontSize: 10, color: T.cream3, marginBottom: 2 }}>SESIONES</div>
          <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 20, color: T.gold, fontWeight: 700 }}>{shadowHistory.length}</div>
        </div>
        <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", flex: 1 }}>
          <div style={{ fontSize: 10, color: T.cream3, marginBottom: 2 }}>PROMEDIO</div>
          <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 20, color: avgScore >= 75 ? T.green : avgScore >= 50 ? T.gold : T.red, fontWeight: 700 }}>{avgScore}%</div>
        </div>
        <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px", flex: 1 }}>
          <div style={{ fontSize: 10, color: T.cream3, marginBottom: 2 }}>NIVEL</div>
          <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 20, color: T.purple, fontWeight: 700 }}>{level}</div>
        </div>
      </div>

      {/* Speed toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className="press" onClick={() => setSpeed("slow")}
          style={{ flex: 1, padding: "10px", borderRadius: 12, background: speed === "slow" ? `${T.blue}18` : T.s1, border: `1.5px solid ${speed === "slow" ? T.blue + "60" : T.border}`, color: speed === "slow" ? T.blue : T.cream3, fontSize: 13, fontWeight: 600 }}>
          🐢 Lento
        </button>
        <button className="press" onClick={() => setSpeed("normal")}
          style={{ flex: 1, padding: "10px", borderRadius: 12, background: speed === "normal" ? `${T.gold}18` : T.s1, border: `1.5px solid ${speed === "normal" ? T.gold + "60" : T.border}`, color: speed === "normal" ? T.gold : T.cream3, fontSize: 13, fontWeight: 600 }}>
          🏃 Normal
        </button>
      </div>

      {/* Main interaction area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
        {phase === "ready" && (
          <>
            <div style={{ fontSize: 60, marginBottom: 10 }}>🎧</div>
            <div style={{ fontSize: 15, color: T.cream, textAlign: "center", lineHeight: 1.8 }}>
              Presiona para escuchar una frase.<br />Repitela inmediatamente despues.
            </div>
            <button className="press" onClick={startRound}
              style={{ marginTop: 16, padding: "16px 40px", borderRadius: 16, background: T.gold, color: "#000", fontSize: 16, fontWeight: 700 }}>
              Empezar
            </button>
          </>
        )}

        {phase === "listening" && (
          <>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: `${T.blue}20`, border: `2px solid ${T.blue}60`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" stroke={T.blue} strokeWidth="2" strokeLinecap="round"/>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" stroke={T.blue} strokeWidth="2"/>
                <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" stroke={T.blue} strokeWidth="2"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, color: T.blue, fontWeight: 600 }}>Escuchando...</div>
            <div style={{ fontSize: 14, color: T.cream3, fontStyle: "italic", textAlign: "center", maxWidth: 280 }}>
              Concentra en el ritmo y la entonacion
            </div>
          </>
        )}

        {phase === "recording" && (
          <>
            <div style={{ fontSize: 14, color: T.cream3, marginBottom: 8, textAlign: "center" }}>Escuchaste:</div>
            <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 20px", maxWidth: "90%", marginBottom: 16 }}>
              <div style={{ fontSize: 16, color: T.cream, lineHeight: 1.7, textAlign: "center", fontStyle: "italic" }}>&ldquo;{currentSentence}&rdquo;</div>
            </div>
            <button className="press" onClick={replaySentence} style={{ marginBottom: 16, padding: "8px 16px", borderRadius: 10, background: T.s1, border: `1px solid ${T.border}`, color: T.cream3, fontSize: 12 }}>
              🔊 Escuchar de nuevo
            </button>

            {!recording ? (
              <button className="press" onClick={startRecording}
                style={{ width: 80, height: 80, borderRadius: "50%", background: `${T.red}20`, border: `3px solid ${T.red}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
                  <rect x="9" y="2" width="6" height="11" rx="3" stroke={T.red} strokeWidth="2" />
                  <path d="M5 10a7 7 0 0 0 14 0" stroke={T.red} strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 19v3" stroke={T.red} strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            ) : (
              <button className="press rec-pulse" onClick={stopRecording}
                style={{ width: 80, height: 80, borderRadius: "50%", background: `${T.red}30`, border: `3px solid ${T.red}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: T.red }} />
              </button>
            )}
            <div style={{ fontSize: 12, color: T.cream3, marginTop: 8 }}>
              {recording ? "Grabando... toca para parar" : "Toca para grabar tu repeticion"}
            </div>
          </>
        )}

        {phase === "scoring" && (
          <>
            <div className="dot" style={{ width: 8, height: 8 }} />
            <div style={{ fontSize: 15, color: T.cream3 }}>Analizando pronunciacion...</div>
          </>
        )}

        {phase === "result" && result && (
          <div style={{ width: "100%", maxWidth: 360 }}>
            {/* Overall score */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 56, color: result.overallScore >= 75 ? T.green : result.overallScore >= 50 ? T.gold : T.red, fontWeight: 700 }}>
                {result.overallScore}%
              </div>
              <div style={{ fontSize: 13, color: T.cream3 }}>Puntuacion General</div>
            </div>

            {/* Sub-scores */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Ritmo", score: result.rhythmScore, color: T.blue },
                { label: "Acentos", score: result.stressScore, color: T.purple },
                { label: "Precision", score: result.accuracyScore, color: T.green },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: T.s1, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px", textAlign: "center" }}>
                  <div style={{ fontFamily: "JetBrains Mono,monospace", fontSize: 18, color: s.color, fontWeight: 700 }}>{s.score}%</div>
                  <div style={{ fontSize: 10, color: T.cream3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* What you said */}
            <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: T.cream3, fontWeight: 700, letterSpacing: "1px", marginBottom: 6 }}>DIJISTE</div>
              <div style={{ fontSize: 14, color: T.cream, fontStyle: "italic" }}>&ldquo;{result.userTranscription}&rdquo;</div>
            </div>

            {/* Feedback */}
            {result.feedback.length > 0 && (
              <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: "1px", marginBottom: 6 }}>FEEDBACK</div>
                {result.feedback.map((f, i) => (
                  <div key={i} style={{ fontSize: 13, color: T.cream2, lineHeight: 1.7, paddingLeft: 10, borderLeft: `2px solid ${T.gold}30`, marginBottom: 6 }}>{f}</div>
                ))}
              </div>
            )}

            {/* Phoneme notes */}
            {result.phonemeNotes.length > 0 && (
              <div style={{ background: `${T.red}08`, border: `1px solid ${T.red}25`, borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: T.red, fontWeight: 700, letterSpacing: "1px", marginBottom: 6 }}>SONIDOS</div>
                {result.phonemeNotes.map((n, i) => (
                  <div key={i} style={{ fontSize: 13, color: T.cream2, lineHeight: 1.7, marginBottom: 4 }}>{n}</div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button className="press" onClick={() => { setPhase("recording"); }}
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
