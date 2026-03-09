import { guidePosts, GuidePost } from "virtual:guide-posts";
import { Link } from "react-router-dom";

function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function GuideCard({ post }: { post: GuidePost }) {
    return (
        <Link
            to={`/guide/${post.slug}`}
            className="group card-surface flex flex-col overflow-hidden hover:-translate-y-1 transition-all duration-300"
        >
            {/* Thumbnail */}
            <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-purple-100 to-pink-100 overflow-hidden">
                {post.thumbnail ? (
                    <img
                        src={post.thumbnail}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                        }}
                    />
                ) : null}
                {/* Fallback gradient overlay with radar icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 p-5">
                <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                        </svg>
                        100% 활용법
                    </span>
                    {post.date && (
                        <time className="text-[11px] text-slate-400 font-medium">{formatDate(post.date)}</time>
                    )}
                </div>

                <h2 className="font-bold text-ink text-base leading-snug line-clamp-2 mb-3 group-hover:text-primary transition-colors">
                    {post.title}
                </h2>

                {post.description && (
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 flex-1">
                        {post.description}
                    </p>
                )}

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <span>자세히 읽기</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                </div>
            </div>
        </Link>
    );
}

export function GuidePage() {
    const posts = guidePosts;

    return (
        <div className="animate-rise">
            {/* Hero header */}
            <header className="py-12 md:py-16 text-center">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-bold px-4 py-2 rounded-full mb-5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                    활용 가이드
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-ink mb-4 leading-tight">
                    프레임 레이더{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondaryPink">
                        100% 활용법
                    </span>
                </h1>
                <p className="mt-3 max-w-xl mx-auto text-base text-slate-500 break-keep leading-relaxed">
                    실제 기사로 배우는 프레임 분석 심화 가이드. 뉴스를 읽는 눈을 키워드립니다.
                </p>
            </header>

            {/* Posts grid */}
            <main>
                {posts.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                            </svg>
                        </div>
                        <p className="text-slate-400 font-medium">아직 게시된 글이 없습니다.</p>
                    </div>
                ) : (
                    <section>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {posts.map((post) => (
                                <GuideCard key={post.slug} post={post} />
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
