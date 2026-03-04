import {
  GeminiAnalysisPayload,
  RiskLevel,
  ScoredSignals,
  SignalKey,
  SignalScoreBreakdown
} from "../types/analysis.js";
import { clamp } from "../utils/text.js";

const RISK_LOW_MAX = 33;
const RISK_MEDIUM_MAX = 66;
const RISK_HIGH_MAX = 84;
const SIGNAL_SCORE_MULTIPLIER = 3.4;
const MIN_SCORE_WITH_PATTERN = 5;
const MIN_SCORE_WITH_REPEATED_PATTERN = 10;

const SIGNAL_WEIGHTS: Record<SignalKey, number> = {
  emotional_heat: 1.2,
  moral_outrage: 1.1,
  black_white: 1.0,
  us_them: 1.0,
  fight_picking: 0.9
};

const SCORE_ORDER: SignalKey[] = [
  "emotional_heat",
  "moral_outrage",
  "black_white",
  "us_them",
  "fight_picking"
];

const deriveRiskLevel = (score: number): RiskLevel => {
  if (score <= 5) {
    return "매우 낮음";
  }

  if (score > RISK_HIGH_MAX) {
    return "매우 높음";
  }

  if (score > RISK_MEDIUM_MAX) {
    return "높음";
  }

  if (score > RISK_LOW_MAX) {
    return "중간";
  }

  return "낮음";
};

const evidenceIntensityBoost = (evidence: string[]): number => {
  const corpus = evidence.join(" ").toLowerCase();
  if (!corpus.trim()) {
    return 0;
  }

  const strongMatches =
    (corpus.match(
      /(소름|생매장|피가\s*거꾸로|끔찍|충격|경악|악마|카르텔|위선|2차\s*가해|입\s*다물|망신|배신|분노|혐오|선동|가짜뉴스)/g
    )?.length ?? 0) * 5;
  const exclamationMatches = (corpus.match(/[!?]/g)?.length ?? 0) * 2;
  const quoteMatches = (corpus.match(/[“”"']/g)?.length ?? 0) * 0.5;

  return clamp(Math.round(strongMatches + exclamationMatches + quoteMatches), 0, 35);
};

const keywordHits = (text: string, patterns: RegExp[]): number =>
  patterns.reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0);

const semanticFloorBySignal = (
  signalKey: SignalKey,
  evidence: string[],
  patternCount: number,
  modelScore?: number
): number => {
  const corpus = evidence.join(" ").toLowerCase();
  if (!corpus.trim()) {
    return 0;
  }

  const signalPatterns: Record<SignalKey, RegExp[]> = {
    emotional_heat: [
      /소름/g,
      /충격/g,
      /경악/g,
      /끔찍/g,
      /피가\s*거꾸로/g,
      /생매장/g,
      /분노/g,
      /혐오/g
    ],
    moral_outrage: [
      /위선/g,
      /2차\s*가해/g,
      /피해자/g,
      /준엄/g,
      /비난/g,
      /악/g,
      /가해자/g,
      /정의/g
    ],
    black_white: [/항상/g, /절대/g, /무조건/g, /반드시/g, /아니면/g, /용서/g, /매장/g],
    us_them: [/우리/g, /그들/g, /진영/g, /카르텔/g, /좌파/g, /우파/g, /적/g],
    fight_picking: [
      /왜\?/g,
      /당장/g,
      /지금/g,
      /공유/g,
      /클릭/g,
      /입\s*다물/g,
      /논란/g,
      /뭇매/g
    ]
  };

  const hits = keywordHits(corpus, signalPatterns[signalKey]);
  const baseFloors: Record<SignalKey, number> = {
    emotional_heat: 35,
    moral_outrage: 35,
    black_white: 28,
    us_them: 24,
    fight_picking: 26
  };

  if (hits <= 0) {
    return 0;
  }

  const strongContext = patternCount >= 2 || (typeof modelScore === "number" && modelScore >= 30);
  if (!strongContext && hits < 2) {
    return 0;
  }

  return clamp(baseFloors[signalKey] + (hits - 1) * 6, 0, 85);
};

const scoreSignal = (
  signalKey: SignalKey,
  patternCount: number,
  sentenceCount: number,
  totalWordCount: number,
  contextualCorrection: number,
  weight: number,
  evidence: string[],
  modelScore?: number
): SignalScoreBreakdown => {
  const safeSentenceCount = Math.max(sentenceCount, 1);
  const safeWordCount = Math.max(totalWordCount, 1);
  const correction = clamp(contextualCorrection, 0, 0.3);

  const rawScore = (patternCount / safeSentenceCount) * weight;
  const normalizedScore = rawScore * (1000 / safeWordCount);

  // 짧은 글/반복 패턴은 같은 횟수여도 체감 강도가 커지므로 가중
  const repetitionRatio = patternCount / safeSentenceCount;
  const repetitionBoost = 1 + Math.min(repetitionRatio, 0.5) * 0.35;
  const shortTextBoost = safeWordCount < 220 ? 1 + ((220 - safeWordCount) / 220) * 0.2 : 1;
  const adjustedScore = normalizedScore * repetitionBoost * shortTextBoost * (1 - correction);

  let score = clamp(Math.round(adjustedScore * SIGNAL_SCORE_MULTIPLIER), 0, 100);

  if (typeof modelScore === "number" && Number.isFinite(modelScore)) {
    const densityFactor = clamp((patternCount * 140) / safeWordCount, 0.7, 1.15);
    const modelAdjusted = clamp(
      Math.round(clamp(modelScore, 0, 100) * densityFactor * (1 - correction * 0.5)),
      0,
      100
    );
    score = Math.max(score, modelAdjusted);
  } else {
    score = clamp(score + evidenceIntensityBoost(evidence), 0, 100);
  }

  score = Math.max(score, semanticFloorBySignal(signalKey, evidence, patternCount, modelScore));

  // 근거가 탐지됐는데 0점으로 보이는 불일치를 방지
  if (patternCount > 0 && score < MIN_SCORE_WITH_PATTERN) {
    score = MIN_SCORE_WITH_PATTERN;
  }

  if (patternCount >= 3 && score < MIN_SCORE_WITH_REPEATED_PATTERN) {
    score = MIN_SCORE_WITH_REPEATED_PATTERN;
  }

  if (patternCount === 0 && evidence.length === 0) {
    score = 0;
  }

  // 신호별 완충: 동일 pattern_count라도 신호 특성에 따라 과소평가되는 현상 보정
  if (patternCount >= 2 && score < 12) {
    const floorBySignal: Record<SignalKey, number> = {
      emotional_heat: 15,
      moral_outrage: 10,
      black_white: 10,
      us_them: 10,
      fight_picking: 10
    };
    score = Math.max(score, floorBySignal[signalKey]);
  }

  return {
    score,
    riskLevel: deriveRiskLevel(score),
    rawScore,
    normalizedScore,
    adjustedScore,
    weight,
    patternCount,
    contextualCorrection: correction,
    evidence
  };
};

export const computeScores = (
  analysis: GeminiAnalysisPayload,
  sentenceCount: number,
  totalWordCount: number
): ScoredSignals => {
  return {
    emotional_heat: scoreSignal(
      "emotional_heat",
      analysis.signals.emotional_heat.pattern_count,
      sentenceCount,
      totalWordCount,
      analysis.signals.emotional_heat.contextual_correction ?? 0,
      SIGNAL_WEIGHTS.emotional_heat,
      analysis.signals.emotional_heat.evidence,
      analysis.signals.emotional_heat.score
    ),
    moral_outrage: scoreSignal(
      "moral_outrage",
      analysis.signals.moral_outrage.pattern_count,
      sentenceCount,
      totalWordCount,
      analysis.signals.moral_outrage.contextual_correction ?? 0,
      SIGNAL_WEIGHTS.moral_outrage,
      analysis.signals.moral_outrage.evidence,
      analysis.signals.moral_outrage.score
    ),
    black_white: scoreSignal(
      "black_white",
      analysis.signals.black_white.pattern_count,
      sentenceCount,
      totalWordCount,
      analysis.signals.black_white.contextual_correction ?? 0,
      SIGNAL_WEIGHTS.black_white,
      analysis.signals.black_white.evidence,
      analysis.signals.black_white.score
    ),
    us_them: scoreSignal(
      "us_them",
      analysis.signals.us_them.pattern_count,
      sentenceCount,
      totalWordCount,
      analysis.signals.us_them.contextual_correction ?? 0,
      SIGNAL_WEIGHTS.us_them,
      analysis.signals.us_them.evidence,
      analysis.signals.us_them.score
    ),
    fight_picking: scoreSignal(
      "fight_picking",
      analysis.signals.fight_picking.pattern_count,
      sentenceCount,
      totalWordCount,
      analysis.signals.fight_picking.contextual_correction ?? 0,
      SIGNAL_WEIGHTS.fight_picking,
      analysis.signals.fight_picking.evidence,
      analysis.signals.fight_picking.score
    )
  };
};

export const computeCompositeScore = (scores: ScoredSignals, _density: number): number => {
  const weighted =
    scores.emotional_heat.score * 0.25 +
    scores.moral_outrage.score * 0.2 +
    scores.black_white.score * 0.2 +
    scores.us_them.score * 0.2 +
    scores.fight_picking.score * 0.15;

  return Number(clamp(weighted, 0, 100).toFixed(2));
};

export const deriveVerdict = (score: number): string => {
  if (score > RISK_MEDIUM_MAX) {
    return "정보 전달보다 감정 자극과 진영 대립을 우선하는 조작적 프레이밍 성향이 강합니다.";
  }

  if (score > RISK_LOW_MAX) {
    return "정보 전달과 프레이밍 자극이 혼재되어 있으며, 일부 구간에서 감정 유도 패턴이 반복됩니다.";
  }

  return "상대적으로 정보 전달 중심이며 조작적 프레이밍 신호는 제한적으로 관측됩니다.";
};
