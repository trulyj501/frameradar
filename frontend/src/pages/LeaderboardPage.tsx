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
                  <th className="px-4 py-3">순위</th>
                  <th className="px-4 py-3">제목</th>
                  <th className="px-4 py-3">
                    <span className="relative group inline-flex items-center gap-1 cursor-help">
                      프레임 점수
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {/* Tooltip */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[220px] p-2.5 bg-black text-white text-[12px] leading-relaxed rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50 font-normal normal-case tracking-normal pointer-events-none">
                        5가지 프레임 신호 점수를 합산하고 패턴 밀집도를 곱해 보정한 최종 프레임 강도입니다.
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-b-black"></div>
                      </div>
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="relative group inline-flex items-center gap-1 cursor-help">
                      밀집도
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {/* Tooltip */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[240px] p-2.5 bg-black text-white text-[12px] leading-relaxed rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50 font-normal normal-case tracking-normal pointer-events-none">
                        100문장 당 감정/프레이밍 패턴이 등장하는 횟수입니다. 숫자가 높을수록 의도가 강하게 반영되어 있습니다.
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-b-black"></div>
                      </div>
                    </span>
                  </th>
                  <th className="px-4 py-3">분석일</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-t border-white/30 transition-colors hover:bg-white/30">
                    <td className="px-4 py-3 font-semibold text-ink">#{index + 1}</td>
                    <td className="px-4 py-3 text-ink">
                      <Link to={`/analysis/${row.id}`} className="hover:text-primary transition-colors underline-offset-4 hover:underline">
                        {decodeHtmlEntities(row.title)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold text-primary">{row.total_score.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate">{row.density.toFixed(4)}</td>
                    <td className="px-4 py-3 text-slate">{new Date(row.created_at).toLocaleDateString()}</td>
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
  );
};
