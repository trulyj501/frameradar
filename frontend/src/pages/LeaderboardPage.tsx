import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchLeaderboard } from "../services/api";
import { LeaderboardResponse } from "../types/api";
import { decodeHtmlEntities } from "../utils/html";

export const LeaderboardPage = () => {
  const [range, setRange] = useState<"7d" | "all">("7d");
  const [rows, setRows] = useState<LeaderboardResponse["leaderboard"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<"score" | "density" | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard(range)
      .then((response) => {
        setRows(response.leaderboard);
        setNotice(response.warning ?? null);
        setError(null);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "리더보드를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <>
      <div className="space-y-6 animate-rise">
        <section className="card-surface p-6">
          <h1 className="font-serif text-3xl text-ink">리더보드</h1>
          <p className="mt-2 text-sm text-slate">
            프레임 신호가 많이 감지된 글 순위예요.<br />
            높은 순위 = 나쁜 기사가 아니에요. 점수가 높을수록 표현이 강했다는 뜻이에요.
          </p>
          {notice ? <p className="mt-2 text-sm text-amber-700">{notice}</p> : null}

          <div className="mt-4 flex gap-3">
            <button
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${range === "7d" ? "bg-primary text-white" : "bg-smoke text-slate"
                }`}
              onClick={() => setRange("7d")}
            >
              최근 7일
            </button>
            <button
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${range === "all" ? "bg-primary text-white" : "bg-smoke text-slate"
                }`}
              onClick={() => setRange("all")}
            >
              전체 기간
            </button>
          </div>
        </section>

        <section className="card-surface overflow-hidden">
          {loading ? <p className="p-6 text-sm text-slate">리더보드 로딩 중...</p> : null}
          {error ? <p className="p-6 text-sm text-red-600">{error}</p> : null}

          {!loading && !error ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-white/40 backdrop-blur-md text-xs uppercase tracking-[0.08em] text-slate">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">순위</th>
                    <th className="px-4 py-3 min-w-[200px]">제목</th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      <span
                        role="button"
                        tabIndex={0}
                        className="inline-flex items-center gap-1 cursor-pointer select-none group"
                        onClick={() => setActiveTooltip('score')}
                        onKeyDown={(e) => e.key === 'Enter' && setActiveTooltip('score')}
                      >
                        프레임 점수
                        <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-500 transition-colors pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      <span
                        role="button"
                        tabIndex={0}
                        className="inline-flex items-center gap-1 cursor-pointer select-none group"
                        onClick={() => setActiveTooltip('density')}
                        onKeyDown={(e) => e.key === 'Enter' && setActiveTooltip('density')}
                      >
                        밀집도
                        <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-500 transition-colors pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap text-right">분석일</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} className="border-t border-white/30 transition-colors hover:bg-white/30">
                      <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">#{index + 1}</td>
                      <td className="px-4 py-3 text-ink min-w-[200px]">
                        <Link to={`/analysis/${row.id}`} className="hover:text-primary transition-colors underline-offset-4 hover:underline">
                          {decodeHtmlEntities(row.title)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold text-primary whitespace-nowrap">{row.total_score.toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate whitespace-nowrap">{row.density.toFixed(4)}</td>
                      <td className="px-4 py-3 text-slate whitespace-nowrap text-right">{new Date(row.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}

                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate">
                        해당 기간에 분석 결과가 없습니다.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>

      {/* Info Tooltip Modal */}
      {activeTooltip && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm"
          onClick={() => setActiveTooltip(null)}
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
              {activeTooltip === 'score' ? "프레임 점수 란?" : "밀집도 란?"}
            </h3>
            <p className="text-slate-600 leading-relaxed text-[15px] break-keep">
              {activeTooltip === 'score'
                ? "5가지 프레임 신호 점수를 합산하고 패턴 밀집도를 곱해 보정한 최종 프레임 강도입니다. 높은 점수가 반드시 나쁜 기사를 뜻하지 않으며, 감정적 표현이 강하게 쓰였다는 지표입니다."
                : "100문장 당 감정·프레이밍 패턴이 등장하는 평균 횟수입니다. 이 숫자가 높을수록 글쓴이의 주관적 의도가 문장에 촘촘하게 박혀있을 확률이 높습니다."}
            </p>
            <button
              className="mt-6 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
              onClick={() => setActiveTooltip(null)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
};
