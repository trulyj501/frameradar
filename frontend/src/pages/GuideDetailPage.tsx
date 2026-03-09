import { useParams, Link, Navigate } from "react-router-dom";
import { guidePosts } from "virtual:guide-posts";
import { marked } from "marked";
import { useEffect, useMemo } from "react";

// Configure marked: external links open in new tab, images are responsive
function buildRenderer() {
    const renderer = new marked.Renderer();

    // Links: external → target="_blank" rel="noopener noreferrer", brand color applied via CSS
    renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
        const isExternal = href && (href.startsWith("http://") || href.startsWith("https://"));
        const titleAttr = title ? ` title="${title}"` : "";
        const externalAttrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
        return `<a href="${href}"${titleAttr}${externalAttrs} class="guide-link">${text}</a>`;
    };

    // Images: wrapped in a centered div, responsive, rounded
    renderer.image = ({ href, title, text }: { href: string; title?: string | null; text: string }) => {
        const titleAttr = title ? ` title="${title}"` : "";
        const altAttr = text || "이미지";
        return `<figure class="guide-figure">
  <img src="${href}" alt="${altAttr}"${titleAttr} class="guide-img" />
  ${altAttr ? `<figcaption class="guide-figcaption">${altAttr}</figcaption>` : ""}
</figure>`;
    };

    return renderer;
}

function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

export function GuideDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const post = useMemo(() => guidePosts.find((p) => p.slug === slug), [slug]);

    const htmlContent = useMemo(() => {
        if (!post) return "";
        marked.use({ renderer: buildRenderer(), breaks: true, gfm: true });
        return marked.parse(post.content) as string;
    }, [post]);

    // Dynamic document title for basic SEO
    useEffect(() => {
        if (post) {
            document.title = `${post.title} | 프레임 레이더`;
        }
        return () => {
            document.title = "프레임 레이더";
        };
    }, [post]);

    if (!post) {
        return <Navigate to="/guide" replace />;
    }

    // JSON-LD Article schema
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.description,
        datePublished: post.date,
        image: post.thumbnail || undefined,
        keywords: post.keywords,
        author: { "@type": "Organization", name: "프레임 레이더" },
        publisher: { "@type": "Organization", name: "프레임 레이더" },
    };

    return (
        <div className="animate-rise">
            {/* Inject JSON-LD */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Meta tags injected via side effects (title above) */}

            <article className="max-w-3xl mx-auto">
                {/* Top back link */}
                <Link
                    to="/guide"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-primary transition-colors group mb-8"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                    </svg>
                    목록으로
                </Link>

                {/* Article Header */}
                <header className="mb-10">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                            </svg>
                            100% 활용법
                        </span>
                        {post.date && (
                            <time className="text-sm text-slate-400 font-medium">{formatDate(post.date)}</time>
                        )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-ink leading-tight mb-5">
                        {post.title}
                    </h1>

                    {post.description && (
                        <p className="text-[15px] text-slate-500 leading-relaxed bg-slate-50 rounded-xl px-5 py-4 italic border border-slate-200 border-l-4 border-l-primary/50">
                            {post.description}
                        </p>
                    )}



                    {/* Thumbnail */}
                    {post.thumbnail && (
                        <figure className="mt-8 guide-figure">
                            <img
                                src={post.thumbnail}
                                alt={post.title}
                                className="guide-img rounded-2xl"
                                onError={(e) => { (e.target as HTMLElement).parentElement!.style.display = "none"; }}
                            />
                        </figure>
                    )}
                </header>

                {/* Body */}
                <section
                    className="guide-body"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                />

                {/* Back button */}
                <footer className="mt-16 pt-8 border-t border-slate-100 flex items-center justify-between">
                    <Link
                        to="/guide"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors group"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                        </svg>
                        목록으로
                    </Link>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-sm font-semibold bg-primary text-white px-5 py-2.5 rounded-xl hover:bg-violet-700 transition-colors shadow-sm shadow-primary/20"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        지금 분석해보기
                    </Link>
                </footer>
            </article>
        </div>
    );
}
