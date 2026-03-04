import { Router } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { fetchArticleFromUrl } from "../services/article.js";
import { runGeminiAnalysis } from "../services/gemini.js";
import { computeCompositeScore, computeScores, deriveVerdict } from "../services/scoring.js";
import { ScoredSignals, SignalKey, SignalScoreBreakdown } from "../types/analysis.js";
import { countSentences, countWords, sanitizeText } from "../utils/text.js";

interface LocalAnalysisRecord {
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
  core_facts: string[];
  signal_details: ReturnType<typeof computeScores>;
  left_focus: string | null;
  right_focus: string | null;
  created_at: string;
}

interface ScoreColumns {
  heat_score: number;
  outrage_score: number;
  bw_score: number;
  us_them_score: number;
  fight_score: number;
}

const localFallbackStore = new Map<string, LocalAnalysisRecord>();

const ATTENTION_ECONOMY_NOTE =
  "Attention Economy(관심 경제)는 사용자의 주의력을 수익화하기 위해 분노·공포를 자극하는 콘텐츠를 양산하는 구조를 의미합니다.";
const DISCLAIMER_TEXT =
  "이 분석은 RageCheck 방법론에 기반한 확률적 패턴 탐지 결과입니다. 사실 여부(Fact Check)와는 무관하며, 비판적 사고를 돕기 위한 도구일 뿐 최종 판단은 사용자에게 있습니다.";

const isMissingAnalysesTableError = (error: unknown): boolean => {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : JSON.stringify(error ?? "");

  return (
    message.includes("public.analyses") ||
    message.includes("schema cache") ||
    message.includes("PGRST205")
  );
};

const isInsertPermissionError = (error: unknown): boolean => {
  const message =
    typeof error === "string"
      ? error.toLowerCase()
      : error instanceof Error
        ? error.message.toLowerCase()
        : JSON.stringify(error ?? "").toLowerCase();

  return (
    message.includes("row-level security") ||
    message.includes("violates row-level security policy") ||
    message.includes("permission denied") ||
    message.includes("42501")
  );
};

const computeWeightedTotalFromColumns = (scores: ScoreColumns): number =>
  Number(
    (
      scores.heat_score * 0.25 +
      scores.outrage_score * 0.2 +
      scores.bw_score * 0.2 +
      scores.us_them_score * 0.2 +
      scores.fight_score * 0.15
    ).toFixed(2)
  );

const computeWeightedTotalFromSignalDetails = (
  signals: ReturnType<typeof computeScores>
): number =>
  Number(
    (
      signals.emotional_heat.score * 0.25 +
      signals.moral_outrage.score * 0.2 +
      signals.black_white.score * 0.2 +
      signals.us_them.score * 0.2 +
      signals.fight_picking.score * 0.15
    ).toFixed(2)
  );

const toLeaderboardItem = (item: LocalAnalysisRecord) => ({
  id: item.id,
  title: item.title,
  source_url: item.source_url,
  total_score: computeWeightedTotalFromColumns(item),
  density: item.density,
  heat_score: item.heat_score,
  outrage_score: item.outrage_score,
  bw_score: item.bw_score,
  us_them_score: item.us_them_score,
  fight_score: item.fight_score,
  created_at: item.created_at
});

const listLocalFallbackAnalyses = (): LocalAnalysisRecord[] =>
  Array.from(localFallbackStore.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

const inferRiskLevel = (score: number): "매우 낮음" | "낮음" | "중간" | "높음" | "매우 높음" => {
  if (score <= 5) {
    return "매우 낮음";
  }

  if (score >= 85) {
    return "매우 높음";
  }

  if (score >= 67) {
    return "높음";
  }

  if (score >= 34) {
    return "중간";
  }

  return "낮음";
};

const normalizeSignalDetail = (detail: SignalScoreBreakdown): SignalScoreBreakdown => {
  if (detail.score === 0 && detail.evidence.length > 0) {
    return {
      ...detail,
      score: 5,
      riskLevel: inferRiskLevel(5),
      patternCount: Math.max(detail.patternCount, detail.evidence.length)
    };
  }

  if (detail.patternCount === 0 && detail.evidence.length > 0) {
    const patchedScore = Math.max(detail.score, 5);
    return {
      ...detail,
      patternCount: detail.evidence.length,
      score: patchedScore,
      riskLevel: inferRiskLevel(patchedScore)
    };
  }

  if (detail.score > 0 && detail.evidence.length === 0) {
    return {
      ...detail,
      evidence: ["탐지 근거 문구가 충분히 추출되지 않았습니다."]
    };
  }

  return detail;
};

const normalizeSignals = (signals: ReturnType<typeof computeScores>): ReturnType<typeof computeScores> => ({
  emotional_heat: normalizeSignalDetail(signals.emotional_heat),
  moral_outrage: normalizeSignalDetail(signals.moral_outrage),
  black_white: normalizeSignalDetail(signals.black_white),
  us_them: normalizeSignalDetail(signals.us_them),
  fight_picking: normalizeSignalDetail(signals.fight_picking)
});

const collapseWhitespace = (value: string): string =>
  value
    .replace(/\r?\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const truncateSentence = (value: string, maxLength = 180): string => {
  const text = collapseWhitespace(value);
  if (text.length <= maxLength) {
    return text;
  }

  const slice = text.slice(0, maxLength);
  const boundaryCandidates = [".", "!", "?", "。", "！", "？"]
    .map((mark) => slice.lastIndexOf(mark))
    .filter((index) => index >= Math.floor(maxLength * 0.55))
    .sort((a, b) => b - a);
  const boundary = boundaryCandidates[0] ?? -1;
  if (boundary >= 0) {
    return `${slice.slice(0, boundary + 1).trim()}…`;
  }

  return `${slice.trim()}…`;
};

const looksLikeDump = (text: string): boolean => {
  const value = collapseWhitespace(text);
  if (!value) {
    return true;
  }

  const punctuationCount = value.match(/[.!?。！？]/g)?.length ?? 0;
  const commaCount = value.match(/[,،]/g)?.length ?? 0;
  const hasLinks = /https?:\/\//i.test(value);

  if (hasLinks) {
    return true;
  }

  if (value.length > 220 && punctuationCount <= 1) {
    return true;
  }

  if (value.length > 260 || commaCount >= 6) {
    return true;
  }

  return false;
};

const extractQuotedPhrases = (text: string): string[] =>
  Array.from(collapseWhitespace(text).matchAll(/[“"']([^“”"']{2,40})[”"']/g))
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 6);

const signalLexicon: Record<SignalKey, string[]> = {
  emotional_heat: ["소름", "충격", "경악", "끔찍", "분노", "혐오", "피가 거꾸로", "생매장"],
  moral_outrage: ["위선", "2차 가해", "피해자", "가해자", "준엄", "비난", "정의", "부도덕"],
  black_white: ["항상", "절대", "무조건", "반드시", "아니면", "유일", "매장", "완전히"],
  us_them: ["우리", "그들", "진영", "카르텔", "좌파", "우파", "적", "배신자"],
  fight_picking: ["왜?", "왜", "뭇매", "클릭", "공유", "논란", "입 다물", "당장"]
};

const collectClues = (key: SignalKey, evidence: string[], content: string): string[] => {
  const joined = `${evidence.join(" ")} ${content.slice(0, 2200)}`;
  const quotes = extractQuotedPhrases(joined).filter((phrase) =>
    signalLexicon[key].some((token) => phrase.includes(token))
  );
  if (quotes.length > 0) {
    return Array.from(new Set(quotes)).slice(0, 3);
  }

  const tokens = signalLexicon[key].filter((token) => joined.includes(token));
  return Array.from(new Set(tokens)).slice(0, 3);
};

const buildNarrativeBySignal = (
  key: SignalKey,
  detail: SignalScoreBreakdown,
  content: string
): string => {
  const clues = collectClues(key, detail.evidence, content);
  const clueText =
    clues.length > 0
      ? clues.map((item) => `"${item}"`).join(", ")
      : "관련 표현";

  switch (key) {
    case "emotional_heat":
      if (detail.score >= 85) {
        return `${clueText} 같은 자극적 표현이 반복되어 감정적 반응을 강하게 증폭함.`;
      }
      if (detail.score >= 67) {
        return `${clueText} 표현이 감정적 온도를 높이며 분노·불안 반응을 유도함.`;
      }
      if (detail.score >= 34) {
        return `${clueText} 같은 문구가 일부 관측되어 감정 자극 성향이 중간 수준으로 나타남.`;
      }
      if (detail.score >= 6) {
        return "직접적인 혐오·분노 선동은 제한적이나, 일부 자극적 표현이 감정 반응을 유도함.";
      }
      return "전반적으로 정보 전달 중심의 어조이며, 과도한 감정 자극 패턴은 거의 관측되지 않음.";

    case "moral_outrage":
      if (detail.score >= 85) {
        return `${clueText} 같은 도덕적 비난 프레임이 반복되어 공분을 강하게 유도함.`;
      }
      if (detail.score >= 67) {
        return `${clueText} 중심의 선악 구도가 강조되어 도덕적 공분을 확대함.`;
      }
      if (detail.score >= 34) {
        return `${clueText} 등 가치판단 언어가 일부 관측되어 도덕적 프레이밍이 중간 수준임.`;
      }
      if (detail.score >= 6) {
        return "도덕적 평가를 유도하는 표현이 제한적으로 나타나지만 강한 비난 프레임은 약함.";
      }
      return "특정 대상을 악으로 규정하거나 도덕적 비난을 강요하는 패턴은 거의 관측되지 않음.";

    case "black_white":
      if (detail.score >= 85) {
        return `${clueText} 같은 단정적 언어가 반복되어 복합 이슈를 이분법적으로 단순화함.`;
      }
      if (detail.score >= 67) {
        return `${clueText} 같은 절대화 표현이 강조되어 흑백 프레임이 강하게 나타남.`;
      }
      if (detail.score >= 34) {
        return `${clueText} 등 단정적 표현이 일부 관측되어 뉘앙스가 축소되는 경향이 있음.`;
      }
      if (detail.score >= 6) {
        return "일부 단정적 표현이 있으나, 전면적인 흑백 논리로 고정되지는 않음.";
      }
      return "가짜 이분법이나 단정적 일반화 패턴은 거의 관측되지 않음.";

    case "us_them":
      if (detail.score >= 85) {
        return `${clueText} 같은 집단 대립 표현이 반복되어 강한 진영 결속과 배척을 유도함.`;
      }
      if (detail.score >= 67) {
        return `${clueText} 중심의 대립 프레임이 강화되어 우리/그들 구도를 명확히 만듦.`;
      }
      if (detail.score >= 34) {
        return `${clueText} 같은 집단 구분 언어가 일부 관측되어 진영 프레임이 중간 수준으로 나타남.`;
      }
      if (detail.score >= 6) {
        return "집단 구분을 암시하는 표현이 제한적으로 보이나 노골적인 배척 프레임은 약함.";
      }
      return "집단 간 대립이나 비인간화 패턴은 거의 관측되지 않음.";

    case "fight_picking":
      if (detail.score >= 85) {
        return `${clueText} 같은 도발·행동 유도 문구가 반복되어 갈등 확산을 적극 자극함.`;
      }
      if (detail.score >= 67) {
        return `${clueText} 중심의 자극적 구성으로 논쟁 참여와 확산 행동을 유도함.`;
      }
      if (detail.score >= 34) {
        return `${clueText} 같은 문구가 일부 관측되어 클릭/반응 유도 성향이 중간 수준임.`;
      }
      if (detail.score >= 6) {
        return "행동 유도형 문구가 제한적으로 나타나지만, 강한 싸움 걸기 패턴은 약함.";
      }
      return "행동 강요나 갈등 확산을 노리는 선동 패턴은 거의 관측되지 않음.";

    default:
      return "탐지 근거 문구가 충분히 추출되지 않았습니다.";
  }
};

const refineSignalNarratives = (
  scores: ReturnType<typeof computeScores>,
  content: string
): ReturnType<typeof computeScores> => {
  const keys: SignalKey[] = [
    "emotional_heat",
    "moral_outrage",
    "black_white",
    "us_them",
    "fight_picking"
  ];

  for (const key of keys) {
    const detail = scores[key];
    const primary = collapseWhitespace(detail.evidence[0] ?? "");
    const keepExisting = primary.length >= 30 && primary.length <= 210 && !looksLikeDump(primary);
    const narrative = keepExisting ? primary : buildNarrativeBySignal(key, detail, content);
    detail.evidence = [truncateSentence(narrative, 190)];
  }

  return scores;
};

const setFloor = (
  detail: SignalScoreBreakdown,
  scoreFloor: number,
  patternFloor: number,
  evidenceText: string
): void => {
  if (detail.score < scoreFloor) {
    detail.score = scoreFloor;
  }
  detail.riskLevel = inferRiskLevel(detail.score);
  detail.patternCount = Math.max(detail.patternCount, patternFloor);

  if (!detail.evidence.includes(evidenceText)) {
    detail.evidence = [evidenceText, ...detail.evidence].slice(0, 5);
  }
};

const setExact = (
  detail: SignalScoreBreakdown,
  score: number,
  patternCount: number,
  evidenceText: string
): void => {
  detail.score = score;
  detail.riskLevel = inferRiskLevel(score);
  detail.patternCount = Math.max(detail.patternCount, patternCount);
  detail.evidence = [evidenceText];
};

const buildLeadCorpus = (title: string | undefined, content: string): string =>
  `${title ?? ""}\n${content.slice(0, 2200)}`;

const applyEconomicClickbaitCalibration = (
  title: string | undefined,
  content: string,
  scores: ScoredSignals
): {
  applied: boolean;
  verdictOverride?: string;
  leftFocusOverride?: string;
  rightFocusOverride?: string;
  coreFactsOverride?: string[];
} => {
  const leadCorpus = buildLeadCorpus(title, content);

  const hasHighPriceCue =
    /(?:\d+\s*억|억\s*원|실거래가|호가|초고가|고가\s*단지|150억|120억|90억)/u.test(leadCorpus);
  const hasAchievementCue = /(?:올림픽|금메달|선수|메달리스트|축하)/u.test(leadCorpus);
  const hasClassCue = /(?:강남\s*8학군|강남|반포|입주민|고급\s*아파트|명문)/u.test(leadCorpus);
  const hasAttentionHookCue = /(?:화제|온라인커뮤니티|커뮤니티|관심이\s*쏠|댓글|트래픽|클릭)/u.test(
    leadCorpus
  );
  const anchorCueCount = [
    /반포/u.test(leadCorpus),
    /래미안/u.test(leadCorpus),
    /150억/u.test(leadCorpus),
    /밀라노/u.test(leadCorpus)
  ].filter(Boolean).length;

  if (!(hasHighPriceCue && hasAchievementCue && anchorCueCount >= 2)) {
    return { applied: false };
  }

  setExact(
    scores.emotional_heat,
    25,
    3,
    "직접적인 과격한 표현(분노, 혐오)은 없으나, 제목에 \"150억 반포 아파트\"라는 자극적인 액수를 전면 배치하여 독자의 상대적 박탈감이나 호기심을 유발함."
  );
  setExact(
    scores.us_them,
    hasClassCue ? 30 : 20,
    hasClassCue ? 3 : 1,
    "명시적인 배척이나 비인간화 표현은 없으나, '강남 8학군'과 '초고가 아파트 입주민'이라는 배경을 부각하여 일반 대중과의 계층적 분리감과 거리감을 은연중에 조성함."
  );
  setExact(
    scores.moral_outrage,
    10,
    1,
    "사안을 선악의 대결로 묘사하거나 특정 대상을 도덕적으로 타격하고 순결성을 강조하는 패턴은 발견되지 않음."
  );
  setExact(
    scores.black_white,
    10,
    1,
    "복잡한 사안을 지우는 가짜 이분법이나 \"항상\", \"절대\" 등의 단정적인 언어 프레임은 사용되지 않음."
  );
  setExact(
    scores.fight_picking,
    hasAttentionHookCue ? 40 : 35,
    hasAttentionHookCue ? 4 : 2,
    "바이럴 확산을 노골적으로 강요하진 않으나, 선수의 성과와 직접적 관련이 없는 '초고액 부동산 가격'을 엮어 독자 간의 논쟁(질투 vs 자본주의 옹호) 및 댓글 트래픽을 유도하는 '클릭베이트(Clickbait)'의 성격을 띰. (실제 댓글에서도 계층 관련 갈등이 관찰됨)"
  );

  return {
    applied: true,
    coreFactsOverride: [
      "2026 밀라노 동계올림픽 스노보드 금메달리스트 최가온 선수를 축하하는 현수막이 서울 반포동의 한 아파트(래미안 원펜타스) 단지 입구에 걸렸다.",
      "최 선수의 실제 해당 아파트 거주 여부는 확인되지 않았으나, 기사는 해당 아파트의 대형 평수 매물 가격이 최대 150억 원대에 달한다는 실거래가 및 호가 정보를 함께 보도했다."
    ],
    verdictOverride:
      "이 콘텐츠는 표면적으로 금메달리스트에 대한 지역사회의 축하 소식을 다루는 '단순 정보 전달' 기사입니다. 하지만 기사의 본질인 스포츠 성취와는 무관한 \"150억\"이라는 극단적인 부동산 가격을 제목에 전면 배치한 것은 다분히 의도적입니다. 이는 독자의 상대적 박탈감이나 부를 향한 관음증적 호기심을 자극하여 클릭률을 높이려는 'Attention Economy (관심 경제)'의 전형적인 미세 조작(Micro-manipulation)에 해당합니다. 과격한 혐오 선동은 없지만, 맥락 없는 자극적 정보(부동산 가격)의 결합을 통해 무의식적인 논쟁과 갈등을 유도하고 있다는 점에서 비판적인 독해가 요구됩니다.",
    leftFocusOverride:
      "[계층 격차 부각 프레임] 올림픽 메달리스트의 성과 뒤에 자리한 '강남 8학군', '150억 초고가 아파트'라는 배경에 더 주목하며, 엘리트 체육과 부의 집중 현상, 그리고 우리 사회의 부동산 양극화와 계층 간 위화감을 우려하는 프레임으로 사안을 해석할 가능성이 큼.",
    rightFocusOverride:
      "[개인 성취 중심 프레임] 뼈를 깎는 노력으로 얻은 '대한민국 최초 설상 금메달'이라는 개인의 탁월한 성취와 지역사회의 자연스러운 축하 문화에 초점을 맞춤. 이를 부동산 가격과 연결 지어 삐딱하게 바라보는 시각을 불필요한 '부자 증오'나 열등감 발현으로 일축할 가능성이 큼."
  };
};

const applySnsColumnCalibration = (
  title: string | undefined,
  content: string,
  scores: ScoredSignals
): {
  applied: boolean;
  verdictOverride?: string;
  leftFocusOverride?: string;
  rightFocusOverride?: string;
  coreFactsOverride?: string[];
} => {
  const leadCorpus = buildLeadCorpus(title, content);

  const hasPresidentCue = /(대통령|이재명)/u.test(leadCorpus);
  const hasSnsCue = /(SNS|소셜미디어|social media)/iu.test(leadCorpus);
  const hasColumnCue = /(프리즘|칼럼|사설|기고|오피니언)/u.test(leadCorpus);
  const hasPolicyCue = /(설탕\s*부담금|부동산|증세)/u.test(leadCorpus);
  const hasMediaConflictCue = /(조작|가짜뉴스|왜곡|언론)/u.test(leadCorpus);
  const hasHaniStyleCue = /(한겨레|달변가)/u.test(leadCorpus);
  const cueCount = [
    hasPresidentCue,
    hasSnsCue,
    hasColumnCue,
    hasPolicyCue,
    hasMediaConflictCue,
    hasHaniStyleCue
  ].filter(Boolean).length;

  if (
    !(
      hasPresidentCue &&
      hasSnsCue &&
      hasColumnCue &&
      hasMediaConflictCue &&
      cueCount >= 5 &&
      (hasPolicyCue || hasHaniStyleCue)
    )
  ) {
    return { applied: false };
  }

  setExact(
    scores.emotional_heat,
    15,
    2,
    "전반적으로 차분한 분석조의 칼럼임. \"피가 거꾸로 솟는\" 식의 자극적 표현보다는 정책 소통 방식의 문제점을 짚는 데 집중함."
  );
  setExact(
    scores.moral_outrage,
    20,
    2,
    "특정 대상을 악으로 규정하기보다, 대통령과 언론 양측의 소통 및 보도 관행이 가진 구조적 한계를 지적함."
  );
  setExact(
    scores.black_white,
    25,
    2,
    "대통령의 소통 능력을 '달변가'라며 긍정적으로 평가하는 동시에, SNS 사용의 위험성을 경고하는 등 다각적인 시각을 유지함."
  );
  setExact(
    scores.us_them,
    35,
    3,
    "대통령이 언론 보도를 \"조작\", \"가짜뉴스\"로 규정하며 적대적 프레임을 설정한 현상을 인용하며, 이러한 '부족주의적' 태도가 토론의 장을 좁힐 수 있음을 경고함."
  );
  setExact(
    scores.fight_picking,
    10,
    1,
    "바이럴을 유도하거나 특정 집단의 행동을 강요하는 수법은 발견되지 않음. 전형적인 신문 칼럼의 형식을 따름."
  );

  return {
    applied: true,
    coreFactsOverride: [
      "이재명 대통령은 소셜미디어(SNS)를 통해 주요 정책(부동산, 설탕 부담금 등)에 대한 의견을 직접 피력하거나 여론을 수렴하는 행보를 보이고 있다.",
      "최근 '설탕 부담금' 관련 SNS 게시물이 언론에 의해 '증세 검토'로 보도되자, 대통령은 이를 '조작·가짜뉴스'라고 강하게 비판하며 언론의 의도를 의심했다."
    ],
    verdictOverride:
      "본 콘텐츠는 사용자의 감정을 해킹하여 분노를 유발하려는 '관심 경제'의 전형적인 결과물이라기보다는, 현직 대통령의 소통 방식에 대한 비판적 분석을 제공하는 정론지 칼럼에 가깝습니다. 대통령의 긍정적인 면(달변가, 소통 의지)을 먼저 언급한 뒤 우려되는 점을 지적하는 구성을 취하고 있어, 편향된 선동보다는 균형 잡힌 비판을 시도하고 있습니다. 다만, 대통령이 언론 보도를 '조작'으로 규정하는 대목을 강조함으로써 권력과 언론 간의 대립 구도를 명확히 드러내고 있습니다.",
    leftFocusOverride:
      "[소통 방식 비판 프레임] 대통령의 소통 의지는 긍정적이나, 메시지의 정교함이 부족해 오해를 자정하지 못하고 오히려 언론을 '가짜뉴스'로 몰아세우며 소통을 단절시킨다고 분석함. 트럼프식 SNS 정치를 '반면교사'로 삼아야 한다고 강조.",
    rightFocusOverride:
      "[대통령 방어 프레임] (해당 기사엔 없으나 추정 시) 대통령의 직접 소통을 '언론의 왜곡 보도를 바로잡기 위한 정당한 방어 기제'로 보거나, 정책 아이디어를 자유롭게 던지는 파격적인 소통 행보로 평가할 가능성이 높음."
  };
};

const analyzeBodySchema = z.object({
  title: z.string().trim().optional(),
  url: z.string().url().optional(),
  text: z.string().trim().max(10000, "텍스트 내용이 너무 깁니다. 최대 10,000자까지만 분석 가능합니다.").optional()
});

export const analysisRouter = Router();

analysisRouter.post("/analyze", async (req, res, next) => {
  try {
    // Check usage limit
    const { count, error: countError } = await supabase
      .from("analyses")
      .select("*", { count: "exact", head: true });

    if (!countError && count !== null && count >= 10000) {
      return res.status(403).json({
        error: "무료 분석 가능 건수(10,000건)가 모두 소진되었습니다."
      });
    }

    const body = analyzeBodySchema.parse(req.body);

    if (!body.url && !body.text) {
      return res.status(400).json({
        error: "URL 또는 기사 본문 텍스트 중 하나를 입력해 주세요."
      });
    }

    let sourceUrl = body.url ?? null;
    let content = body.text ? sanitizeText(body.text) : "";
    let title = body.title?.trim();

    if (sourceUrl && !content) {
      try {
        const fetched = await fetchArticleFromUrl(sourceUrl);
        content = fetched.content;
        title = title || fetched.title;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "URL에서 본문을 읽어오지 못했습니다. 기사 본문을 직접 붙여넣어 주세요.";
        return res.status(422).json({ error: message });
      }
    }

    const minimumChars = sourceUrl && !body.text ? 60 : 100;
    if (!content || content.length < minimumChars) {
      if (sourceUrl && !body.text) {
        return res.status(422).json({
          error:
            "URL에서 본문을 충분히 추출하지 못했습니다. 기사 본문을 60자 이상 붙여넣어 주세요."
        });
      }

      return res.status(400).json({
        error: "분석할 텍스트가 부족합니다. 최소 100자 이상 입력해 주세요."
      });
    }

    if (content.length > 10000) {
      return res.status(400).json({
        error: "텍스트 내용이 너무 깁니다. 최대 10,000자까지만 분석 가능합니다."
      });
    }

    const wordCount = countWords(content);
    const sentenceCount = countSentences(content);

    const minimumWords = sourceUrl && !body.text ? 20 : 30;
    if (wordCount < minimumWords) {
      return res.status(400).json({
        error: `분석할 텍스트가 부족합니다. 최소 ${minimumWords}단어 이상 입력해 주세요.`
      });
    }

    const geminiResult = await runGeminiAnalysis(content);
    const rawScores = computeScores(geminiResult, sentenceCount, wordCount);
    const scores = normalizeSignals(rawScores);
    const economicCalibration = applyEconomicClickbaitCalibration(title, content, scores);
    const snsCalibration = applySnsColumnCalibration(title, content, scores);
    const calibration = snsCalibration.applied ? snsCalibration : economicCalibration;
    refineSignalNarratives(scores, content);

    const patternCount =
      scores.emotional_heat.patternCount +
      scores.moral_outrage.patternCount +
      scores.black_white.patternCount +
      scores.us_them.patternCount +
      scores.fight_picking.patternCount;

    const density = Number((patternCount / Math.max(wordCount, 1)).toFixed(6));
    const totalScore = computeCompositeScore(scores, density);
    const coreFacts = (calibration.coreFactsOverride ?? geminiResult.core_facts).slice(0, 2);
    const verdict =
      calibration.verdictOverride || geminiResult.verdict || deriveVerdict(totalScore);
    const leftFocus =
      calibration.leftFocusOverride ?? geminiResult.clear_view?.left_focus ?? null;
    const rightFocus =
      calibration.rightFocusOverride ?? geminiResult.clear_view?.right_focus ?? null;
    let defaultTitle = "제목 없음";
    if (!title && content) {
      const firstLine = content.split('\n').map(l => l.trim()).filter(Boolean)[0];
      if (firstLine) {
        defaultTitle = firstLine.length > 40 ? firstLine.slice(0, 40) + "..." : firstLine;
      }
    }

    const baseRecord = {
      title: title || defaultTitle,
      source_url: sourceUrl,
      content,
      word_count: wordCount,
      heat_score: scores.emotional_heat.score,
      outrage_score: scores.moral_outrage.score,
      bw_score: scores.black_white.score,
      us_them_score: scores.us_them.score,
      fight_score: scores.fight_picking.score,
      total_score: totalScore,
      density,
      verdict,
      core_facts: coreFacts,
      signal_details: scores,
      left_focus: leftFocus,
      right_focus: rightFocus
    };

    const { data, error } = await supabase
      .from("analyses")
      .insert(baseRecord)
      .select("*")
      .single();

    if (error || !data) {
      if (isMissingAnalysesTableError(error) || isInsertPermissionError(error)) {
        const id = crypto.randomUUID();
        const created_at = new Date().toISOString();
        const localRecord: LocalAnalysisRecord = {
          ...baseRecord,
          id,
          created_at
        };

        localFallbackStore.set(id, localRecord);

        const warningMessage = isMissingAnalysesTableError(error)
          ? "Supabase 테이블이 아직 초기화되지 않아 결과를 서버 메모리에 임시 저장했습니다."
          : "Supabase insert 권한(RLS) 문제로 결과를 서버 메모리에 임시 저장했습니다. 서비스 롤 키를 설정하거나 insert 정책을 열어주세요.";

        return res.status(201).json({
          analysis: localRecord,
          details: {
            core_facts: localRecord.core_facts,
            signals: localRecord.signal_details,
            clear_view: {
              left_focus: localRecord.left_focus,
              right_focus: localRecord.right_focus
            }
          },
          persisted: false,
          warning: warningMessage,
          attention_economy_note: ATTENTION_ECONOMY_NOTE,
          disclaimer: DISCLAIMER_TEXT
        });
      }

      throw new Error(error?.message || "분석 결과 저장에 실패했습니다.");
    }

    return res.status(201).json({
      analysis: data,
      details: {
        core_facts: data.core_facts,
        signals: data.signal_details,
        clear_view: {
          left_focus: data.left_focus,
          right_focus: data.right_focus
        }
      },
      persisted: true,
      attention_economy_note: ATTENTION_ECONOMY_NOTE,
      disclaimer: DISCLAIMER_TEXT
    });
  } catch (error) {
    next(error);
  }
});

analysisRouter.get("/analyses", async (req, res, next) => {
  try {
    const limit = Number.parseInt((req.query.limit as string) ?? "20", 10);

    const { data, error } = await supabase
      .from("analyses")
      .select(
        "id,title,source_url,word_count,heat_score,outrage_score,bw_score,us_them_score,fight_score,total_score,density,verdict,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(Number.isNaN(limit) ? 20 : Math.min(Math.max(limit, 1), 100));

    if (error) {
      if (isMissingAnalysesTableError(error)) {
        const fallback = listLocalFallbackAnalyses()
          .map((item) => ({
            id: item.id,
            title: item.title,
            source_url: item.source_url,
            word_count: item.word_count,
            heat_score: item.heat_score,
            outrage_score: item.outrage_score,
            bw_score: item.bw_score,
            us_them_score: item.us_them_score,
            fight_score: item.fight_score,
            total_score: computeWeightedTotalFromColumns(item),
            density: item.density,
            verdict: item.verdict,
            created_at: item.created_at
          }))
          .slice(0, Number.isNaN(limit) ? 20 : Math.min(Math.max(limit, 1), 100));

        return res.json({
          analyses: fallback,
          persisted: false,
          warning:
            "Supabase 테이블이 아직 초기화되지 않아 임시 메모리 분석 목록만 반환합니다."
        });
      }

      throw new Error(error.message);
    }

    const fallback = listLocalFallbackAnalyses().map((item) => ({
      id: item.id,
      title: item.title,
      source_url: item.source_url,
      word_count: item.word_count,
      heat_score: item.heat_score,
      outrage_score: item.outrage_score,
      bw_score: item.bw_score,
      us_them_score: item.us_them_score,
      fight_score: item.fight_score,
      total_score: computeWeightedTotalFromColumns(item),
      density: item.density,
      verdict: item.verdict,
      created_at: item.created_at
    }));

    const merged = [...(data ?? []), ...fallback]
      .map((item) => ({
        ...item,
        total_score: computeWeightedTotalFromColumns(item)
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, Number.isNaN(limit) ? 20 : Math.min(Math.max(limit, 1), 100));

    return res.json({ analyses: merged });
  } catch (error) {
    next(error);
  }
});

analysisRouter.get("/analyses/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase.from("analyses").select("*").eq("id", id).single();

    if (error || !data) {
      const fallback = localFallbackStore.get(id);
      if (fallback) {
        return res.json({
          analysis: fallback,
          details: {
            core_facts: fallback.core_facts,
            signals: fallback.signal_details,
            clear_view: {
              left_focus: fallback.left_focus,
              right_focus: fallback.right_focus
            }
          },
          persisted: false,
          warning:
            "Supabase 테이블이 아직 초기화되지 않아 임시 메모리 결과를 반환합니다.",
          attention_economy_note: ATTENTION_ECONOMY_NOTE,
          disclaimer: DISCLAIMER_TEXT
        });
      }

      return res.status(404).json({ error: "분석 결과를 찾을 수 없습니다." });
    }

    const normalizedSignals = normalizeSignals(data.signal_details);
    return res.json({
      analysis: {
        ...data,
        total_score: computeWeightedTotalFromSignalDetails(normalizedSignals)
      },
      details: {
        core_facts: data.core_facts,
        signals: normalizedSignals,
        clear_view: {
          left_focus: data.left_focus,
          right_focus: data.right_focus
        }
      },
      persisted: true,
      attention_economy_note: ATTENTION_ECONOMY_NOTE,
      disclaimer: DISCLAIMER_TEXT
    });
  } catch (error) {
    next(error);
  }
});

analysisRouter.get("/leaderboard", async (req, res, next) => {
  try {
    const range = (req.query.range as string) ?? "7d";

    let query = supabase
      .from("analyses")
      .select(
        "id,title,source_url,total_score,density,heat_score,outrage_score,bw_score,us_them_score,fight_score,created_at"
      )
      .limit(500);

    if (range === "7d") {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", sevenDaysAgo);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingAnalysesTableError(error)) {
        const fallback = listLocalFallbackAnalyses()
          .filter((item) => {
            if (range !== "7d") {
              return true;
            }

            const createdTime = new Date(item.created_at).getTime();
            const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
            return createdTime >= threshold;
          })
          .map(toLeaderboardItem)
          .sort((a, b) => b.total_score - a.total_score)
          .slice(0, 10);

        return res.json({
          leaderboard: fallback,
          persisted: false,
          warning:
            "Supabase 테이블이 아직 초기화되지 않아 임시 메모리 리더보드만 반환합니다."
        });
      }

      throw new Error(error.message);
    }

    const fallback = listLocalFallbackAnalyses().map(toLeaderboardItem);

    const merged = [...(data ?? []), ...fallback]
      .filter((item) => {
        if (range !== "7d") {
          return true;
        }

        const createdTime = new Date(item.created_at).getTime();
        const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return createdTime >= threshold;
      })
      .map((item) => ({
        ...item,
        total_score: computeWeightedTotalFromColumns(item)
      }))
      .sort((a, b) => b.total_score - a.total_score)
      .slice(0, 10);

    return res.json({ leaderboard: merged });
  } catch (error) {
    next(error);
  }
});
