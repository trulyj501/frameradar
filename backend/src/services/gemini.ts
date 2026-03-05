import { z } from "zod";
import { env } from "../lib/env.js";
import { GeminiAnalysisPayload, SignalKey } from "../types/analysis.js";
import { extractJsonObject } from "../utils/text.js";

const signalSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  pattern_count: z.number().int().min(0).max(999),
  contextual_correction: z.number().min(0).max(0.3).optional(),
  evidence: z.array(z.string()).default([])
});

const analysisSchema = z.object({
  core_facts: z.array(z.string()).min(2).max(4).default([]),
  signals: z.object({
    emotional_heat: signalSchema,
    moral_outrage: signalSchema,
    black_white: signalSchema,
    us_them: signalSchema,
    fight_picking: signalSchema
  }),
  clear_view: z
    .object({
      left_focus: z.string().optional(),
      right_focus: z.string().optional()
    })
    .optional(),
  verdict: z.string().default("")
});

const SYSTEM_PROMPT = `역할: 당신은 Attention Economy(관심 경제)의 역기능을 진단하는 RageCheck 분석가다.

분석 원칙:
- 사실 여부(Fact Check)를 판단하지 않는다.
- 언어적 프레이밍 패턴만 평가한다.
- 점수는 글 길이 대비 패턴 밀도를 반영한다.

5대 핵심 신호 (The 5 Signals):
콘텐츠를 다음 5가지 차원에서 분석하되, 글의 길이 대비 패턴의 밀도(Density)를 고려하여 0~100점으로 점수를 산정하라. (짧은 글에서 반복되면 가중치 부여)

[그룹 A: 구성 (Construction) - 콘텐츠가 어떻게 만들어졌는가]
1) emotional_heat (감정적 가열): 정보를 전달하기보다 공포, 분노, 혐오를 활성화하려는 수사법. (예: "충격", "경악", 과도한 문장부호, 대문자/볼드체 남발)
2) moral_outrage (도덕적 공분): 사안을 '선과 악'의 전쟁으로 묘사하며 도덕적 순결성을 강조하거나 상대를 '악'으로 규정하는 패턴.
3) black_white (흑백 논리): 복잡한 뉘앙스를 제거하고 "항상", "절대", "유일한" 등의 단어를 사용해 가짜 이분법을 제시하는 패턴.

[그룹 B: 전달 (Transmission) - 왜 확산되는가]
4) us_them (우리 vs 그들): 외부 집단을 비인간화(Dehumanization)하거나, 내부 결속을 위해 가상의 적을 설정하는 '부족주의적' 프레임.
5) fight_picking (싸움 걸기): "삭제되기 전에 공유", "눈이 있다면 봐라" 등 바이럴 확산을 강요하거나 정체성 신호(Identity Signaling)를 보내는 행위.

점수 일관성 규칙:
- 자극적/모욕적/도발적 표현이 반복될수록 score를 명확히 높여라.
- evidence가 강한데 score가 0~10이면 안 된다.

문맥 보정 규칙(contextual_correction):
단순 키워드 매칭의 오류를 피하기 위해 다음 상황에서는 점수를 하향 조정(Correction)하라.
- 인용(Quotes): 타인의 조작적 발언을 비판하거나 단순히 전달하기 위해 인용한 경우.
- 학술/분석: 극단주의나 선동 패턴을 연구/분석하는 맥락인 경우.
CLEAR_VIEW (두 가지 시선) 라벨링 규칙:
1. 기사의 주제를 먼저 판단하라.
   - 주제가 명확히 정치적 진영 대립(여당 vs 야당, 진보 정당 vs 보수 정당)인 경우에만 '[진보적 프레임]' / '[보수적 프레임]' 라벨을 사용한다.
2. 주제가 경제, 외교, 사회, 과학 등 비정치적이거나 진영 대립이 핵심이 아닌 경우에는 기사의 실제 논점을 반영한 중립적 라벨을 생성하라.
   - 예시: [위기 중심 프레임], [기회 중심 프레임], [단기 리스크 관점], [장기 관점], [규제 강화 관점], [시장 자율 관점]
3. 라벨은 반드시 기사의 실제 내용에서 도출해야 하며, 정치적 오해를 유발할 수 있는 표현은 피한다.
4. left_focus와 right_focus의 출력은 반드시 "[생성된 라벨] 상세 설명" 형태여야 한다. 라벨을 나타내는 대괄호가 가장 앞에 와야 한다.

CRITICAL LANGUAGE RULE:
- 모든 사람이 읽는 문자열 값은 반드시 한국어로 작성한다.
- JSON 키는 아래 스키마와 동일한 영어 키를 유지한다.

CRITICAL TONE RULE (종결어미 규칙):
- verdict 항목을 제외한 모든 문자열의 서술어는 반드시 '~음', '~함'과 같이 명사형 종결어미(음/슴체)로 끝내야 한다. (예: "불안감을 조성함", "대립 구도를 설정함")
- 절대 '~다', '~했다', '~한다' 등의 평서형 종결어미를 사용하지 마라.
- 단, verdict(종합 평결) 항목의 문장 종결은 반드시 합쇼체('~합니다', '~입니다')로 끝내야 한다. (예: "초점이 맞춰져 있습니다.", "드러납니다.")

반환 형식(JSON only):

{
  "core_facts": ["객관적 사실 1 (음/슴체 사용)", "객관적 사실 2 (음/슴체 사용)", "(필요시 최대 4개까지 추가)"],
  "signals": {
    "emotional_heat": { "score": 0, "pattern_count": 0, "contextual_correction": 0, "evidence": ["근거 문장 (음/슴체 사용)"] },
    "moral_outrage": { "score": 0, "pattern_count": 0, "contextual_correction": 0, "evidence": ["근거 문장 (음/슴체 사용)"] },
    "black_white": { "score": 0, "pattern_count": 0, "contextual_correction": 0, "evidence": ["근거 문장 (음/슴체 사용)"] },
    "us_them": { "score": 0, "pattern_count": 0, "contextual_correction": 0, "evidence": ["근거 문장 (음/슴체 사용)"] },
    "fight_picking": { "score": 0, "pattern_count": 0, "contextual_correction": 0, "evidence": ["근거 문장 (음/슴체 사용)"] }
  },
  "clear_view": {
    "left_focus": "[라벨명] 좌측 프레임 명시 (음/슴체 사용)",
    "right_focus": "[라벨명] 우측 프레임 명시 (음/슴체 사용)"
  },
  "verdict": "종합 소견 명시 (반드시 '~합니다', '~입니다'체 사용)"
}

출력 작성 지침:
- 모든 서술어는 반드시 '~음', '~함'과 같이 명사형 종결어미(음/슴체)를 사용한다. (예: "공포감을 조성함", "갈등을 유발함")
- 단, verdict(종합 평결) 항목의 문장 종결은 반드시 합쇼체('~합니다', '~입니다')를 사용한다.
- core_facts: 감정 표현을 제거한 건조한 사실 요약을 최소 2개 이상 최대 4개까지 작성
- evidence: 해당 신호를 뒷받침하는 설명 문장 1~2개 (필요시 원문 표현 인용 포함)
  - 한 항목은 120자 이내로 작성
  - 긴 본문을 통째로 복사하지 말 것
  - 신호마다 evidence 총 길이는 220자 이내를 권장
- score: 각 신호의 최종 위험도 점수(0~100, 밀도/반복/맥락 보정 반영)
- clear_view.left_focus/right_focus: 반드시 "[라벨] 설명" 형식으로 시작해야 하며 라벨링 규칙을 준수한다. 라벨명이 대괄호로 감싸져 문장 맨 앞에 와야 파싱이 가능하다.
- verdict: 정보 전달 중심인지, 감정 조작형 프레이밍 중심인지 종합 소견 ('~합니다'체 사용)
- pattern_count와 evidence 정합성 규칙:
  - pattern_count가 0이면 evidence는 반드시 빈 배열
  - pattern_count가 1 이상이면 evidence는 최소 1개 이상 작성
  - evidence가 1개 이상이면 pattern_count는 최소 1 이상
  - score가 0~5인데 evidence가 강한 표현을 포함하면 안 됨 (점수-근거 일관성 유지)

중립적이고 교육적인 톤을 유지한다.
반드시 유효한 JSON만 반환한다.`;

const buildUserPrompt = (articleText: string): string =>
  `다음 텍스트를 RageCheck 방법론으로 분석하라.\n\n${articleText}\n\nJSON 이외의 텍스트는 출력하지 마라.`;

const parseGeminiJson = (text: string): GeminiAnalysisPayload => {
  const parsedText = extractJsonObject(text);
  const data = JSON.parse(parsedText);
  const parsed = analysisSchema.parse(data);

  return parsed as GeminiAnalysisPayload;
};

const heuristicFallback = (text: string): GeminiAnalysisPayload => {
  const lower = text.toLowerCase();
  const keywordCount = (patterns: RegExp[]): number =>
    patterns.reduce((sum, pattern) => sum + (lower.match(pattern)?.length ?? 0), 0);

  const quoteAdjustment = Math.min((text.match(/"[^"]{20,}"/g)?.length ?? 0) * 0.05, 0.3);

  const counts: Record<SignalKey, number> = {
    emotional_heat: keywordCount([
      /outrage/g,
      /furious/g,
      /shocking/g,
      /disaster/g,
      /rage/g,
      /분노/g,
      /격분/g,
      /충격/g,
      /재앙/g
    ]),
    moral_outrage: keywordCount([
      /evil/g,
      /corrupt/g,
      /shame/g,
      /betrayal/g,
      /immoral/g,
      /부패/g,
      /악/g,
      /수치/g,
      /배신/g,
      /비도덕/g
    ]),
    black_white: keywordCount([
      /always/g,
      /never/g,
      /only choice/g,
      /everyone knows/g,
      /항상/g,
      /절대/g,
      /오직/g,
      /유일한 선택/g,
      /모두가 안다/g
    ]),
    us_them: keywordCount([
      /they/g,
      /us/g,
      /traitor/g,
      /enemy/g,
      /our side/g,
      /그들/g,
      /우리/g,
      /배신자/g,
      /적/g,
      /우리 편/g
    ]),
    fight_picking: keywordCount([
      /attack/g,
      /fight/g,
      /destroy/g,
      /take down/g,
      /crush/g,
      /공격/g,
      /싸움/g,
      /응징/g,
      /제거/g,
      /처단/g
    ])
  };

  return {
    core_facts: ["모델 응답 파싱 오류로 인해 임시 휴리스틱 분석 결과를 사용했습니다."],
    signals: {
      emotional_heat: {
        score: Math.min(100, counts.emotional_heat * 18),
        pattern_count: counts.emotional_heat,
        contextual_correction: quoteAdjustment,
        evidence: []
      },
      moral_outrage: {
        score: Math.min(100, counts.moral_outrage * 18),
        pattern_count: counts.moral_outrage,
        contextual_correction: quoteAdjustment,
        evidence: []
      },
      black_white: {
        score: Math.min(100, counts.black_white * 18),
        pattern_count: counts.black_white,
        contextual_correction: quoteAdjustment,
        evidence: []
      },
      us_them: {
        score: Math.min(100, counts.us_them * 18),
        pattern_count: counts.us_them,
        contextual_correction: quoteAdjustment,
        evidence: []
      },
      fight_picking: {
        score: Math.min(100, counts.fight_picking * 18),
        pattern_count: counts.fight_picking,
        contextual_correction: quoteAdjustment,
        evidence: []
      }
    },
    clear_view: {
      left_focus: "[구조적 책임 관점] 구조적 불평등과 제도적 책임을 강조하는 관점이 상대적으로 두드러집니다.",
      right_focus: "[개인 책임 관점] 개인 책임과 사회 질서 영향을 강조하는 관점이 상대적으로 두드러집니다."
    },
    verdict: "모델 해석이 완전하지 않아 휴리스틱 기반 추정 결과를 반환했습니다."
  };
};

export const runGeminiAnalysis = async (articleText: string): Promise<GeminiAnalysisPayload> => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(articleText)}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const modelText =
      payload.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")
        ?.text ?? "";

    if (!modelText.trim()) {
      throw new Error("Gemini returned an empty response");
    }

    return parseGeminiJson(modelText);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
    console.error(`Gemini analysis failed, using heuristic fallback: ${errorMessage}`);
    return heuristicFallback(articleText);
  }
};
