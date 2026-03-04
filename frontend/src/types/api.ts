export interface AnalysisRecord {
  id: string;
  title: string;
  source_url: string | null;
  content: string;
  word_count: number;
  heat_score: number;
  outrage_score: number;
  bw_score: number;
  us_them_score: number;
  fight_score: number;
  total_score: number;
  density: number;
  verdict: string;
  created_at: string;
  core_facts?: string[];
  signal_details?: Record<string, SignalDetail>;
  left_focus?: string | null;
  right_focus?: string | null;
}

export interface SignalDetail {
  score: number;
  riskLevel: "매우 낮음" | "낮음" | "중간" | "높음" | "매우 높음";
  rawScore: number;
  normalizedScore: number;
  adjustedScore: number;
  weight: number;
  patternCount: number;
  contextualCorrection: number;
  evidence: string[];
}

export interface AnalysisDetails {
  core_facts: string[];
  signals: {
    emotional_heat: SignalDetail;
    moral_outrage: SignalDetail;
    black_white: SignalDetail;
    us_them: SignalDetail;
    fight_picking: SignalDetail;
  };
  clear_view: {
    left_focus: string | null;
    right_focus: string | null;
  };
}

export interface AnalysisResponse {
  analysis: AnalysisRecord;
  details: AnalysisDetails;
  disclaimer: string;
  attention_economy_note?: string;
  persisted?: boolean;
  warning?: string;
}

export interface AnalysesResponse {
  analyses: AnalysisRecord[];
  persisted?: boolean;
  warning?: string;
}

export interface LeaderboardResponse {
  leaderboard: Array<
    Pick<
      AnalysisRecord,
      | "id"
      | "title"
      | "source_url"
      | "total_score"
      | "density"
      | "heat_score"
      | "outrage_score"
      | "bw_score"
      | "us_them_score"
      | "fight_score"
      | "created_at"
    >
  >;
  persisted?: boolean;
  warning?: string;
}

export interface UsageResponse {
  current: number;
  max: number;
  remaining: number;
}
