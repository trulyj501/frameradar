import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { analyzeArticle, fetchRecentAnalyses, fetchUsageStatus } from "../services/api";
import { AnalysisRecord } from "../types/api";
import { decodeHtmlEntities } from "../utils/html";

export const HomePage = () => {
  const navigate = useNavigate();

  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [inputType, setInputType] = useState<"url" | "text">("url");
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"starting" | "fetching" | "analyzing" | "almost_done" | "slow" | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [recent, setRecent] = useState<AnalysisRecord[]>([]);
  const fetchTimerRef = useRef<number | null>(null);
  const analyzeTimerRef = useRef<number | null>(null);
  const almostDoneTimerRef = useRef<number | null>(null);
  const slowTimerRef = useRef<number | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Adding a short timeout ensures the DOM has updated and the element is fully paintable
    // before attempting focus, which specifically improves behavior on Safari.
    const focusTimeout = setTimeout(() => {
      if (inputType === "url") {
        urlInputRef.current?.focus();
      } else if (inputType === "text") {
        textInputRef.current?.focus();
      }
    }, 50);

    return () => clearTimeout(focusTimeout);
  }, [inputType]);

  useEffect(() => {
    fetchRecentAnalyses()
      .then((response) => {
        setRecent(response.analyses);
        setNotice(response.warning ?? null);
      })
      .catch(() => setRecent([]));

    fetchUsageStatus()
      .then((res) => setRemainingQuota(res.remaining))
      .catch((err) => console.error("Failed to fetch usage status:", err));
  }, []);

  useEffect(() => {
    return () => {
      if (fetchTimerRef.current !== null) {
        window.clearTimeout(fetchTimerRef.current);
      }
      if (analyzeTimerRef.current !== null) {
        window.clearTimeout(analyzeTimerRef.current);
      }
      if (almostDoneTimerRef.current !== null) {
        window.clearTimeout(almostDoneTimerRef.current);
      }
      if (slowTimerRef.current !== null) {
        window.clearTimeout(slowTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let interval: number;
    let fadeTimeout: number;

    const changeMessage = (totalMsgs: number) => {
      setFadeOpacity(0);
      fadeTimeout = window.setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % totalMsgs);
        setFadeOpacity(1);
      }, 200);
    };

    if (loadingPhase === "almost_done") {
      setMessageIndex(0);
      setFadeOpacity(1);
      interval = window.setInterval(() => changeMessage(3), 3000);
    } else if (loadingPhase === "slow") {
      setMessageIndex(0);
      setFadeOpacity(1);
      interval = window.setInterval(() => changeMessage(3), 4000);
    } else {
      setMessageIndex(0);
      setFadeOpacity(1);
    }

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(fadeTimeout);
    };
  }, [loadingPhase]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (remainingQuota === 0) {
      setError("무료 분석 가능 건수(10,000건)가 모두 소진되었습니다.");
      setActionMessage("한도 초과로 분석을 시작하지 못했습니다.");
      return;
    }

    if (inputType === "url" && !url) {
      setError("분석할 URL을 입력해 주세요.");
      setActionMessage("입력값이 없어 분석을 시작하지 못했습니다.");
      return;
    }

    if (inputType === "text" && !text) {
      setError("분석할 기사 본문 텍스트를 입력해 주세요.");
      setActionMessage("입력값이 없어 분석을 시작하지 못했습니다.");
      return;
    }

    try {
      setError(null);
      setActionMessage("분석 요청을 시작했습니다.");
      setLoading(true);
      setLoadingPhase("starting");
      if (fetchTimerRef.current !== null) {
        window.clearTimeout(fetchTimerRef.current);
      }
      if (analyzeTimerRef.current !== null) {
        window.clearTimeout(analyzeTimerRef.current);
      }
      if (almostDoneTimerRef.current !== null) {
        window.clearTimeout(almostDoneTimerRef.current);
      }
      if (slowTimerRef.current !== null) {
        window.clearTimeout(slowTimerRef.current);
      }
      fetchTimerRef.current = window.setTimeout(() => {
        setLoadingPhase("fetching");
        setActionMessage("URL 본문을 수집하고 있습니다...");
      }, 500);
      analyzeTimerRef.current = window.setTimeout(() => {
        setLoadingPhase("analyzing");
        setActionMessage("AI가 프레이밍 패턴을 계산하고 있습니다...");
      }, 2500);
      almostDoneTimerRef.current = window.setTimeout(() => {
        setLoadingPhase("almost_done");
        setActionMessage("곧 분석이 완료됩니다...");
      }, 12000);
      slowTimerRef.current = window.setTimeout(() => {
        setLoadingPhase("slow");
        setActionMessage("지연되고 있습니다. 잠시만 기다려 주세요...");
      }, 25000);

      const response = await analyzeArticle({
        url: inputType === "url" ? url : undefined,
        text: inputType === "text" ? text : undefined
      });

      if (response.warning) {
        setNotice(response.warning);
      }

      setActionMessage("분석이 완료되어 결과 페이지로 이동합니다.");
      navigate(`/analysis/${response.analysis.id}`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "분석 요청에 실패했습니다.";
      setError(message);
      setActionMessage(`분석 실패: ${message}`);

      // 기사 크롤이 차단되거나 지연된 경우 사용자에게 즉각 알림을 주고 텍스트 붙여넣기 모드로 전환
      if (message.includes("차단되었습니다") || message.includes("추출하지 못했습니다")) {
        window.alert(message);
        setInputType("text");
        // 짧은 딜레이 후 텍스트 textarea에 포커스를 맞춥니다.
        setTimeout(() => {
          textInputRef.current?.focus();
        }, 50);
      }
    } finally {
      if (fetchTimerRef.current !== null) {
        window.clearTimeout(fetchTimerRef.current);
        fetchTimerRef.current = null;
      }
      if (analyzeTimerRef.current !== null) {
        window.clearTimeout(analyzeTimerRef.current);
        analyzeTimerRef.current = null;
      }
      if (almostDoneTimerRef.current !== null) {
        window.clearTimeout(almostDoneTimerRef.current);
        almostDoneTimerRef.current = null;
      }
      if (slowTimerRef.current !== null) {
        window.clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
      setLoadingPhase(null);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10 animate-rise">
      <section>
        <div className="pt-12 md:pt-32 pb-16 text-center px-6 md:px-10">
          <h1 className="text-[2rem] sm:text-5xl md:text-7xl font-extrabold tracking-tight text-ink mb-6 leading-snug md:leading-tight">
            방금 읽은 글, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondaryPink">팩트입니까,</span><br />
            설계된 프레임입니까?
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base md:text-lg text-slate break-keep">
            남의 의도대로 읽고 있지 않나요? 숨은 프레임과 어그로, 한 번에 잡아드려요.
          </p>
        </div>

        <form className="w-full mx-auto px-4 md:px-8 mb-16 relative" onSubmit={onSubmit}>
          <div className="relative z-10">
            {/* Glowing Aura Background */}
            <div className="absolute -inset-2 bg-gradient-to-r from-primaryLight to-secondaryPink opacity-20 blur-2xl rounded-full pointer-events-none"></div>

            <div className="relative bg-white shadow-2xl shadow-indigo-500/10 rounded-[2rem] overflow-hidden transition-all duration-300">
              {/* Tabs (URL vs Text) */}
              <div className="flex px-8 pt-6 gap-8 bg-white border-b border-slate-50">
                <button
                  type="button"
                  className={`pb-4 px-2 text-[15px] font-bold transition-colors border-b-[3px] ${inputType === "url"
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-400 hover:text-ink"
                    }`}
                  onClick={() => {
                    setInputType("url");
                    setError(null);
                  }}
                >
                  글 링크
                </button>
                <button
                  type="button"
                  className={`pb-4 px-2 text-[15px] font-bold transition-colors border-b-[3px] ${inputType === "text"
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-400 hover:text-ink"
                    }`}
                  onClick={() => {
                    setInputType("text");
                    setError(null);
                  }}
                >
                  본문 내용
                </button>
              </div>

              <div className="bg-white p-3 md:p-4">
                {inputType === "url" ? (
                  <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                    <div className="flex-1 w-full p-2 transition-all">
                      <span className="sr-only">URL</span>
                      <input
                        ref={urlInputRef}
                        className="w-full text-base md:text-lg text-ink bg-transparent outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="분석할 글의 URL을 입력해주세요."
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        disabled={loading || remainingQuota === 0}
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || remainingQuota === 0}
                      className="shrink-0 flex items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 h-[60px] text-base font-bold text-white transition-all hover:bg-primaryDark active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 shadow-lg shadow-primary/20"
                    >
                      {loading ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        "분석하기"
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="w-full p-2 transition-all">
                      <span className="sr-only">본문 텍스트</span>
                      <textarea
                        ref={textInputRef}
                        className="h-40 w-full text-base md:text-lg text-ink bg-transparent outline-none resize-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="분석할 글의 내용을 붙여넣어 주세요."
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        disabled={loading || remainingQuota === 0}
                        maxLength={10000}
                        autoFocus
                      />
                      <div className="text-right text-[12px] md:text-[13px] text-slate-400 mt-1 px-1 font-medium">
                        {text.length.toLocaleString()} / 10,000자
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={loading || remainingQuota === 0}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-10 py-4 h-[60px] text-base font-bold text-white transition-all hover:bg-primaryDark active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 shadow-lg shadow-primary/20"
                      >
                        {loading ? (
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          "분석하기"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="max-w-3xl mx-auto px-6 mt-4 flex flex-col gap-2">
            {loading ? (() => {
              let displayMessage = "분석 요청을 전송하고 있습니다...";
              if (loadingPhase === "fetching") displayMessage = "URL 본문을 수집하고 있습니다...";
              else if (loadingPhase === "analyzing") displayMessage = "AI가 프레이밍 패턴을 계산하고 있습니다...";
              else if (loadingPhase === "almost_done") {
                const msgs = [
                  "곧 분석이 완료됩니다...",
                  "결과를 정리하고 있습니다...",
                  "분석 리포트를 생성하고 있습니다..."
                ];
                displayMessage = msgs[messageIndex] || msgs[0];
              } else if (loadingPhase === "slow") {
                const msgs = [
                  "서버가 바쁩니다. 거의 다 왔어요!",
                  "조금만 더 기다려 주세요. 꼼꼼히 분석 중입니다...",
                  "복잡한 기사일수록 더 정확해져요. 잠시만요..."
                ];
                displayMessage = msgs[messageIndex] || msgs[0];
              }

              return (
                <p className="text-sm text-center text-slate-500">
                  <span className={`inline-block transition-opacity duration-200 ${fadeOpacity === 0 ? 'opacity-0' : 'opacity-100'}`}>
                    {displayMessage}
                  </span>
                </p>
              );
            })() : null}
            {error ? <p className="text-sm text-center text-red-500 font-medium">{error}</p> : null}
            {notice ? <p className="text-sm text-center text-amber-600">{notice}</p> : null}
          </div>
        </form>
      </section>

      <section className="w-full mx-auto px-4 md:px-8 pt-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-1.5 h-6 bg-primary rounded-full"></div>
          <h2 className="text-xl font-bold text-ink">최근 분석된 글</h2>
        </div>

        <div className={`mt-4 ${recent.length === 0 ? "block" : "grid gap-6 sm:grid-cols-2 lg:grid-cols-4"}`}>
          {recent.length === 0 ? (
            <p className="text-sm text-slate">아직 분석 결과가 없습니다.</p>
          ) : (
            recent.slice(0, 8).map((item) => {
              const displayTitle = item.title?.trim() || item.content?.split('\n')[0]?.trim() || "제목 없음";
              return (
                <Link
                  to={`/analysis/${item.id}`}
                  key={item.id}
                  className="card-surface flex flex-col p-5 h-full group hover:-translate-y-1 transition-transform"
                >
                  <div className="flex items-center justify-end mb-3">
                    {item.total_score >= 85 ? (
                      <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-bold">매우 강력한 프레임</span>
                    ) : item.total_score >= 67 ? (
                      <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold">강한 프레임 작동 중</span>
                    ) : item.total_score >= 34 ? (
                      <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full text-[10px] font-bold">주의 필요</span>
                    ) : item.total_score >= 6 ? (
                      <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold">일부 신호 감지</span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">패턴 거의 없음</span>
                    )}
                  </div>

                  <h3 className="font-bold text-ink text-sm md:text-base leading-snug line-clamp-2 mb-5 group-hover:text-primary transition-colors" title={decodeHtmlEntities(displayTitle)}>
                    {decodeHtmlEntities(displayTitle)}
                  </h3>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-full group-hover:bg-primary group-hover:text-white transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                      분석보기
                    </div>
                    <span className="text-xs font-bold text-slate-300">
                      {item.total_score.toFixed(0)} <span className="font-normal text-[10px]">점</span>
                    </span>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </section>
    </div >
  );
};
