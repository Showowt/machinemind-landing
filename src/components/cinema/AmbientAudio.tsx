"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AmbientAudioProps {
  /** Enable/disable the audio system */
  enabled?: boolean;
  /** Base frequency for sub-bass oscillator (Hz) */
  baseFrequency?: number;
  /** Maximum volume (0-1, keep very low for subliminal effect) */
  maxVolume?: number;
  /** Enable hover tick sounds on interactive elements */
  enableHoverTicks?: boolean;
  /** CSS selector for elements that should trigger hover ticks */
  hoverSelector?: string;
}

interface AudioState {
  isInitialized: boolean;
  isEnabled: boolean;
  isMuted: boolean;
  scrollPosition: number;
}

/**
 * AmbientAudio - Subliminal atmosphere generator
 * 
 * Creates an almost imperceptible audio layer that enhances
 * the cinematic experience without conscious awareness.
 * 
 * Features:
 * - Sub-bass oscillator (50Hz sine wave)
 * - Lowpass filter sweep tied to scroll
 * - Volume modulation based on scroll position
 * - Optional hover tick sounds
 * - Click-to-activate (browser autoplay policy compliance)
 */
export function AmbientAudio({
  enabled = true,
  baseFrequency = 50,
  maxVolume = 0.03, // Extremely subtle - almost subliminal
  enableHoverTicks = true,
  hoverSelector = "a, button, [role='button'], [data-hover-tick]",
}: AmbientAudioProps) {
  const [state, setState] = useState<AudioState>({
    isInitialized: false,
    isEnabled: false,
    isMuted: true,
  scrollPosition: 0,
  });

  // Audio nodes refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const tickGainRef = useRef<GainNode | null>(null);

  // Animation frame ref for scroll tracking
  const rafRef = useRef<number | null>(null);

  // Check if Web Audio API is supported
  const isSupported = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    return !!(window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  }, []);

  // Initialize audio context and nodes
  const initializeAudio = useCallback((): boolean => {
    if (!isSupported()) {
      console.warn("[AmbientAudio] Web Audio API not supported");
      return false;
    }

    try {
      // Create audio context
      const AudioContextClass = window.AudioContext || 
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      // Create master gain node (volume control)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.connect(ctx.destination);
      gainNodeRef.current = masterGain;

      // Create lowpass filter (scroll-controlled)
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(200, ctx.currentTime); // Start low
      filter.Q.setValueAtTime(1, ctx.currentTime);
      filter.connect(masterGain);
      filterRef.current = filter;

      // Create sub-bass oscillator
      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(baseFrequency, ctx.currentTime);
      oscillator.connect(filter);
      oscillator.start();
      oscillatorRef.current = oscillator;

      // Create separate gain for tick sounds
      const tickGain = ctx.createGain();
      tickGain.gain.setValueAtTime(0, ctx.currentTime);
      tickGain.connect(ctx.destination);
      tickGainRef.current = tickGain;

      setState(prev => ({ ...prev, isInitialized: true }));
      return true;
    } catch (error) {
      console.error("[AmbientAudio] Failed to initialize:", error);
      return false;
    }
  }, [isSupported, baseFrequency]);

  // Enable audio (resume context after user interaction)
  const enableAudio = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (!ctx) {
      if (!initializeAudio()) return;
    }

    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    try {
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      // Fade in the master volume smoothly
      const gain = gainNodeRef.current;
      if (gain) {
        gain.gain.cancelScheduledValues(audioCtx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(maxVolume, audioCtx.currentTime + 2);
      }

      setState(prev => ({ ...prev, isEnabled: true, isMuted: false }));
    } catch (error) {
      console.error("[AmbientAudio] Failed to enable:", error);
    }
  }, [initializeAudio, maxVolume]);

  // Disable audio (fade out and suspend)
  const disableAudio = useCallback(async () => {
    const ctx = audioContextRef.current;
    const gain = gainNodeRef.current;

    if (ctx && gain) {
      // Fade out smoothly
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

      // Suspend context after fade
      setTimeout(async () => {
        if (ctx.state === "running") {
          await ctx.suspend();
        }
      }, 500);
    }

    setState(prev => ({ ...prev, isEnabled: false, isMuted: true }));
  }, []);

  // Toggle mute state
  const toggleMute = useCallback(() => {
    if (state.isMuted) {
      enableAudio();
    } else {
      disableAudio();
    }
  }, [state.isMuted, enableAudio, disableAudio]);

  // Update filter and volume based on scroll position
  const updateWithScroll = useCallback((scrollY: number) => {
    const ctx = audioContextRef.current;
    const filter = filterRef.current;
    const gain = gainNodeRef.current;

    if (!ctx || !filter || !gain || state.isMuted) return;

    // Calculate scroll percentage (0-1)
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = Math.min(scrollY / maxScroll, 1);

    // Sweep filter frequency based on scroll (200Hz -> 2000Hz)
    const minFreq = 200;
    const maxFreq = 2000;
    const targetFreq = minFreq + (scrollPercent * (maxFreq - minFreq));
    filter.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.1);

    // Modulate volume based on scroll (slight increase in middle)
    const volumeCurve = Math.sin(scrollPercent * Math.PI); // Peak at 50% scroll
    const volumeMultiplier = 0.7 + (volumeCurve * 0.3); // Range: 0.7 - 1.0
    const targetVolume = maxVolume * volumeMultiplier;
    gain.gain.setTargetAtTime(targetVolume, ctx.currentTime, 0.1);

    setState(prev => ({ ...prev, scrollPosition: scrollPercent }));
  }, [state.isMuted, maxVolume]);

  // Play subtle tick sound
  const playTick = useCallback(() => {
    const ctx = audioContextRef.current;
    const tickGain = tickGainRef.current;

    if (!ctx || !tickGain || state.isMuted) return;

    try {
      // Create a very short, quiet click
      const tickOsc = ctx.createOscillator();
      tickOsc.type = "sine";
      tickOsc.frequency.setValueAtTime(2000 + Math.random() * 500, ctx.currentTime);

      // Create envelope for tick
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, ctx.currentTime);
      envelope.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 0.001); // Very quiet
      envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);

      tickOsc.connect(envelope);
      envelope.connect(ctx.destination);

      tickOsc.start(ctx.currentTime);
      tickOsc.stop(ctx.currentTime + 0.05);
    } catch {
      // Silently fail - ticks are optional enhancement
    }
  }, [state.isMuted]);

  // Scroll listener
  useEffect(() => {
    if (!enabled) return;

    const handleScroll = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        updateWithScroll(window.scrollY);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [enabled, updateWithScroll]);

  // Hover tick listener
  useEffect(() => {
    if (!enabled || !enableHoverTicks || !state.isEnabled) return;

    const handleHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches(hoverSelector)) {
        playTick();
      }
    };

    document.addEventListener("mouseover", handleHover, { passive: true });

    return () => {
      document.removeEventListener("mouseover", handleHover);
    };
  }, [enabled, enableHoverTicks, hoverSelector, state.isEnabled, playTick]);

  // Click to enable (first interaction)
  useEffect(() => {
    if (!enabled || state.isEnabled) return;

    const handleFirstInteraction = () => {
      enableAudio();
      // Remove listeners after first interaction
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("touchstart", handleFirstInteraction);
    };

    document.addEventListener("click", handleFirstInteraction, { passive: true });
    document.addEventListener("touchstart", handleFirstInteraction, { passive: true });

    return () => {
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, [enabled, state.isEnabled, enableAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const ctx = audioContextRef.current;
      const osc = oscillatorRef.current;

      if (osc) {
        try {
          osc.stop();
        } catch {
          // Already stopped
        }
      }

      if (ctx) {
        ctx.close();
      }
    };
  }, []);

  // Visibility change handler (pause when tab hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (document.hidden) {
        if (ctx.state === "running") {
          ctx.suspend();
        }
      } else if (state.isEnabled && !state.isMuted) {
        if (ctx.state === "suspended") {
          ctx.resume();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [state.isEnabled, state.isMuted]);

  // No visual output - this is a purely audio component
  // Optional: Add a small mute toggle button
  if (!enabled || !isSupported()) {
    return null;
  }

  return (
    <>
      {/* Hidden audio control button - can be styled and positioned as needed */}
      <button
        onClick={toggleMute}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 flex items-center justify-center 
                   bg-[#0f0f1a]/80 border border-[#d4af37]/30 hover:border-[#d4af37]/60
                   text-[#d4af37]/60 hover:text-[#d4af37] transition-all duration-300
                   opacity-0 hover:opacity-100 focus:opacity-100"
        aria-label={state.isMuted ? "Enable ambient audio" : "Mute ambient audio"}
        title={state.isMuted ? "Enable ambient audio" : "Mute ambient audio"}
      >
        {state.isMuted ? (
          // Muted icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          // Playing icon with subtle pulse
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
            className="animate-pulse"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </button>
    </>
  );
}

// Hook for external control of ambient audio
export function useAmbientAudio() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playImpact = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    // Low thump for impact moments
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }, []);

  const playSuccess = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    // Rising tone for success moments
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }, []);

  return {
    setContext: (ctx: AudioContext) => {
      audioContextRef.current = ctx;
    },
    playImpact,
    playSuccess,
  };
}

export default AmbientAudio;
