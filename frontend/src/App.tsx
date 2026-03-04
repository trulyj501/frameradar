import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { ResultPage } from "./pages/ResultPage";
import AboutPage from "./pages/AboutPage";
import { fetchUsageStatus } from "./services/api";


function App() {
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);

  useEffect(() => {
    fetchUsageStatus()
      .then((res) => setRemainingQuota(res.remaining))
      .catch((err) => console.error("Failed to fetch usage status:", err));
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="mx-auto flex-grow w-full max-w-6xl px-4 pt-8 pb-12 md:px-8">
        <header className="mb-12 flex items-center justify-between">
          <Link to="/" className="font-sans text-xl font-bold tracking-tight text-ink flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="flex items-center justify-center w-8 h-8 rounded-[10px] bg-[#8b5cf6] text-white shadow-sm mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <span>프레임 레이더</span>
          </Link>

          <nav className="flex items-center gap-6 font-semibold text-[15px]">
            <NavLink className={({ isActive }) => `transition-colors hover:text-ink ${isActive ? "text-ink" : "text-slate-500"}`} to="/" end>
              홈
            </NavLink>
            <NavLink className={({ isActive }) => `transition-colors hover:text-ink ${isActive ? "text-ink" : "text-slate-500"}`} to="/leaderboard">
              리더보드
            </NavLink>
            {remainingQuota !== null && (
              <span className="text-[14px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full pointer-events-none hidden sm:inline-block">
                남은 분석 건수: {remainingQuota.toLocaleString()}
              </span>
            )}
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/analysis/:id" element={<ResultPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>
      </div>

      {/* Footer */}
      <footer className="w-full bg-[#0f172a] border-t border-[#1e293b] mt-auto py-10 text-center">
        <div className="space-y-4">
          <p className="text-[14px] text-white font-medium">
            같은 뉴스도 다르게 느껴지는 이유를 분석합니다.{' '}
            <Link to="/about" className="hover:text-violet-400 transition-colors underline underline-offset-4 decoration-slate-600 hover:decoration-violet-400">
              프레임 레이더
            </Link>
          </p>
          <p className="text-[12px] text-white leading-relaxed max-w-2xl mx-auto px-4 break-keep">
            이 분석은 언어 패턴 탐지에 기반한 교육용 도구입니다. 사실 여부 및 정확성을 검증하지 않으며, 팩트체크 시스템이 아닙니다.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
