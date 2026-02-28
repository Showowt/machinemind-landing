"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/store/portfolio";
import { RevealOnScroll } from "@/components/animation";

interface FAQ {
  questionEs: string;
  questionEn: string;
  answerEs: string;
  answerEn: string;
}

const faqs: FAQ[] = [
  {
    questionEs: "¿En qué industrias se especializan?",
    questionEn: "What industries do you specialize in?",
    answerEs:
      "Nos especializamos en hospitalidad: hoteles, restaurantes, tours, transfers, vida nocturna, y servicios de concierge. También trabajamos con servicios profesionales y gobierno.",
    answerEn:
      "We specialize in hospitality: hotels, restaurants, tours, transfers, nightlife, and concierge services. We also work with professional services and government.",
  },
  {
    questionEs: "¿Cuánto tiempo toma un proyecto típico?",
    questionEn: "How long does a typical project take?",
    answerEs:
      "Proyectos típicos toman 4-8 semanas desde el kickoff hasta producción. Proyectos más complejos con integraciones múltiples pueden tomar 10-12 semanas.",
    answerEn:
      "Typical projects take 4-8 weeks from kickoff to production. More complex projects with multiple integrations can take 10-12 weeks.",
  },
  {
    questionEs: "¿Ofrecen mantenimiento continuo?",
    questionEn: "Do you offer ongoing maintenance?",
    answerEs:
      "Sí. Todos nuestros sistemas incluyen monitoreo 24/7, actualizaciones automáticas, y soporte técnico. Ofrecemos planes de mantenimiento mensual adaptados a cada cliente.",
    answerEn:
      "Yes. All our systems include 24/7 monitoring, automatic updates, and technical support. We offer monthly maintenance plans tailored to each client.",
  },
  {
    questionEs: "¿Qué hace diferente a su IA?",
    questionEn: "What makes your AI different?",
    answerEs:
      "Usamos los modelos más avanzados (Claude, GPT-4) combinados con conocimiento específico de hospitalidad. Nuestros agentes entienden contexto, manejan reservas, y escalan a humanos cuando es necesario.",
    answerEn:
      "We use the most advanced models (Claude, GPT-4) combined with hospitality-specific knowledge. Our agents understand context, handle bookings, and escalate to humans when needed.",
  },
  {
    questionEs: "¿Cómo manejan la seguridad de datos?",
    questionEn: "How do you handle data security?",
    answerEs:
      "Implementamos Row Level Security en cada tabla, cifrado de extremo a extremo, y autenticación robusta. Cumplimos con estándares internacionales de protección de datos.",
    answerEn:
      "We implement Row Level Security on every table, end-to-end encryption, and robust authentication. We comply with international data protection standards.",
  },
  {
    questionEs: "¿Cuál es su modelo de precios?",
    questionEn: "What's your pricing model?",
    answerEs:
      "Ofrecemos proyectos de precio fijo para desarrollo inicial, más planes de mantenimiento mensual. Los precios varían según complejidad e integraciones requeridas.",
    answerEn:
      "We offer fixed-price projects for initial development, plus monthly maintenance plans. Prices vary based on complexity and required integrations.",
  },
  {
    questionEs: "¿Pueden integrarse con sistemas existentes?",
    questionEn: "Can you integrate with existing systems?",
    answerEs:
      "Sí. Nos integramos con PMS de hoteles, sistemas de reservas existentes, CRMs, pasarelas de pago (Wompi, Stripe), y prácticamente cualquier API.",
    answerEn:
      "Yes. We integrate with hotel PMS, existing booking systems, CRMs, payment gateways (Wompi, Stripe), and virtually any API.",
  },
  {
    questionEs: "¿Trabajan con clientes internacionales?",
    questionEn: "Do you work with international clients?",
    answerEs:
      "Sí. Aunque nos enfocamos en Colombia y Latinoamérica, trabajamos con clientes en Estados Unidos, Europa, y otras regiones. Todo nuestro equipo es bilingüe.",
    answerEn:
      "Yes. While we focus on Colombia and Latin America, we work with clients in the United States, Europe, and other regions. Our entire team is bilingual.",
  },
];

export default function FAQAccordion() {
  const language = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const title =
    language === "es" ? "Preguntas Frecuentes" : "Frequently Asked Questions";

  return (
    <section className="section-padding bg-[rgba(0,0,0,0.2)]">
      <div className="container-luxury">
        {/* Header */}
        <RevealOnScroll direction="up" className="text-center mb-16">
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mb-4">
            {title}
          </h2>
          <div className="gold-line w-24 mx-auto mt-6" />
        </RevealOnScroll>

        {/* FAQ Items */}
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            const question =
              language === "es" ? faq.questionEs : faq.questionEn;
            const answer = language === "es" ? faq.answerEs : faq.answerEn;

            return (
              <RevealOnScroll key={index} direction="up" delay={index * 0.05}>
                <div
                  className="border border-[var(--mm-border)]
                             bg-[rgba(15,15,26,0.6)]
                             transition-all duration-300
                             hover:border-[var(--mm-border-hover)]"
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full p-4 sm:p-5 md:p-6 flex items-center justify-between
                               text-left
                               focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mm-blue-core)]"
                  >
                    <span className="font-medium text-white pr-4">
                      {question}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-gold text-2xl flex-shrink-0"
                    >
                      +
                    </motion.span>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                          <div className="h-px bg-[var(--mm-border)] mb-4" />
                          <p className="text-muted leading-relaxed">{answer}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
