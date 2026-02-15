"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AutopoieticHero } from "@/components/hero";
import { PortfolioGrid } from "@/components/portfolio";
import { SystemStatus } from "@/components/system";
import { ContactSection, WhatsAppCTA } from "@/components/contact";
import { Footer, Header } from "@/components/layout";
import {
  ClientLogos,
  TestimonialsCarousel,
  CapabilitiesGrid,
  WhyMachineMind,
  FAQAccordion,
  LiveMetrics,
} from "@/components/sections";
import { ScrollProgress } from "@/components/animation";

// Dynamic imports for heavy components
const LoadingSequence = dynamic(
  () => import("@/components/sections/LoadingSequence"),
  { ssr: false },
);

const CustomCursor = dynamic(() => import("@/components/cursor/CustomCursor"), {
  ssr: false,
});

const SofiaChat = dynamic(() => import("@/components/sofia/SofiaChat"), {
  ssr: false,
});

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showCursor, setShowCursor] = useState(false);

  useEffect(() => {
    // Check if already loaded
    if (sessionStorage.getItem("mm-loaded")) {
      setIsLoaded(true);
    }
    // Enable cursor after a short delay
    const cursorTimer = setTimeout(() => setShowCursor(true), 500);
    return () => clearTimeout(cursorTimer);
  }, []);

  if (!isLoaded) {
    return <LoadingSequence onComplete={() => setIsLoaded(true)} />;
  }

  return (
    <>
      {/* Header */}
      <Header />

      {/* Scroll Progress Bar */}
      <ScrollProgress />

      {/* Custom Cursor */}
      {showCursor && <CustomCursor />}

      <main className="min-h-screen">
        {/* Hero Section with Neural Network */}
        <AutopoieticHero />

        {/* Client Logos - Social Proof */}
        <ClientLogos />

        {/* Why MachineMind - Differentiators */}
        <WhyMachineMind />

        {/* Portfolio Grid */}
        <PortfolioGrid />

        {/* Capabilities - Hexagonal Grid */}
        <CapabilitiesGrid />

        {/* Live Metrics */}
        <LiveMetrics />

        {/* Testimonials */}
        <TestimonialsCarousel />

        {/* System Status */}
        <SystemStatus />

        {/* FAQ */}
        <FAQAccordion />

        {/* Contact Section */}
        <ContactSection />

        {/* Footer */}
        <Footer />
      </main>

      {/* Sofia AI Chat */}
      <SofiaChat />
    </>
  );
}
