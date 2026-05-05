"use client";

import { useState, useRef, useCallback } from "react";
import { T } from "../lib/tokens";
import { useEspanolStore } from "../lib/store";
import { analyzePhoto, sendMessage } from "../lib/api";
import { speak, AudioRecorder, transcribeAudio } from "../lib/speech";
import type { VocabItem, Message } from "../lib/types";

export function Photo() {
  const store = useEspanolStore();
  const { difficulty } = store;

  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: "ai" | "user"; text: string; en?: string }[]>([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef(new AudioRecorder());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setImage(reader.result as string);
      setMessages([]);
      setLoading(true);

      try {
        const result = await analyzePhoto(base64, difficulty.level);
        setMessages([{ role: "ai", text: result.question_es, en: result.question_en }]);
        if (result.vocab?.length > 0) store.addVocab(result.vocab);
        store.updateStats(prev => ({ ...prev, photoSessions: prev.photoSessions + 1 }));
      } catch {
        setMessages([{ role: "ai", text: "Error al analizar la foto. Intenta de nuevo." }]);
      }
      setLoading(false);
    };
    reader.readAsDataURL(file);
  }, [difficulty.level, store]);

  const sendReply = useCallback(async () => {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    setMessages(prev => [...prev, { role: "user", text: txt }]);
    setInput(""); setLoading(true);

    try {
      const system = `You are a Spanish conversation partner discussing a photo the user shared. Continue the conversation naturally in Spanish. Ask follow-up questions or comment on what they said. Difficulty: ${difficulty.level}/10.

RETURN ONLY JSON:
{"response_es":"your Spanish response","response_en":"English translation","new_vocab":[{"es":"word","en":"meaning"}]}`;

      const apiMsgs = [...messages, { role: "user" as const, text: txt }].map(m => ({
        role: m.role === "user" ? "user" as const : "assistant" as const,
        content: m.role === "ai" ? JSON.stringify({ response_es: m.text }) : m.text,
      }));

      const res = await fetch("/api/espanol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, messages: apiMsgs }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setMessages(prev => [...prev, { role: "ai", text: parsed.response_es, en: parsed.response_en }]);
      if (parsed.new_vocab?.length > 0) store.addVocab(parsed.new_vocab);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Error de conexion." }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  }, [input, loading, messages, difficulty.level, store]);

  const toggleRecord = useCallback(async () => {
    if (recording) {
      const blob = await recorderRef.current.stop();
      setRecording(false);
      const text = await transcribeAudio(blob);
      if (text) { setInput(prev => (prev ? prev + " " : "") + text); inputRef.current?.focus(); }
    } else {
      const ok = await recorderRef.current.start();
      if (ok) setRecording(true);
    }
  }, [recording]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: "16px 18px 12px" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: T.cream, marginBottom: 4 }}>Foto Mode</div>
        <div style={{ fontSize: 13, color: T.cream3 }}>Sube una foto → habla sobre ella en espanol.</div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 12px" }}>
        {!image ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60%", gap: 16 }}>
            <div style={{ fontSize: 60 }}>📷</div>
            <div style={{ fontSize: 14, color: T.cream3, textAlign: "center", lineHeight: 1.8 }}>
              Menu, letrero, escena callejera, red social...<br />Cualquier imagen del mundo real.
            </div>
            <button className="press" onClick={() => fileRef.current?.click()}
              style={{ padding: "16px 32px", borderRadius: 16, background: T.gold, color: "#000", fontSize: 15, fontWeight: 700 }}>
              Subir Foto
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: "none" }} />
          </div>
        ) : (
          <>
            {/* Image preview */}
            <div style={{ borderRadius: 14, overflow: "hidden", marginBottom: 12, border: `1px solid ${T.border}` }}>
              <img src={image} alt="Uploaded" style={{ width: "100%", maxHeight: 200, objectFit: "cover" }} />
            </div>

            {/* Messages */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((msg, i) => (
                <div key={i} className="msg" style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 3 }}>
                  <div style={{
                    background: msg.role === "user" ? T.s2 : T.s1,
                    border: msg.role === "user" ? `none` : `1px solid ${T.border}`,
                    borderLeft: msg.role === "user" ? `3px solid ${T.gold}` : "none",
                    borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                    padding: "11px 15px", maxWidth: "85%", fontSize: 15, lineHeight: 1.6, color: T.cream,
                  }}>
                    {msg.text}
                  </div>
                  {msg.role === "ai" && msg.en && (
                    <div style={{ fontSize: 12, color: T.cream3, fontStyle: "italic", paddingLeft: 4 }}>{msg.en}</div>
                  )}
                  {msg.role === "ai" && (
                    <button onClick={() => speak(msg.text)} style={{ opacity: .3, fontSize: 13, paddingLeft: 4, background: "none", border: "none", cursor: "pointer" }}>🔊</button>
                  )}
                </div>
              ))}
              {loading && (
                <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: "4px 18px 18px 18px", padding: "12px 16px", alignSelf: "flex-start" }}>
                  <div className="dot" /><div className="dot" /><div className="dot" />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Input (only when image loaded) */}
      {image && (
        <div style={{ flexShrink: 0, padding: "10px 14px", paddingBottom: "calc(10px + env(safe-area-inset-bottom,0px))", background: T.bg, borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button className="press" onClick={() => { setImage(null); setMessages([]); }}
              style={{ padding: "5px 12px", borderRadius: 14, background: T.s1, border: `1px solid ${T.border}`, color: T.cream3, fontSize: 12, fontWeight: 600 }}>
              Nueva foto
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <button className={`press ${recording ? "rec-pulse" : ""}`} onClick={toggleRecord}
              style={{ width: 44, height: 44, borderRadius: 12, background: recording ? `${T.red}20` : T.s1, border: `1.5px solid ${recording ? T.red + "70" : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {recording ? <div style={{ width: 10, height: 10, borderRadius: 2, background: T.red }} /> : <span style={{ fontSize: 16 }}>🎤</span>}
            </button>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
              placeholder="Responde en espanol..."
              rows={2}
              style={{ flex: 1, background: T.s1, border: `1.5px solid ${T.border}`, borderRadius: 14, color: T.cream, fontSize: 15, padding: "10px 14px", lineHeight: 1.5, minHeight: 44, maxHeight: 80, resize: "none", fontFamily: "'Plus Jakarta Sans',sans-serif" }}
            />
            <button className="press" onClick={sendReply} disabled={loading || !input.trim()}
              style={{ width: 44, height: 44, borderRadius: 12, background: input.trim() && !loading ? T.gold : T.s1, border: `1.5px solid ${input.trim() && !loading ? T.gold : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() && !loading ? "#000" : T.cream3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
