// ── Español OS Type System ────���─────────────────────────────────────────────

export interface VocabItem {
  es: string;
  en: string;
  phonetic?: string;
  difficulty?: 1 | 2 | 3; // 1=easy, 2=medium, 3=hard sounds
  soundsLike?: string;
  pronunciationWarning?: string;
  timesSeen?: number;
  timesCorrect?: number;
  lastSeen?: string;
}

export interface Scenario {
  id: string;
  icon: string;
  label: string;
  color: string;
  personaName: string;
  personaAge: number;
  personaDesc: string;
  avatarLetter: string;
  avatarColor: string;
  prompt: string;
}

export interface PatternType {
  id: string;
  n: number;
  name: string;
  sub: string;
  color: string;
  formula: string;
  rule: string;
  ex: { es: string; en: string }[];
  drill: string;
}

export interface MissionType {
  id: number;
  w: number;
  day: number;
  icon: string;
  title: string;
  diff: number;
  desc: string;
  vocab: string[];
  cultural?: string; // pre-mission cultural brief
}

export interface AIData {
  response_es?: string;
  response_en?: string;
  correction?: string | null;
  correction_note?: string | null;
  pattern_name?: string;
  pattern_formula?: string;
  flow_connector?: string;
  flow_connector_meaning?: string;
  new_vocab?: VocabItem[];
  fluency_points?: number;
  vibe?: string | null;
  error_category?: string; // ser_estar, subjunctive, adj_placement, etc.
}

export interface Message {
  role: "user" | "ai";
  text?: string;
  d?: AIData;
  raw?: string;
  id: number;
  userMsgId?: number;
}

export interface CorrectionData {
  correction: string | null;
  correction_note: string | null;
  fp: number;
  pattern_name: string | null;
  pattern_formula?: string | null;
  flow_connector: string | null;
  flow_connector_meaning: string | null;
  new_vocab: VocabItem[];
  vibe: string | null;
  error_category?: string;
}

export interface Stats {
  msgs: number;
  corrections: number;
  fp: number;
  convos: number;
  shadowSessions: number;
  listenSessions: number;
  photoSessions: number;
  avgFluency: number;
}

export interface StreakData {
  count: number;
  date: string;
}

export interface ErrorPattern {
  category: string;
  label: string;
  count: number;
  total: number; // total opportunities
  rate: number; // error rate 0-1
  lastSeen: string;
  examples: { original: string; correction: string }[];
}

export interface ShadowResult {
  targetSentence: string;
  userTranscription: string;
  overallScore: number; // 0-100
  rhythmScore: number;
  stressScore: number;
  accuracyScore: number;
  feedback: string[];
  phonemeNotes: string[];
}

export interface ListenResult {
  targetSentence: string;
  userTranscription: string;
  score: number;
  missingWords: string[];
  extraWords: string[];
  feedback: string;
}

export interface DifficultyState {
  level: number; // 1-10
  recentScores: number[];
  adjustedAt: string;
}

export type TabId = "talk" | "shadow" | "listen" | "patterns" | "missions" | "vocab" | "progress" | "photo";

export interface CulturalBrief {
  id: string;
  title: string;
  duration: string;
  content: string[];
  tips: string[];
  warnings: string[];
}
