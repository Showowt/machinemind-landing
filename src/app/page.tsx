"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AutopoieticHero } from "@/components/hero";
import { PortfolioGrid } from "@/components/portfolio";
import { SystemStatus } from "@/components/system";
import { ContactSection } from "@/components/contact";
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

// Cinema Engine replaces custom cursor
const CinemaEngine = dynamic(() => import("@/components/cinema/CinemaEngine"), {
  ssr: false,
});

const SofiaChat = dynamic(() => import("@/components/sofia/SofiaChat"), {
  ssr: false,
});

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [cinemaReady, setCinemaReady] = useState(false);

  useEffect(() => {
    // Check if already loaded
    if (sessionStorage.getItem("mm-loaded")) {
      setIsLoaded(true);
    }
    // Enable cinema engine after load
    const cinemaTimer = setTimeout(() => setCinemaReady(true), 800);
    return () => clearTimeout(cinemaTimer);
  }, []);

  if (!isLoaded) {
    return <LoadingSequence onComplete={() => setIsLoaded(true)} />;
  }

  return (
    <>
      {/* Cinema Engine v2.0 - 25 Layer Cinematic Experience */}
      {cinemaReady && (
        <CinemaEngine
          brandName="MACHINEMIND"
          accentColor="#00e5ff"
          skipPreloader={true}
          sound={false}
        />
      )}

      {/* Header */}
      <Header />

      {/* Scroll Progress Bar - Cinema Engine provides its own */}
      <ScrollProgress />

      <main id="main-content" className="min-h-screen" role="main">
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
