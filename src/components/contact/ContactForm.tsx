"use client";

import { useState } from "react";
import { useLanguage } from "@/store/portfolio";
import { translations } from "@/lib/i18n";
import { Button } from "@/components/ui";

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
}

export default function ContactForm() {
  const language = useLanguage();
  const t = translations[language].contact.form;

  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });

  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, language }),
      });

      if (!res.ok) throw new Error("Failed to submit");

      setStatus("success");
      setFormData({ name: "", email: "", phone: "", company: "", message: "" });
    } catch {
      setStatus("error");
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-muted mb-2"
          >
            {t.name} *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full min-h-[48px] px-4 py-3
                       bg-[rgba(15,15,26,0.8)] border border-[var(--mm-border)]
                       text-white placeholder-[var(--mm-text-subtle)]
                       transition-all duration-200
                       focus:border-[var(--mm-gold)] focus:outline-none"
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-muted mb-2"
          >
            {t.email} *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full min-h-[48px] px-4 py-3
                       bg-[rgba(15,15,26,0.8)] border border-[var(--mm-border)]
                       text-white placeholder-[var(--mm-text-subtle)]
                       transition-all duration-200
                       focus:border-[var(--mm-gold)] focus:outline-none"
          />
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-muted mb-2"
          >
            {t.phone}
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full min-h-[48px] px-4 py-3
                       bg-[rgba(15,15,26,0.8)] border border-[var(--mm-border)]
                       text-white placeholder-[var(--mm-text-subtle)]
                       transition-all duration-200
                       focus:border-[var(--mm-gold)] focus:outline-none"
          />
        </div>

        {/* Company */}
        <div>
          <label
            htmlFor="company"
            className="block text-sm font-medium text-muted mb-2"
          >
            {t.company}
          </label>
          <input
            type="text"
            id="company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            className="w-full min-h-[48px] px-4 py-3
                       bg-[rgba(15,15,26,0.8)] border border-[var(--mm-border)]
                       text-white placeholder-[var(--mm-text-subtle)]
                       transition-all duration-200
                       focus:border-[var(--mm-gold)] focus:outline-none"
          />
        </div>
      </div>

      {/* Message */}
      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium text-muted mb-2"
        >
          {t.message}
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          value={formData.message}
          onChange={handleChange}
          className="w-full px-4 py-3
                     bg-[rgba(15,15,26,0.8)] border border-[var(--mm-border)]
                     text-white placeholder-[var(--mm-text-subtle)]
                     transition-all duration-200 resize-none
                     focus:border-[var(--mm-gold)] focus:outline-none"
        />
      </div>

      {/* Status Messages */}
      {status === "success" && (
        <p className="text-[var(--mm-healthy)] text-sm">{t.success}</p>
      )}
      {status === "error" && (
        <p className="text-[var(--mm-down)] text-sm">{t.error}</p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="gold"
        size="lg"
        isLoading={status === "loading"}
        className="w-full md:w-auto"
      >
        {status === "loading" ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
