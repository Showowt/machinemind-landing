"use client";

import { useState } from "react";

type PaymentMethod = "zelle" | "bank_transfer" | "paypal" | "other";

export default function ActivatePage() {
  const [step, setStep] = useState<"info" | "payment" | "done">("info");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [error, setError] = useState("");

  const canProceed = businessName.trim().length >= 2 && phone.trim().length >= 6;

  const handleSubmit = async () => {
    if (!selectedMethod) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          phone: phone.trim(),
          method: selectedMethod,
          reference: reference.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al procesar. Intenta de nuevo.");
        return;
      }

      setPaymentRef(data.data.paymentReference);
      setStep("done");
    } catch {
      setError("Error de conexion. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     STEP 3: CONFIRMATION
     ═══════════════════════════════════════════════════════════════ */
  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--bg)" }}>
        <div className="max-w-md w-full">
          <div
            className="p-8 text-center"
            style={{
              backgroundColor: "var(--glass)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              className="w-16 h-16 mx-auto mb-6 flex items-center justify-center"
              style={{ border: "2px solid #22c55e" }}
            >
              <svg className="w-8 h-8" style={{ color: "#22c55e" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1
              className="text-2xl font-semibold mb-2"
              style={{ fontFamily: "var(--font-clash)", color: "var(--fg)" }}
            >
              Pago Reportado
            </h1>
            <p className="mb-6" style={{ color: "var(--dim)", fontSize: "0.9375rem" }}>
              Estamos verificando tu pago. Recibiras confirmacion por WhatsApp en las proximas horas.
            </p>
            <div className="text-left space-y-3 p-4" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--dim)" }}>Negocio</span>
                <span style={{ color: "var(--fg)", fontFamily: "var(--font-satoshi)" }}>{businessName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--dim)" }}>Referencia</span>
                <span style={{ color: "var(--fg)", fontFamily: "'JetBrains Mono', monospace" }}>{paymentRef}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "var(--dim)" }}>Primer pago</span>
                <span style={{ color: "var(--fg)", fontWeight: 600 }}>$150 USD</span>
              </div>
            </div>
            <p className="text-xs mt-6" style={{ color: "rgba(240,240,243,0.2)" }}>
              Sofia se activa en 48 horas despues de confirmar el pago.
            </p>
            <a
              href="https://wa.me/19544451638"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block text-sm"
              style={{ color: "var(--accent)" }}
            >
              Escribenos por WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div
            className="text-[10px] uppercase tracking-[4px] font-semibold mb-3"
            style={{ color: "rgba(201,168,110,0.6)" }}
          >
            MACHINEMIND
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold mb-2"
            style={{ fontFamily: "var(--font-clash)", color: "var(--fg)" }}
          >
            Activa Sofia AI
          </h1>
          <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--dim)" }}>
            Tu asistente de IA que responde clientes 24/7 por WhatsApp
          </p>
        </div>

        {/* Pricing */}
        <div
          className="p-6 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(201,168,110,0.12) 0%, rgba(201,168,110,0.04) 100%)",
            border: "1px solid rgba(201,168,110,0.25)",
          }}
        >
          <div
            className="text-[10px] uppercase tracking-[3px] font-semibold mb-3"
            style={{ color: "var(--accent)" }}
          >
            OFERTA DE LANZAMIENTO
          </div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold" style={{ color: "var(--fg)", fontFamily: "var(--font-clash)" }}>
              $150
            </span>
            <span className="text-lg" style={{ color: "var(--dim)" }}>/mes</span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--dim)" }}>
            Primeros 2 meses &middot; Despues $179/mes
          </p>
          <p className="text-xs mt-1" style={{ color: "rgba(240,240,243,0.2)" }}>
            Sin contratos. Cancela cuando quieras.
          </p>
        </div>

        {/* Features */}
        <div className="p-5" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
          <p className="text-[10px] uppercase tracking-[3px] font-semibold mb-4" style={{ color: "var(--accent)" }}>
            QUE INCLUYE
          </p>
          <div className="space-y-3">
            {[
              "Chatbot IA entrenado en tu negocio",
              "Responde en segundos por WhatsApp, 24/7",
              "Pagina web profesional incluida",
              "Sistema de reservas inteligente",
              "Reportes y analiticas en tiempo real",
              "Setup completo en 48 horas",
              "Soporte directo con el equipo",
            ].map((text) => (
              <div key={text} className="flex items-center gap-3 text-sm" style={{ color: "rgba(240,240,243,0.7)" }}>
                <svg className="w-4 h-4 shrink-0" style={{ color: "#22c55e" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ fontFamily: "var(--font-satoshi)" }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
           STEP 1: CLIENT INFO
           ═══════════════════════════════════════════════════════════════ */}
        {step === "info" && (
          <div className="space-y-4 p-6" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--fg)", fontFamily: "var(--font-clash)" }}>
              Tu informacion
            </p>

            <div>
              <label className="text-xs block mb-1.5" style={{ color: "var(--dim)" }}>
                Nombre del negocio
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej: Hotel Boutique Cartagena"
                className="w-full px-4 py-3 text-sm focus:outline-none"
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--fg)",
                }}
              />
            </div>

            <div>
              <label className="text-xs block mb-1.5" style={{ color: "var(--dim)" }}>
                WhatsApp o telefono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: +57 300 123 4567"
                className="w-full px-4 py-3 text-sm focus:outline-none"
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--fg)",
                }}
              />
            </div>

            <button
              onClick={() => canProceed && setStep("payment")}
              disabled={!canProceed}
              className="w-full py-3.5 text-sm font-semibold transition-all disabled:opacity-20"
              style={{
                border: "1px solid var(--accent)",
                backgroundColor: canProceed ? "var(--accent)" : "transparent",
                color: canProceed ? "#06060a" : "var(--accent)",
              }}
            >
              Continuar al pago
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
           STEP 2: PAYMENT METHOD
           ═══════════════════════════════════════════════════════════════ */}
        {step === "payment" && (
          <div className="space-y-4 p-6" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: "var(--fg)", fontFamily: "var(--font-clash)" }}>
                Metodo de Pago
              </p>
              <button
                onClick={() => setStep("info")}
                className="text-xs transition-colors"
                style={{ color: "var(--dim)" }}
              >
                Volver
              </button>
            </div>

            {/* Summary bar */}
            <div className="flex items-center justify-between p-3" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>{businessName}</p>
                <p className="text-xs" style={{ color: "var(--dim)" }}>{phone}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold" style={{ color: "var(--fg)" }}>$150 USD</p>
                <p className="text-xs" style={{ color: "var(--dim)" }}>Primer mes</p>
              </div>
            </div>

            {/* Methods */}
            <div className="space-y-2">
              {([
                { id: "zelle" as const, label: "Zelle", sub: "Instantaneo, sin comisiones" },
                { id: "bank_transfer" as const, label: "Transferencia Bancaria", sub: "Wire transfer en USD" },
                { id: "paypal" as const, label: "PayPal", sub: "machinemindconsulting@gmail.com" },
                { id: "other" as const, label: "Otro metodo", sub: "Contacta para coordinar" },
              ]).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className="w-full flex items-center gap-4 p-4 text-left transition-all"
                  style={{
                    backgroundColor: selectedMethod === m.id ? "rgba(201,168,110,0.08)" : "var(--glass)",
                    border: `1px solid ${selectedMethod === m.id ? "rgba(201,168,110,0.4)" : "var(--glass-border)"}`,
                  }}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: selectedMethod === m.id ? "var(--accent)" : "var(--fg)" }}>
                      {m.label}
                    </div>
                    <div className="text-xs" style={{ color: "var(--dim)" }}>{m.sub}</div>
                  </div>
                  <div
                    className="w-4 h-4 flex items-center justify-center"
                    style={{
                      border: `1.5px solid ${selectedMethod === m.id ? "var(--accent)" : "rgba(255,255,255,0.15)"}`,
                      backgroundColor: selectedMethod === m.id ? "var(--accent)" : "transparent",
                    }}
                  >
                    {selectedMethod === m.id && (
                      <svg className="w-2.5 h-2.5" style={{ color: "#06060a" }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Payment details */}
            {selectedMethod && selectedMethod !== "other" && (
              <div className="p-4 text-sm space-y-3" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
                <p className="font-medium" style={{ color: "rgba(240,240,243,0.8)" }}>
                  {selectedMethod === "zelle" && "Enviar Zelle a:"}
                  {selectedMethod === "bank_transfer" && "Wire Transfer:"}
                  {selectedMethod === "paypal" && "Enviar PayPal a:"}
                </p>
                <div className="p-3 space-y-2" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)" }}>
                  {selectedMethod === "zelle" && (
                    <>
                      <Row label="Email" value="machinemindconsulting@gmail.com" mono />
                      <Row label="Nombre" value="Philip McGill" />
                      <Row label="Monto" value="$150 USD" bold />
                    </>
                  )}
                  {selectedMethod === "bank_transfer" && (
                    <>
                      <Row label="Banco" value="Navy Federal Credit Union" />
                      <Row label="Routing" value="256074974" mono />
                      <Row label="SWIFT" value="NFCUUS33XXX" mono />
                      <Row label="Titular" value="Philip McGill" />
                      <Row label="Monto" value="$150 USD" bold />
                    </>
                  )}
                  {selectedMethod === "paypal" && (
                    <>
                      <Row label="Email" value="machinemindconsulting@gmail.com" mono />
                      <Row label="Nombre" value="Philip McGill" />
                      <Row label="Monto" value="$150 USD" bold />
                    </>
                  )}
                </div>
                <p style={{ color: "var(--dim)" }}>
                  {selectedMethod === "paypal"
                    ? 'Envia como "Amigos y Familia" para evitar comisiones'
                    : selectedMethod === "bank_transfer"
                      ? "Para el numero de cuenta, contacta al +1 (954) 445-1638"
                      : "Envia el comprobante por WhatsApp al +1 (954) 445-1638"}
                </p>
              </div>
            )}

            {selectedMethod === "other" && (
              <div className="p-4 text-sm" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
                <p style={{ color: "rgba(240,240,243,0.8)" }}>
                  Escribenos por WhatsApp para coordinar otro metodo de pago:
                </p>
                <a
                  href="https://wa.me/19544451638"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block"
                  style={{ color: "var(--accent)" }}
                >
                  +1 (954) 445-1638
                </a>
              </div>
            )}

            {selectedMethod && (
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs block mb-1" style={{ color: "var(--dim)" }}>
                    Numero de comprobante (opcional)
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ej: comprobante #12345"
                    className="w-full px-4 py-3 text-sm focus:outline-none"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--fg)",
                    }}
                  />
                </div>

                {error && (
                  <div className="p-3 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3.5 text-sm font-semibold transition-all disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "#06060a",
                    border: "1px solid var(--accent)",
                  }}
                >
                  {submitting ? "Procesando..." : "Ya pague — Confirmar pago"}
                </button>

                <p className="text-xs text-center" style={{ color: "rgba(240,240,243,0.2)" }}>
                  Tu pago sera verificado manualmente. Recibiras confirmacion por WhatsApp.
                </p>
              </div>
            )}
          </div>
        )}

        {/* WhatsApp support */}
        <div className="text-center">
          <a
            href="https://wa.me/19544451638"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm transition-colors"
            style={{ color: "var(--dim)" }}
          >
            Dudas? Escribenos por WhatsApp
          </a>
        </div>

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-[10px]" style={{ color: "rgba(240,240,243,0.15)" }}>
            MachineMind Consulting
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HELPER
   ═══════════════════════════════════════════════════════════════ */

function Row({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span style={{ color: "var(--dim)" }}>{label}</span>
      <span
        style={{
          color: "var(--fg)",
          fontFamily: mono ? "'JetBrains Mono', monospace" : "var(--font-satoshi)",
          fontWeight: bold ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}
