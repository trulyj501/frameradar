import { AlertCircle, ChevronLeft, Search, Share2, Sparkles, AlertTriangle } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAnalysisById } from "../services/api";
import { AnalysisResponse } from "../types/api";
import { decodeHtmlEntities } from "../utils/html";

const parseFocusText = (text: string, defaultLabel: string): { label: string; description: string } => {
  if (!text) return { label: defaultLabel, description: "분석 결과가 없습니다." };

  const match = text.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) {
    return { label: match[1].trim(), description: match[2].trim() };
  }
  return { label: defaultLabel, description: text };
};

const signalMeta: Array<{
  key: keyof AnalysisResponse["details"]["signals"];
  title: string;
  short: string;
  color: string;
  description: string;
}> = [
    { key: "emotional_heat", title: "🔥 감정적 가열", short: "감정적 가열", color: "#f59e0b", description: "공포, 분노, 혐오 등 강한 정서를 자극하여 이성적 판단을 흐리게 만드는 수사법입니다." },
    { key: "moral_outrage", title: "⚖️ 도덕적 공분", short: "도덕적 공분", color: "#22c55e", description: "사안의 복잡한 맥락을 생략하고, 선과 악의 전쟁 구도로 묘사하여 도덕적 비난을 유도하는 패턴입니다." },
    { key: "black_white", title: "⬛ 흑백 논리", short: "흑백 논리", color: "#fbbf24", description: "중간 지대나 다양한 대안을 배제하고, 현실을 극단적인 이분법으로 단순화하여 제시하는 방식입니다." },
    { key: "us_them", title: "🆚 우리 vs 그들", short: "우리 vs 그들", color: "#10b981", description: "외부 집단을 적으로 설정하고 내집단의 결속을 강화하려는 부족주의적 프레임입니다." },
    { key: "fight_picking", title: "🥊 싸움 걸기", short: "싸움 걸기", color: "#94a3b8", description: "비판적 읽기보다 즉각적인 반응과 바이럴 확산을 노리는 선동적인 정체성 신호입니다." }
  ];

const defaultEvidenceText = "탐지 근거 문구가 충분히 추출되지 않았습니다.";

const removePrefix = (value: string): string => value.replace(/^\s*(패턴|근거)\s*[:：]\s*/u, "").trim();

const collapseWhitespace = (value: string): string =>
  value
    .replace(/\r?\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const shortenText = (value: string, maxLength = 220): string => {
  if (value.length <= maxLength) {
    return value;
  }

  const slice = value.slice(0, maxLength);
  const boundaryCandidates = [".", "!", "?", "。", "！", "？", "”", "\""]
    .map((mark) => slice.lastIndexOf(mark))
    .filter((index) => index >= Math.floor(maxLength * 0.55))
    .sort((a, b) => b - a);
  const boundary = boundaryCandidates[0] ?? -1;
  if (boundary >= 0) {
    return `${slice.slice(0, boundary + 1).trim()}…`;
  }

  return `${slice.trim()}…`;
};

const fallbackNarrative = (
  key: keyof AnalysisResponse["details"]["signals"],
  score: number
): string => {
  const veryLow = score <= 5;
  switch (key) {
    case "emotional_heat":
      return veryLow
        ? "전반적으로 정보 전달 중심의 어조이며, 과격한 감정 자극 표현은 거의 관측되지 않음."
        : "직접적 혐오·분노 선동은 약하지만 일부 문구에서 감정 자극 요소가 제한적으로 관측됨.";
    case "moral_outrage":
      return veryLow
        ? "특정 대상을 선악 구도로 규정하거나 도덕적 비난을 강요하는 패턴은 거의 나타나지 않음."
        : "도덕적 평가를 유도하는 표현이 일부 관측되나, 전반적으로 절제된 수준임.";
    case "black_white":
      return veryLow
        ? "가짜 이분법이나 단정적 일반화 표현은 거의 관측되지 않음."
        : "일부 단정적 표현이 있으나, 전면적인 흑백 프레임으로 확장되지는 않음.";
    case "us_them":
      return veryLow
        ? "집단 간 대립이나 타자화 표현은 거의 관측되지 않음."
        : "집단 구분을 암시하는 표현이 제한적으로 관측되며, 강한 배척 프레임은 약함.";
    case "fight_picking":
      return veryLow
        ? "행동 강요형 문구나 갈등 확산을 노리는 선동 패턴은 거의 관측되지 않음."
        : "클릭·공유를 유도하는 문구가 일부 있으나, 고강도 갈등 선동 수준은 아님.";
    default:
      return defaultEvidenceText;
  }
};

const buildNarrative = (
  key: keyof AnalysisResponse["details"]["signals"],
  detail: AnalysisResponse["details"]["signals"]["emotional_heat"]
): string => {
  const cleaned = detail.evidence.map((item) => collapseWhitespace(removePrefix(item))).filter(Boolean);

  if (cleaned.length === 0) {
    return fallbackNarrative(key, detail.score);
  }

  const normalized = cleaned.filter((item) => item !== defaultEvidenceText);

  if (normalized.length === 0) {
    return fallbackNarrative(key, detail.score);
  }

  const merged = collapseWhitespace(normalized.join(" "));
  const concise = shortenText(merged, 220);
  if (concise.length < 24) {
    return fallbackNarrative(key, detail.score);
  }

  return concise;
};

const riskLabel = (
  score: number,
  riskLevel?: "매우 낮음" | "낮음" | "중간" | "높음" | "매우 높음"
): { scoreLabel: "안정" | "주의" | "경계" | "심각"; riskLabel: "매우 낮음" | "낮음" | "중간" | "높음" | "매우 높음" } => {
  let scoreLabel: "안정" | "주의" | "경계" | "심각";

  if (score <= 33) {
    scoreLabel = "안정";
  } else if (score <= 66) {
    scoreLabel = "주의";
  } else if (score <= 84) {
    scoreLabel = "경계";
  } else {
    scoreLabel = "심각";
  }

  let finalRiskLevel = riskLevel;

  if (!finalRiskLevel) {
    if (score <= 5) {
      finalRiskLevel = "매우 낮음";
    } else if (score <= 84) {
      if (score >= 67) {
        finalRiskLevel = "높음";
      } else if (score >= 34) {
        finalRiskLevel = "중간";
      } else {
        finalRiskLevel = "낮음";
      }
    } else {
      finalRiskLevel = "매우 높음";
    }
  }

  return { scoreLabel, riskLabel: finalRiskLevel as "매우 낮음" | "낮음" | "중간" | "높음" | "매우 높음" };
};

const emptySignalDetail: AnalysisResponse["details"]["signals"]["emotional_heat"] = {
  score: 0,
  riskLevel: "낮음",
  rawScore: 0,
  normalizedScore: 0,
  adjustedScore: 0,
  weight: 1,
  patternCount: 0,
  contextualCorrection: 0,
  evidence: []
};

const SignalBar = ({ name, score, color, description, onInfoClick }: { name: string; score: number; color: string; description: string; onInfoClick: () => void; }) => {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[14px] font-bold text-slate-800">
        <span
          role="button"
          tabIndex={0}
          className="flex items-center gap-1.5 cursor-pointer group select-none"
          onClick={onInfoClick}
          onKeyDown={(e) => e.key === 'Enter' && onInfoClick()}
        >
          {name}
          <svg className="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition-colors pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        <span className="text-slate-900 font-bold">{value}%</span>
      </div>
      <div className="h-2.5 rounded-[5px] overflow-hidden w-full relative">
        <div className="absolute inset-0 rounded-[5px]" style={{ backgroundColor: color, opacity: 0.12 }} />
        <div className="h-full rounded-[5px] transition-all duration-500 ease-out relative z-10" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

const getScoreGuide = (score: number, topSignalKey?: string) => {
  let label = "매우 강력한 프레임";
  if (score <= 5) label = "패턴 거의 없음";
  else if (score <= 33) label = "일부 신호 감지";
  else if (score <= 66) label = "주의 필요";
  else if (score <= 84) label = "강한 프레임 작동 중";

  if (score <= 5 || !topSignalKey) {
    return {
      label,
      guide: "정보의 맥락과 출처를 확인하며 일반적인 뉴스 읽기 방식으로 접근해도 무리가 적습니다."
    };
  }

  switch (topSignalKey) {
    case "emotional_heat":
      return {
        label,
        guide: "감정적 가열 신호가 가장 높게 나타났습니다.\n기사에서 자극적인 형용사나 감정적 단어를 걷어내고, 실제 발생한 '사건(Fact)'이 무엇인지 분리해서 읽어보세요."
      };
    case "moral_outrage":
      return {
        label,
        guide: "도덕적 공분 신호가 가장 높게 나타났습니다.\n이 사안을 '선과 악' 또는 '가해자와 피해자'의 무조건적인 대립 구도로 단정 짓고 있지 않은지 점검해보세요."
      };
    case "black_white":
      return {
        label,
        guide: "흑백 논리 신호가 가장 높게 나타났습니다.\n'항상', '절대', '유일한' 같은 극단적인 선택지 외에, 기사에서 다루지 않은 다른 대안은 없는지 질문해보세요."
      };
    case "us_them":
      return {
        label,
        guide: "우리 vs 그들 신호가 가장 높게 나타났습니다.\n특정 집단을 과도하게 단순화하거나 적으로 규정하여 막연한 배척을 유도하고 있지 않은지 살펴보세요."
      };
    case "fight_picking":
      return {
        label,
        guide: "싸움 걸기 신호가 가장 높게 나타났습니다.\n당장의 분노나 조롱을 자극해 클릭과 공유를 유도하려는 목적은 아닌지, 한 발짝 물러서서 객관적으로 판단해보세요."
      };
    default:
      return {
        label,
        guide: "작성자의 의도나 감정이 강하게 개입된 글입니다.\n한 발 물러서서 인용, 통계, 근거 등 객관적 사실과 작성자의 의견을 분리해 읽어보세요."
      };
  }
};

export const ResultPage = () => {
  const { id } = useParams();
  const [payload, setPayload] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [activeSignalTooltip, setActiveSignalTooltip] = useState<{ name: string, description: string } | null>(null);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (!id) {
      setError("분석 ID가 없습니다.");
      setLoading(false);
      return;
    }

    fetchAnalysisById(id)
      .then((response) => {
        setPayload(response);
        setError(null);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "분석 결과를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="text-sm text-slate">분석 결과를 불러오는 중...</p>;
  }

  if (error || !payload) {
    return (
      <div className="card-surface p-6">
        <p className="text-sm text-red-600">{error ?? "분석 결과를 찾을 수 없습니다."}</p>
        <Link className="mt-4 inline-block text-sm text-ember hover:underline" to="/">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const { analysis, details, disclaimer } = payload;
  const safeCoreFacts = Array.isArray(details?.core_facts) ? details.core_facts : [];
  const safeClearView =
    details && typeof details.clear_view === "object" && details.clear_view
      ? details.clear_view
      : { left_focus: "", right_focus: "" };
  const rawSignals = ((details as unknown as { signals?: Record<string, unknown> })?.signals ?? {}) as Record<
    string,
    unknown
  >;
  const signalItems = signalMeta.map((meta) => {
    const raw = rawSignals[meta.key];
    const signal =
      raw && typeof raw === "object"
        ? {
          ...emptySignalDetail,
          ...(raw as Partial<typeof emptySignalDetail>),
          evidence: Array.isArray((raw as { evidence?: unknown }).evidence)
            ? ((raw as { evidence?: string[] }).evidence ?? [])
            : []
        }
        : emptySignalDetail;

    return { ...meta, signal };
  });

  const topSignal =
    signalItems
      .map((item) => ({
        ...item,
        score: item.signal.score
      }))
      .sort((a, b) => b.score - a.score)[0] ?? {
      ...signalMeta[0],
      score: 0,
      signal: emptySignalDetail
    };
  const topSignalNarrative = buildNarrative(topSignal.key, topSignal.signal);
  const scoreGuide = getScoreGuide(analysis.total_score, topSignal.key);

  let domainName = "분석 요약";
  try {
    if (analysis.source_url) {
      const parsedUrl = new URL(analysis.source_url);
      domainName = parsedUrl.hostname.replace(/^www\./, '').toUpperCase();
    }
  } catch (e) {
    // Ignore invalid URLs
  }

  return (
    <>
      <div className="space-y-6 animate-rise">
        {/* ---- Main Analysis Card (Jacobin Style) ---- */}
        <section className="bg-white rounded-[24px] p-8 md:p-12 shadow-sm border border-slate-100 mb-8 w-full">

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-800 rounded-full text-[11px] font-bold tracking-[0.05em] uppercase">
              {domainName}
            </span>
            <span className="relative group inline-flex items-center gap-1.5 px-3 py-1 bg-[#f5f3ff] text-[#9333ea] rounded-full text-[11px] font-bold tracking-[0.05em] uppercase cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-[12px] h-[12px]">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
              </svg>
              프레임 밀집도 {analysis.density.toFixed(2)}
              <svg className="w-4 h-4 text-slate-400 cursor-help ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[260px] p-3.5 bg-black text-white text-[13px] leading-relaxed rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-[100] font-normal normal-case tracking-normal pointer-events-none">
                100문장 당 감정/프레이밍 패턴이 등장하는 횟수입니다. 숫자가 높을수록 글의 의도가 강하게 반영되어 있습니다.
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-black"></div>
              </div>
            </span>
          </div>

          {/* Title */}
          <h1 className="font-sans text-[36px] md:text-[42px] font-black text-[#111827] leading-[1.1] tracking-tight mb-8">
            {decodeHtmlEntities(analysis.title)}
          </h1>

          {/* Score & Reading Guide Alert (Yellow, Left Border) */}
          <div className="bg-[#fffdf0] border-l-4 border-[#f59e0b] rounded-r-xl rounded-l-sm p-5 mb-8">
            <h3 className="text-[17px] font-bold text-[#111827] mb-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[20px] h-[20px] text-[#f59e0b]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              프레임 점수 {Math.round(analysis.total_score)}점, {scoreGuide.label}
            </h3>
            <div className="text-[16px] text-[#475569] leading-relaxed">
              {scoreGuide.guide.split('\n').map((line, idx) => (
                <p key={idx}>- {line.trim()}</p>
              ))}
            </div>
          </div>

          {/* Final Verdict (Quote Style) */}
          <div className="border-l-[3px] border-slate-300 pl-5 py-1 mb-10 w-full">
            <p className="italic font-serif text-slate-600 text-[16px] leading-[1.7] break-keep">
              “{analysis.verdict}”
            </p>
          </div>

          {/* Divider */}
          <hr className="border-slate-100 border-t mb-8" />

          {/* Signal Bars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-[72px] gap-y-7 mb-4">
            {signalItems.map((item) => (
              <div key={item.key} className="w-full">
                <SignalBar
                  name={item.short}
                  score={item.signal.score}
                  color={item.color}
                  description={item.description}
                  onInfoClick={() => setActiveSignalTooltip({ name: item.short, description: item.description })}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ---- Frame Score Detail Table ---- */}
        <section className="bg-white rounded-[24px] p-8 md:p-12 shadow-sm border border-slate-100 mb-8 w-full">
          <h2 className="text-[22px] font-bold text-ink flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[24px] h-[24px] text-slate-800">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            프레임 신호 정밀 분석
          </h2>
          <p className="mt-2 text-[13px] text-slate">
            점수 기준: 매우 낮음 0-5 / 낮음 6-33 / 중간 34-66 / 높음 67-84 / 매우 높음 85-100
          </p>
          <div className="mt-8 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="text-[13px] text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="py-4 pl-0 pr-4 w-[130px] sm:w-[160px] font-bold whitespace-nowrap">신호 카테고리</th>
                  <th className="py-4 px-2 w-[90px] sm:w-[110px] font-bold whitespace-nowrap">위험도</th>
                  <th className="py-4 pl-4 md:pl-8 font-bold">탐지된 패턴 및 근거</th>
                </tr>
              </thead>
              <tbody>
                {signalItems.map((signal) => {
                  const detail = signal.signal;
                  const risk = riskLabel(detail.score, detail.riskLevel).riskLabel;
                  const narrative = buildNarrative(signal.key, detail);
                  return (
                    <tr key={signal.key} className="border-b border-slate-50 align-top transition-colors hover:bg-slate-50/50">
                      <td className="py-3 pl-0 pr-4 font-bold text-[#334155] mt-[1px] whitespace-nowrap align-top">{signal.title}</td>
                      <td className="py-3 px-2 text-ink whitespace-nowrap">
                        <span className="rounded-full bg-[#fef2f2] px-3 py-1 text-[12px] font-bold text-[#ef4444] tracking-wide inline-block">
                          {risk}
                        </span>
                      </td>
                      <td className="py-4 pl-4 md:pl-8 pr-2 md:pr-5 font-serif text-slate-600 text-[16px] leading-[1.7] break-keep">{narrative}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---- Facts & Frames Section ---- */}
        <section className="bg-white rounded-[24px] p-8 md:p-12 shadow-sm border border-slate-100 mb-8 w-full">
          {/* Core Facts Sub-section */}
          <div className="mb-0">
            <h2 className="text-[22px] font-bold text-ink flex items-center gap-2 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-[24px] h-[24px] text-slate-800">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              사실과 프레임 보기
            </h2>

            <div className="mb-2">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h3 className="text-[17px] font-bold text-slate-800">이 글의 핵심 사실</h3>
                {analysis.source_url && (
                  <a
                    href={analysis.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] font-bold text-slate-400 hover:text-[#8b5cf6] bg-slate-50 hover:bg-[#f5f3ff] px-2.5 py-1 rounded-md border border-slate-100 hover:border-[#8b5cf6]/20 transition-all"
                  >
                    해당 글 보기
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
              {safeCoreFacts.length === 0 ? (
                <p className="text-[14px] text-slate-400">핵심 사실 요약이 생성되지 않았습니다.</p>
              ) : (
                <ul className="space-y-3 list-disc pl-5 marker:text-[#64748b]">
                  {safeCoreFacts.flatMap(fact => fact.split('\n')).map(line => line.trim()).filter(Boolean).map((line, index) => (
                    <li key={index} className="pl-1">
                      <p className="text-[17px] leading-snug text-[#334155] font-medium break-keep">
                        {line.replace(/^[•*\\-]\s*/, "")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Bridge (Divider) */}
          <div className="flex items-center justify-center my-12">
            <div className="flex-grow border-t border-slate-100"></div>
            <div className="shrink-0 mx-4 text-center space-y-1">
              <span className="block text-[#64748b] text-[14px] font-medium tracking-wide">
                같은 사실, 다르게 읽힙니다
              </span>
              <span className="block text-[#64748b] text-[14px] font-medium tracking-wide">
                어느 관점의 표현이 자연스럽게 느껴졌나요?
              </span>
            </div>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* ClearView Frame Analysis Sub-section */}
          <div>
            <div className="grid gap-6 md:grid-cols-2">
              <article className="relative bg-[#f8fafc] rounded-[24px] p-8 md:p-10 shadow-sm border border-slate-100 border-l-[6px] border-l-[#8b5cf6] flex flex-col justify-center min-h-[180px] overflow-hidden z-0">
                <h3 className="text-[#8b5cf6] font-bold text-lg mb-4">
                  {parseFocusText(safeClearView.left_focus ?? "", "위기 중심 프레임").label}
                </h3>
                <p className="font-serif text-slate-600 text-[16px] leading-[1.7] break-keep z-10">
                  {parseFocusText(safeClearView.left_focus ?? "", "위기 중심 프레임").description}
                </p>
              </article>

              <article className="relative bg-[#f8fafc] rounded-[24px] p-8 md:p-10 shadow-sm border border-slate-100 border-r-[6px] border-r-[#0f172a] flex flex-col justify-center min-h-[180px] overflow-hidden z-0">
                <h3 className="font-bold text-[17px] text-slate-800 mb-4 tracking-wider text-right">
                  {parseFocusText(safeClearView.right_focus ?? "", "기회 중심 프레임").label}
                </h3>
                <p className="font-serif text-slate-600 text-[16px] leading-[1.7] break-keep text-right z-10">
                  {parseFocusText(safeClearView.right_focus ?? "", "기회 중심 프레임").description}
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Share Button Section */}
        <section className="flex flex-col items-center justify-center gap-3 pb-8 pt-4">
          <p className="text-[15px] font-bold text-slate-700 tracking-wide text-center leading-relaxed">
            이 분석, 혼자 보기 아깝다면?<br />
            페이지를 나가면 다시 찾기 어려워요.
          </p>
          <button
            onClick={handleCopyLink}
            className="group relative flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 hover:border-[#8b5cf6] rounded-full shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] hover:shadow-[#8b5cf6]/20 transition-all duration-300 w-auto min-w-[200px] active:scale-[0.98]"
          >
            {isCopied ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-emerald-500 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-500 group-hover:text-[#8b5cf6] shrink-0 transition-colors">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            )}
            <span className={`font-bold text-[15px] tracking-wide transition-colors ${isCopied ? 'text-emerald-500' : 'text-slate-700 group-hover:text-[#8b5cf6]'}`}>
              {isCopied ? "링크 복사 완료!" : "링크 복사하기"}
            </span>
          </button>
        </section>
      </div >

      {/* Info Tooltip Modal */}
      {activeSignalTooltip && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm"
          onClick={() => setActiveSignalTooltip(null)}
        >
          <div
            className="bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] w-full max-w-[320px] animate-rise"
            onClick={e => e.stopPropagation()}
            role="dialog"
          >
            <h3 className="font-bold text-lg text-slate-800 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {activeSignalTooltip.name}란?
            </h3>
            <p className="text-slate-600 leading-relaxed text-[15px] break-keep">
              {activeSignalTooltip.description}
            </p>
            <button
              className="mt-6 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
              onClick={() => setActiveSignalTooltip(null)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
};
