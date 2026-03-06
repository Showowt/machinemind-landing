"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/store/portfolio";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface SofiaState {
  score: number;
  quality: "hot" | "warm" | "cold" | "unqualified";
  gate: number;
  mentalModel: string;
  mentalModelConfidence: number;
}

// Generate unique session ID
function generateSessionId(): string {
  return `sofia_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function SofiaChat() {
  const language = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [sofiaState, setSofiaState] = useState<SofiaState>({
    score: 0,
    quality: "cold",
    gate: 1,
    mentalModel: "unknown",
    mentalModelConfidence: 0,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize session ID on mount
  useEffect(() => {
    const existingSession = localStorage.getItem("sofia_session_id");
    const sessionExpiry = localStorage.getItem("sofia_session_expiry");

    if (
      existingSession &&
      sessionExpiry &&
      Date.now() < parseInt(sessionExpiry)
    ) {
      setSessionId(existingSession);
    } else {
      const newSession = generateSessionId();
      setSessionId(newSession);
      localStorage.setItem("sofia_session_id", newSession);
      localStorage.setItem(
        "sofia_session_expiry",
        (Date.now() + 30 * 60 * 1000).toString(),
      );
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  // Initial greeting when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting: Message = {
        id: "greeting",
        role: "assistant",
        content:
          language === "es"
            ? "¡Hey! 👋 Pregunta rápida:\n\nCuando alguien le escribe a tu negocio a las 2am queriendo reservar... ¿quién responde?\n\nPorque ahí es donde la mayoría pierde $2,000-4,000 al mes.\n\n¿Qué tipo de negocio tienes?"
            : "Hey! 👋 Quick question:\n\nWhen someone messages your business at 2am wanting to book... who answers?\n\nBecause that's where most lose $2,000-4,000/month.\n\nWhat type of business are you running?",
        timestamp: new Date(),
      };
      setMessages([greeting]);
    }
  }, [isOpen, language, messages.length]);

  const quickQuestions =
    language === "es"
      ? [
          "Tengo un hotel",
          "Tengo un restaurante",
          "¿Cuánto pierdo?",
          "📅 Agendar llamada",
        ]
      : [
          "I have a hotel",
          "I have a restaurant",
          "How much am I losing?",
          "📅 Book a call",
        ];

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    // Extend session expiry
    localStorage.setItem(
      "sofia_session_expiry",
      (Date.now() + 30 * 60 * 1000).toString(),
    );

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/sofia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          sessionId,
          language,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      // Update session ID if returned
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem("sofia_session_id", data.sessionId);
      }

      // Update Sofia state with scoring data
      if (data.score !== undefined) {
        setSofiaState({
          score: data.score,
          quality: data.quality || "cold",
          gate: data.gate || 1,
          mentalModel: data.mentalModel || "unknown",
          mentalModelConfidence: data.mentalModelConfidence || 0,
        });
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          language === "es"
            ? "Disculpa, tuve un problema. Puedes contactarnos directamente:\n📱 +1 (954) 445-1638\n📧 Phil@machinemindconsulting.com"
            : "Sorry, I had an issue. Reach us directly:\n📱 +1 (954) 445-1638\n📧 Phil@machinemindconsulting.com",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, sessionId, language]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuestion = (q: string) => {
    setInput(q);
    setTimeout(() => {
      handleSend();
    }, 100);
  };

  // Quality indicator colors
  const qualityColors = {
    hot: "bg-red-500",
    warm: "bg-amber-500",
    cold: "bg-blue-500",
    unqualified: "bg-gray-500",
  };

  const qualityLabels = {
    hot: language === "es" ? "🔥 Caliente" : "🔥 Hot",
    warm: language === "es" ? "🟡 Tibio" : "🟡 Warm",
    cold: language === "es" ? "🔵 Frío" : "🔵 Cold",
    unqualified: language === "es" ? "⚪ Sin calificar" : "⚪ Unqualified",
  };

  return (
    <>
      {/* Chat Toggle Button - Cinema Engine Style */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[600] w-14 h-14 md:w-16 md:h-16 bg-[var(--mm-cyan)] text-white flex items-center justify-center transition-all duration-300 hover:scale-105"
        style={{
          boxShadow: "0 0 30px rgba(0, 166, 237, 0.4)",
          clipPath: "polygon(0 0, 100% 0, 100% 85%, 85% 100%, 0 100%)",
        }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <span className="text-2xl">💬</span>
        )}
      </motion.button>

      {/* Pulse indicator when closed */}
      {!isOpen && (
        <motion.div
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[599] w-14 h-14 md:w-16 md:h-16 bg-[var(--mm-cyan)]"
          style={{
            clipPath: "polygon(0 0, 100% 0, 100% 85%, 85% 100%, 0 100%)",
          }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Chat Window - Cinema Engine Style */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-20 right-4 md:bottom-24 md:right-6 z-[600] bg-[#0a0a0f] border border-[var(--mm-cyan)]/30 flex flex-col overflow-hidden transition-all duration-300 ${
              isMinimized
                ? "w-64 md:w-72 h-14"
                : "w-[calc(100vw-2rem)] sm:w-[360px] md:w-[400px] h-[65vh] sm:h-[500px] md:h-[560px] max-h-[calc(100vh-6rem)]"
            }`}
            style={{
              clipPath: isMinimized
                ? "none"
                : "polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%)",
            }}
          >
            {/* Header with Score Indicator */}
            <div
              className="p-4 bg-gradient-to-r from-[rgba(0,166,237,0.15)] to-[rgba(0,132,199,0.05)] border-b border-[var(--mm-cyan)]/20 cursor-pointer"
              onClick={() => isMinimized && setIsMinimized(false)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 bg-[var(--mm-cyan)] flex items-center justify-center"
                    style={{
                      clipPath:
                        "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)",
                    }}
                  >
                    <span className="text-lg">🤖</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white font-['Clash_Display',sans-serif]">
                      Sofia
                    </h3>
                    {!isMinimized && (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-[var(--mm-cyan)]">
                          <span className="w-1.5 h-1.5 bg-green-500 animate-pulse" />
                          Online
                        </span>
                        {sofiaState.score > 0 && (
                          <span
                            className={`text-xs px-1.5 py-0.5 ${qualityColors[sofiaState.quality]} text-white`}
                          >
                            {sofiaState.score}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMinimized(!isMinimized);
                    }}
                    className="p-1.5 hover:bg-white/10 transition-colors"
                    aria-label={isMinimized ? "Expand" : "Minimize"}
                  >
                    <svg
                      className="w-4 h-4 text-[var(--mm-cyan)]/60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 12H4"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                    }}
                    className="p-1.5 hover:bg-white/10 transition-colors"
                    aria-label="Close"
                  >
                    <svg
                      className="w-4 h-4 text-[var(--mm-cyan)]/60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Score Bar - Visual progress indicator */}
                {sofiaState.score > 0 && (
                  <div className="px-4 py-2 bg-[#0d0d14] border-b border-[var(--mm-cyan)]/10">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[var(--mm-cyan)]/60">
                        {language === "es"
                          ? "Nivel de interés"
                          : "Interest Level"}
                      </span>
                      <span className="text-white/80">
                        {qualityLabels[sofiaState.quality]}
                      </span>
                    </div>
                    <div className="h-1 bg-[var(--mm-cyan)]/10 overflow-hidden">
                      <motion.div
                        className={`h-full ${qualityColors[sofiaState.quality]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${sofiaState.score}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-white/40">
                      <span>Gate {sofiaState.gate}/3</span>
                      {sofiaState.mentalModel !== "unknown" &&
                        sofiaState.mentalModelConfidence > 30 && (
                          <span className="capitalize">
                            {sofiaState.mentalModel}
                          </span>
                        )}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] p-3 text-sm whitespace-pre-wrap ${
                          message.role === "user"
                            ? "bg-[var(--mm-cyan)] text-white"
                            : "bg-[rgba(255,255,255,0.03)] text-white border border-[var(--mm-cyan)]/20"
                        }`}
                        style={{
                          clipPath:
                            message.role === "user"
                              ? "polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)"
                              : "polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
                        }}
                      >
                        {message.content}
                        <p
                          className={`text-xs mt-2 ${
                            message.role === "user"
                              ? "text-white/60"
                              : "text-white/40"
                          }`}
                        >
                          {message.timestamp.toLocaleTimeString(
                            language === "es" ? "es-CO" : "en-US",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-[rgba(255,255,255,0.03)] border border-[var(--mm-cyan)]/20 p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                className="w-2 h-2 bg-[var(--mm-cyan)] animate-bounce"
                                style={{ animationDelay: `${i * 150}ms` }}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-white/40">
                            {language === "es"
                              ? "Sofia está escribiendo..."
                              : "Sofia is typing..."}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Questions */}
                {messages.length <= 2 && (
                  <div className="px-3 md:px-4 py-2 border-t border-[var(--mm-cyan)]/10">
                    <div className="flex flex-wrap gap-1.5 md:gap-2">
                      {quickQuestions.map((q) => (
                        <button
                          key={q}
                          onClick={() => handleQuickQuestion(q)}
                          className="text-xs bg-[rgba(0,166,237,0.1)] hover:bg-[rgba(0,166,237,0.2)] text-[var(--mm-cyan)] px-3 py-2.5 md:py-1.5 transition-colors min-h-[44px] flex items-center border border-[var(--mm-cyan)]/20"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="p-4 border-t border-[var(--mm-cyan)]/10 bg-[#0a0a0f]">
                  <div className="flex gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        language === "es"
                          ? "Escribe tu mensaje..."
                          : "Type your message..."
                      }
                      className="flex-1 bg-[rgba(255,255,255,0.03)] border border-[var(--mm-cyan)]/20 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--mm-cyan)]/50"
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="w-12 h-12 bg-[var(--mm-cyan)] text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--mm-cyan)]/80"
                      style={{
                        clipPath:
                          "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)",
                      }}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
