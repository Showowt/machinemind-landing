"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/store/portfolio";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function SofiaChat() {
  const language = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Initial greeting when opened - sales focused
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting: Message = {
        id: "greeting",
        role: "assistant",
        content:
          language === "es"
            ? "¡Hey! 👋 Pregunta rápida antes de empezar:\n\nCuando alguien le escribe a tu negocio a las 2am queriendo reservar... ¿quién responde?\n\nPorque ahí es donde la mayoría pierde $2,000-4,000 al mes sin darse cuenta.\n\n¿Qué tipo de negocio tienes?"
            : "Hey! 👋 Quick question before we dive in:\n\nWhen someone messages your business at 2am wanting to book... who answers?\n\nBecause that's where most businesses lose $2,000-4,000/month without realizing it.\n\nWhat type of business are you running?",
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
          "Cuánto pierdo?",
          "Agendar llamada",
        ]
      : [
          "I have a hotel",
          "I have a restaurant",
          "How much am I losing?",
          "Book a call",
        ];

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

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
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

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
            ? "Disculpa, tuve un problema de conexión. Puedes contactarnos directamente:\n📱 +57 315 399 3293\n📧 hello@machinemind.ai"
            : "Sorry, I had a connection issue. You can reach us directly:\n📱 +57 315 399 3293\n📧 hello@machinemind.ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInput(question);
    setTimeout(() => handleSend(), 100);
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-[var(--mm-cyan)] to-[#0084c7] text-white flex items-center justify-center transition-all duration-300 hover:scale-105"
        style={{ boxShadow: "0 0 30px rgba(0, 166, 237, 0.4)" }}
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
          className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 w-14 h-14 md:w-16 md:h-16 bg-[var(--mm-cyan)]"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-20 right-4 md:bottom-24 md:right-6 z-50 bg-[#0d0d14] border border-[var(--mm-border)] flex flex-col overflow-hidden transition-all duration-300 ${
              isMinimized
                ? "w-64 md:w-72 h-14"
                : "w-[calc(100vw-2rem)] sm:w-[360px] md:w-[380px] h-[60vh] sm:h-[480px] md:h-[520px] max-h-[calc(100vh-6rem)]"
            }`}
          >
            {/* Header */}
            <div
              className="p-4 bg-gradient-to-r from-[rgba(0,166,237,0.2)] to-[rgba(0,132,199,0.1)] border-b border-[var(--mm-border)] cursor-pointer"
              onClick={() => isMinimized && setIsMinimized(false)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[var(--mm-cyan)] to-[#0084c7] flex items-center justify-center">
                    <span className="text-lg">🤖</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Sofia</h3>
                    {!isMinimized && (
                      <p className="text-xs text-[var(--mm-cyan)]">
                        MachineMind AI
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isMinimized && (
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="w-2 h-2 bg-green-500 animate-pulse" />
                      Online
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMinimized(!isMinimized);
                    }}
                    className="p-1.5 hover:bg-white/10 transition-colors"
                    aria-label={isMinimized ? "Expand" : "Minimize"}
                  >
                    <svg
                      className="w-4 h-4 text-muted"
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
                      className="w-4 h-4 text-muted"
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
                            : "bg-[rgba(255,255,255,0.05)] text-white border border-[var(--mm-border)]"
                        }`}
                      >
                        {message.content}
                        <p
                          className={`text-xs mt-2 ${
                            message.role === "user"
                              ? "text-white/60"
                              : "text-muted"
                          }`}
                        >
                          {message.timestamp.toLocaleTimeString(
                            language === "es" ? "es-CO" : "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                      </div>
                    </motion.div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-[rgba(255,255,255,0.05)] border border-[var(--mm-border)] p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span
                              className="w-2 h-2 bg-[var(--mm-cyan)] animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <span
                              className="w-2 h-2 bg-[var(--mm-cyan)] animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <span
                              className="w-2 h-2 bg-[var(--mm-cyan)] animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                          <span className="text-xs text-muted">
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
                  <div className="px-3 md:px-4 py-2 border-t border-[var(--mm-border)]">
                    <div className="flex flex-wrap gap-1.5 md:gap-2">
                      {quickQuestions.map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setInput(q);
                            setTimeout(() => {
                              handleSend();
                            }, 100);
                          }}
                          className="text-xs bg-[rgba(0,166,237,0.1)] hover:bg-[rgba(0,166,237,0.2)] text-[var(--mm-cyan)] px-3 py-2.5 md:py-1.5 transition-colors min-h-[44px] flex items-center"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="p-4 border-t border-[var(--mm-border)]">
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
                      className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[var(--mm-border)] px-4 py-3 text-sm text-white placeholder:text-muted focus:outline-none focus:border-[var(--mm-cyan)]"
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="w-12 h-12 bg-[var(--mm-cyan)] text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--mm-cyan-light)]"
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
