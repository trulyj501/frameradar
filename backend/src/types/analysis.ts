export type SignalKey =
  | "emotional_heat"
  | "moral_outrage"
  | "black_white"
  | "us_them"
  | "fight_picking";

export type RiskLevel = "매우 낮음" | "낮음" | "중간" | "높음" | "매우 높음";

export interface GeminiSignalPayload {
  score?: number;
  pattern_count: number;
  contextual_correction?: number;
  evidence: string[];
}

export interface GeminiAnalysisPayload {
  core_facts: string[];
  signals: Record<SignalKey, GeminiSignalPayload>;
  verdict: string;
  clear_view?: {
    left_focus?: string;
    right_focus?: string;
  };
}

export interface SignalScoreBreakdown {
  score: number;
  riskLevel: RiskLevel;
  rawScore: number;
  normalizedScore: number;
  adjustedScore: number;
  weight: number;
  patternCount: number;
  contextualCorrection: number;
  evidence: string[];
}

export interface ScoredSignals {
  emotional_heat: SignalScoreBreakdown;
  moral_outrage: SignalScoreBreakdown;
  black_white: SignalScoreBreakdown;
  us_them: SignalScoreBreakdown;
  fight_picking: SignalScoreBreakdown;
}
