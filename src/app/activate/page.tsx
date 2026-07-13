"use client";

import { useState, useRef } from "react";

type PaymentMethod = "paypal" | "zelle" | "bank_transfer" | "venmo" | "cashapp" | "other";

export default function ActivatePage() {
  const [step, setStep] = useState<"info" | "payment" | "confirm" | "done">("info");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [reference, setReference] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canProceed = businessName.trim().length >= 2 && phone.trim().length >= 6;
  const hasProof = reference.trim().length > 0 || screenshot !== null;

  const goToConfirm = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setError("");
    // PayPal: open payment link directly
    if (method === "paypal") {
      window.open("https://paypal.me/MachineMind/150USD", "_blank");
    }
    setStep("confirm");
  };

  const goBackToPayment = () => {
    setReference("");
    setScreenshot(null);
    setScreenshotPreview(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStep("payment");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Archivo muy grande. Maximo 10MB.");
      return;
    }
    setScreenshot(file);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleConfirm = async () => {
    if (!hasProof || !selectedMethod) return;
    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("businessName", businessName.trim());
      formData.append("phone", phone.trim());
      formData.append("method", selectedMethod);
      if (reference.trim()) formData.append("reference", reference.trim());
      if (screenshot) formData.append("screenshot", screenshot);

      const res = await fetch("/api/activate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al confirmar. Intenta de nuevo.");
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
     DONE
     ═══════════════════════════════════════════════════════════════ */
  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--bg)" }}>
        <div className="max-w-md w-full">
          <div className="p-8 text-center" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
            <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center" style={{ border: "2px solid #22c55e" }}>
              <svg className="w-8 h-8" style={{ color: "#22c55e" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold mb-2" style={{ fontFamily: "var(--font-clash)", color: "var(--fg)" }}>
              Pago Reportado
            </h1>
            <p className="mb-6" style={{ color: "var(--dim)", fontSize: "0.9375rem" }}>
              Estamos verificando tu pago. Recibiras confirmacion por WhatsApp en las proximas horas.
            </p>
            <div className="text-left space-y-3 p-4" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
              <InfoRow label="Negocio" value={businessName} />
              <InfoRow label="Referencia" value={paymentRef} mono />
              <InfoRow label="Primer pago" value="$150 USD" bold />
            </div>
            <p className="text-xs mt-6" style={{ color: "rgba(240,240,243,0.2)" }}>
              Sofia se activa en 48 horas despues de confirmar el pago.
            </p>
            <a href="https://wa.me/19544451638" target="_blank" rel="noopener noreferrer" className="mt-6 inline-block text-sm" style={{ color: "var(--accent)" }}>
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
          <div className="text-[10px] uppercase tracking-[4px] font-semibold mb-3" style={{ color: "rgba(201,168,110,0.6)" }}>MACHINEMIND</div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ fontFamily: "var(--font-clash)", color: "var(--fg)" }}>Activa Sofia AI</h1>
          <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--dim)" }}>Tu asistente de IA que responde clientes 24/7 por WhatsApp</p>
        </div>

        {/* Pricing */}
        <div className="p-6 text-center" style={{ background: "linear-gradient(135deg, rgba(201,168,110,0.12) 0%, rgba(201,168,110,0.04) 100%)", border: "1px solid rgba(201,168,110,0.25)" }}>
          <div className="text-[10px] uppercase tracking-[3px] font-semibold mb-3" style={{ color: "var(--accent)" }}>OFERTA DE LANZAMIENTO</div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold" style={{ color: "var(--fg)", fontFamily: "var(--font-clash)" }}>$150</span>
            <span className="text-lg" style={{ color: "var(--dim)" }}>/mes</span>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--dim)" }}>Primeros 2 meses &middot; Despues $179/mes</p>
          <p className="text-xs mt-1" style={{ color: "rgba(240,240,243,0.2)" }}>Sin contratos. Cancela cuando quieras.</p>
        </div>

        {/* Features */}
        <div className="p-5" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
          <p className="text-[10px] uppercase tracking-[3px] font-semibold mb-4" style={{ color: "var(--accent)" }}>QUE INCLUYE</p>
          <div className="space-y-3">
            {["Chatbot IA entrenado en tu negocio", "Responde en segundos por WhatsApp, 24/7", "Pagina web profesional incluida", "Sistema de reservas inteligente", "Reportes y analiticas en tiempo real", "Setup completo en 48 horas", "Soporte directo con el equipo"].map((text) => (
              <div key={text} className="flex items-center gap-3 text-sm" style={{ color: "rgba(240,240,243,0.7)" }}>
                <svg className="w-4 h-4 shrink-0" style={{ color: "#22c55e" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
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
            <p className="text-sm font-semibold" style={{ color: "var(--fg)", fontFamily: "var(--font-clash)" }}>Tu informacion</p>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: "var(--dim)" }}>Nombre del negocio</label>
              <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ej: Hotel Boutique Cartagena" className="w-full px-4 py-3 text-sm focus:outline-none" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)", color: "var(--fg)" }} />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: "var(--dim)" }}>WhatsApp o telefono</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: +57 300 123 4567" className="w-full px-4 py-3 text-sm focus:outline-none" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)", color: "var(--fg)" }} />
            </div>
            <button onClick={() => canProceed && setStep("payment")} disabled={!canProceed} className="w-full py-3.5 text-sm font-semibold transition-all disabled:opacity-20" style={{ border: "1px solid var(--accent)", backgroundColor: canProceed ? "var(--accent)" : "transparent", color: canProceed ? "#06060a" : "var(--accent)" }}>
              Continuar al pago
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
           STEP 2: SELECT PAYMENT METHOD (client-side only)
           ═══════════════════════════════════════════════════════════════ */}
        {step === "payment" && (
          <div className="space-y-4 p-6" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: "var(--fg)", fontFamily: "var(--font-clash)" }}>Metodo de Pago</p>
              <button onClick={() => setStep("info")} className="text-xs transition-colors" style={{ color: "var(--dim)" }}>Volver</button>
            </div>

            {/* Summary */}
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

            {/* PayPal — primary CTA */}
            <button onClick={() => goToConfirm("paypal")} className="w-full flex items-center gap-4 p-4 text-left transition-all" style={{ backgroundColor: "rgba(0,112,221,0.08)", border: "1px solid rgba(0,112,221,0.3)" }}>
              <svg className="w-8 h-6 shrink-0" viewBox="0 0 24 24" fill="#0070dd">
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
              </svg>
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{ color: "#4da6ff" }}>Pagar con PayPal — $150 USD</div>
                <div className="text-xs" style={{ color: "var(--dim)" }}>Se abre PayPal para pagar directamente</div>
              </div>
              <svg className="w-4 h-4 shrink-0" style={{ color: "var(--dim)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--glass-border)" }} />
              <span className="text-xs" style={{ color: "var(--dim)" }}>o elige otro metodo</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--glass-border)" }} />
            </div>

            {/* Other methods */}
            <div className="space-y-2">
              {([
                { id: "zelle" as const, label: "Zelle", sub: "Instantaneo, sin comisiones" },
                { id: "venmo" as const, label: "Venmo", sub: "@MachineMind" },
                { id: "cashapp" as const, label: "CashApp", sub: "$MachineMindAI" },
                { id: "bank_transfer" as const, label: "Transferencia Bancaria", sub: "Wire transfer en USD" },
                { id: "other" as const, label: "Otro metodo", sub: "Contacta para coordinar" },
              ]).map((m) => (
                <button key={m.id} onClick={() => goToConfirm(m.id)} className="w-full flex items-center gap-4 p-4 text-left transition-all" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>{m.label}</div>
                    <div className="text-xs" style={{ color: "var(--dim)" }}>{m.sub}</div>
                  </div>
                  <svg className="w-4 h-4 shrink-0" style={{ color: "var(--dim)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
           STEP 3: CONFIRM PAYMENT
           ═══════════════════════════════════════════════════════════════ */}
        {step === "confirm" && (
          <div className="space-y-4 p-6" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: "var(--fg)", fontFamily: "var(--font-clash)" }}>Confirmar Pago</p>
              <button onClick={goBackToPayment} className="text-xs transition-colors" style={{ color: "var(--dim)" }}>
                Cambiar metodo
              </button>
            </div>

            {/* Method-specific instructions */}
            {selectedMethod === "paypal" && (
              <div className="p-4 text-sm space-y-2" style={{ backgroundColor: "rgba(0,112,221,0.05)", border: "1px solid rgba(0,112,221,0.2)" }}>
                <p style={{ color: "rgba(240,240,243,0.8)" }}>
                  PayPal se abrio en otra ventana. Completa el pago de <strong style={{ color: "var(--fg)" }}>$150 USD</strong> y vuelve aqui para confirmar.
                </p>
                <a href="https://paypal.me/MachineMind/150USD" target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium" style={{ color: "#4da6ff" }}>
                  Abrir PayPal de nuevo
                </a>
              </div>
            )}

            {selectedMethod === "zelle" && (
              <div className="p-4 text-sm space-y-2" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
                <p className="font-medium" style={{ color: "rgba(240,240,243,0.8)" }}>Enviar Zelle a:</p>
                <div className="p-3 space-y-2" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)" }}>
                  <Row label="Email" value="machinemindconsulting@gmail.com" mono />
                  <Row label="Nombre" value="Philip McGill" />
                  <Row label="Monto" value="$150 USD" bold />
                </div>
              </div>
            )}

            {selectedMethod === "venmo" && (
              <div className="p-4 text-sm space-y-2" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
                <p className="font-medium" style={{ color: "rgba(240,240,243,0.8)" }}>Enviar Venmo a:</p>
                <div className="p-3 space-y-2" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)" }}>
                  <Row label="Usuario" value="@MachineMind" mono />
                  <Row label="Nombre" value="Philip McGill" />
                  <Row label="Monto" value="$150 USD" bold />
                </div>
              </div>
            )}

            {selectedMethod === "cashapp" && (
              <div className="p-4 text-sm space-y-2" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
                <p className="font-medium" style={{ color: "rgba(240,240,243,0.8)" }}>Enviar CashApp a:</p>
                <div className="p-3 space-y-2" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)" }}>
                  <Row label="Cashtag" value="$MachineMindAI" mono />
                  <Row label="Nombre" value="Philip McGill" />
                  <Row label="Monto" value="$150 USD" bold />
                </div>
              </div>
            )}

            {selectedMethod === "bank_transfer" && (
              <div className="p-4 text-sm space-y-2" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
                <p className="font-medium" style={{ color: "rgba(240,240,243,0.8)" }}>Wire Transfer:</p>
                <div className="p-3 space-y-2" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border)" }}>
                  <Row label="Banco" value="Navy Federal Credit Union" />
                  <Row label="Routing" value="256074974" mono />
                  <Row label="SWIFT" value="NFCUUS33XXX" mono />
                  <Row label="Titular" value="Philip McGill" />
                  <Row label="Monto" value="$150 USD" bold />
                </div>
                <p style={{ color: "var(--dim)" }}>Para el numero de cuenta, contacta al +1 (954) 445-1638</p>
              </div>
            )}

            {selectedMethod === "other" && (
              <div className="p-4 text-sm" style={{ backgroundColor: "var(--glass)", border: "1px solid var(--glass-border)" }}>
                <p style={{ color: "rgba(240,240,243,0.8)" }}>Coordina el pago por WhatsApp y sube el comprobante aqui:</p>
                <a href="https://wa.me/19544451638" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block" style={{ color: "var(--accent)" }}>+1 (954) 445-1638</a>
              </div>
            )}

            {/* Confirmation number */}
            <div>
              <label className="text-xs block mb-1.5" style={{ color: "var(--dim)" }}>Numero de confirmacion</label>
              <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej: comprobante #12345, ID de transaccion" className="w-full px-4 py-3 text-sm focus:outline-none" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border)", color: "var(--fg)" }} />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--glass-border)" }} />
              <span className="text-xs" style={{ color: "var(--dim)" }}>y/o</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--glass-border)" }} />
            </div>

            {/* Screenshot upload */}
            <div>
              <label className="text-xs block mb-1.5" style={{ color: "var(--dim)" }}>Captura de pantalla del pago</label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

              {screenshotPreview ? (
                <div className="relative">
                  <img src={screenshotPreview} alt="Comprobante" className="w-full max-h-60 object-contain" style={{ border: "1px solid var(--glass-border)" }} />
                  <button
                    onClick={() => { setScreenshot(null); setScreenshotPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center"
                    style={{ backgroundColor: "rgba(0,0,0,0.7)", border: "1px solid var(--glass-border)", color: "var(--fg)" }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="w-full py-8 flex flex-col items-center gap-2 transition-all" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px dashed var(--glass-border)" }}>
                  <svg className="w-8 h-8" style={{ color: "var(--dim)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                  <span className="text-sm" style={{ color: "var(--dim)" }}>Toca para subir captura</span>
                  <span className="text-xs" style={{ color: "rgba(240,240,243,0.15)" }}>JPG, PNG — maximo 10MB</span>
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>{error}</div>
            )}

            <button onClick={handleConfirm} disabled={submitting || !hasProof} className="w-full py-3.5 text-sm font-semibold transition-all disabled:opacity-30" style={{ backgroundColor: hasProof ? "var(--accent)" : "transparent", color: hasProof ? "#06060a" : "var(--accent)", border: "1px solid var(--accent)" }}>
              {submitting ? "Enviando..." : "Confirmar pago"}
            </button>

            <p className="text-xs text-center" style={{ color: "rgba(240,240,243,0.2)" }}>
              Tu pago sera verificado manualmente. Recibiras confirmacion por WhatsApp.
            </p>
          </div>
        )}

        {/* WhatsApp support */}
        <div className="text-center">
          <a href="https://wa.me/19544451638" target="_blank" rel="noopener noreferrer" className="inline-block text-sm transition-colors" style={{ color: "var(--dim)" }}>Dudas? Escribenos por WhatsApp</a>
        </div>
        <div className="text-center pb-8">
          <p className="text-[10px]" style={{ color: "rgba(240,240,243,0.15)" }}>MachineMind Consulting</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

function Row({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span style={{ color: "var(--dim)" }}>{label}</span>
      <span style={{ color: "var(--fg)", fontFamily: mono ? "'JetBrains Mono', monospace" : "var(--font-satoshi)", fontWeight: bold ? 600 : 400 }}>{value}</span>
    </div>
  );
}

function InfoRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: "var(--dim)" }}>{label}</span>
      <span style={{ color: "var(--fg)", fontFamily: mono ? "'JetBrains Mono', monospace" : undefined, fontWeight: bold ? 600 : undefined }}>{value}</span>
    </div>
  );
}
