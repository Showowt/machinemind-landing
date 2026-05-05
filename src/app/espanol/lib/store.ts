"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TabId, VocabItem, Stats, StreakData, ErrorPattern, Message, CorrectionData, DifficultyState, ShadowResult, ListenResult } from "./types";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client ───────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STORAGE_KEY = "phil_espanol_v2";

// ── Store Interface ───��───────────────────────────────────────────────────────
interface EspanolStore {
  // UI State
  tab: TabId;
  setTab: (t: TabId) => void;
  mounted: boolean;
  setMounted: (v: boolean) => void;

  // Conversation
  messages: Message[];
  setMessages: (msgs: Message[]) => void;
  addMessage: (msg: Message) => void;
  clearMessages: () => void;
  corrections: Record<number, CorrectionData>;
  setCorrection: (msgId: number, data: CorrectionData) => void;
  clearCorrections: () => void;

  // Persistent Data
  vocab: VocabItem[];
  addVocab: (items: VocabItem[]) => void;
  updateVocabItem: (es: string, update: Partial<VocabItem>) => void;
  done: number[];
  completeMission: (id: number) => void;
  stats: Stats;
  updateStats: (fn: (prev: Stats) => Stats) => void;
  streak: StreakData;
  updateStreak: () => void;

  // Error Pattern Intelligence
  errorPatterns: ErrorPattern[];
  recordError: (category: string, original: string, correction: string) => void;
  getWeakestPatterns: (n: number) => ErrorPattern[];

  // Adaptive Difficulty
  difficulty: DifficultyState;
  recordFluencyScore: (score: number) => void;
  getDifficultyLevel: () => number;

  // Shadowing
  shadowHistory: ShadowResult[];
  addShadowResult: (result: ShadowResult) => void;

  // Listening
  listenHistory: ListenResult[];
  addListenResult: (result: ListenResult) => void;

  // Sync
  syncToSupabase: () => void;
  loadFromSupabase: () => Promise<void>;
}

export const useEspanolStore = create<EspanolStore>()(
  persist(
    (set, get) => ({
      // UI
      tab: "talk",
      setTab: (t) => set({ tab: t }),
      mounted: false,
      setMounted: (v) => set({ mounted: v }),

      // Conversation
      messages: [],
      setMessages: (msgs) => set({ messages: msgs }),
      addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
      clearMessages: () => set({ messages: [] }),
      corrections: {},
      setCorrection: (msgId, data) => set((s) => ({ corrections: { ...s.corrections, [msgId]: data } })),
      clearCorrections: () => set({ corrections: {} }),

      // Vocab
      vocab: [],
      addVocab: (items) => set((s) => {
        const merged = [...s.vocab];
        for (const item of items) {
          const idx = merged.findIndex(v => v.es === item.es);
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], timesSeen: (merged[idx].timesSeen || 1) + 1, lastSeen: new Date().toISOString() };
          } else {
            merged.push({ ...item, timesSeen: 1, lastSeen: new Date().toISOString() });
          }
        }
        return { vocab: merged };
      }),
      updateVocabItem: (es, update) => set((s) => ({
        vocab: s.vocab.map(v => v.es === es ? { ...v, ...update } : v)
      })),

      // Missions
      done: [],
      completeMission: (id) => set((s) => ({ done: [...new Set([...s.done, id])] })),

      // Stats
      stats: { msgs: 0, corrections: 0, fp: 0, convos: 0, shadowSessions: 0, listenSessions: 0, photoSessions: 0, avgFluency: 0 },
      updateStats: (fn) => set((s) => ({ stats: fn(s.stats) })),

      // Streak
      streak: { count: 0, date: "" },
      updateStreak: () => set((s) => {
        const today = new Date().toDateString();
        if (s.streak.date === today) return s;
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const newCount = s.streak.date === yesterday ? s.streak.count + 1 : 1;
        return { streak: { count: newCount, date: today } };
      }),

      // Error Pattern Intelligence
      errorPatterns: [],
      recordError: (category, original, correction) => set((s) => {
        const patterns = [...s.errorPatterns];
        const idx = patterns.findIndex(p => p.category === category);
        if (idx >= 0) {
          patterns[idx] = {
            ...patterns[idx],
            count: patterns[idx].count + 1,
            total: patterns[idx].total + 1,
            rate: (patterns[idx].count + 1) / (patterns[idx].total + 1),
            lastSeen: new Date().toISOString(),
            examples: [...patterns[idx].examples.slice(-4), { original, correction }],
          };
        } else {
          patterns.push({
            category,
            label: category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
            count: 1,
            total: 1,
            rate: 1,
            lastSeen: new Date().toISOString(),
            examples: [{ original, correction }],
          });
        }
        return { errorPatterns: patterns };
      }),
      getWeakestPatterns: (n) => {
        const patterns = get().errorPatterns;
        return [...patterns].sort((a, b) => b.rate - a.rate).slice(0, n);
      },

      // Adaptive Difficulty
      difficulty: { level: 3, recentScores: [], adjustedAt: "" },
      recordFluencyScore: (score) => set((s) => {
        const recent = [...s.difficulty.recentScores, score].slice(-20);
        const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
        let newLevel = s.difficulty.level;
        if (recent.length >= 5) {
          if (avg >= 8 && s.difficulty.level < 10) newLevel = Math.min(10, s.difficulty.level + 1);
          else if (avg <= 4 && s.difficulty.level > 1) newLevel = Math.max(1, s.difficulty.level - 1);
        }
        return { difficulty: { level: newLevel, recentScores: recent, adjustedAt: new Date().toISOString() } };
      }),
      getDifficultyLevel: () => get().difficulty.level,

      // Shadowing
      shadowHistory: [],
      addShadowResult: (result) => set((s) => ({
        shadowHistory: [...s.shadowHistory.slice(-50), result],
        stats: { ...s.stats, shadowSessions: s.stats.shadowSessions + 1 },
      })),

      // Listening
      listenHistory: [],
      addListenResult: (result) => set((s) => ({
        listenHistory: [...s.listenHistory.slice(-50), result],
        stats: { ...s.stats, listenSessions: s.stats.listenSessions + 1 },
      })),

      // Supabase sync
      syncToSupabase: () => {
        const s = get();
        const payload = {
          id: STORAGE_KEY,
          vocab: s.vocab,
          done: s.done,
          stats: s.stats,
          streak: s.streak,
          error_patterns: s.errorPatterns,
          difficulty: s.difficulty,
          shadow_history: s.shadowHistory.slice(-20),
          listen_history: s.listenHistory.slice(-20),
          updated_at: new Date().toISOString(),
        };
        supabase.from("espanol_progress").upsert(payload, { onConflict: "id" }).then(() => {});
      },
      loadFromSupabase: async () => {
        try {
          const { data } = await supabase.from("espanol_progress").select("*").eq("id", STORAGE_KEY).single();
          if (data) {
            set({
              vocab: data.vocab || [],
              done: data.done || [],
              stats: data.stats || get().stats,
              streak: data.streak || get().streak,
              errorPatterns: data.error_patterns || [],
              difficulty: data.difficulty || get().difficulty,
              shadowHistory: data.shadow_history || [],
              listenHistory: data.listen_history || [],
            });
          }
        } catch { /* fallback to localStorage via persist */ }
      },
    }),
    {
      name: "espanol-os-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        vocab: state.vocab,
        done: state.done,
        stats: state.stats,
        streak: state.streak,
        errorPatterns: state.errorPatterns,
        difficulty: state.difficulty,
        shadowHistory: state.shadowHistory,
        listenHistory: state.listenHistory,
      }),
    }
  )
);
