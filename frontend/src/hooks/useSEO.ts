/**
 * useSEO — 동적 SEO 메타 태그 관리 훅
 * 
 * SPA에서 페이지별로 <title>, <meta>, OG/Twitter 태그,
 * canonical, JSON-LD 구조화 데이터를 동적으로 업데이트합니다.
 */

import { useEffect } from "react";

export interface SEOOptions {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  articlePublishedTime?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}

const SITE_NAME = "프레임 레이더";
const BASE_URL = "https://frameradar.faithfwd.cc";
const DEFAULT_DESCRIPTION =
  "프레임 레이더는 기사나 글에 숨겨진 의도와 프레임을 분석하여 비판적 읽기를 돕는 AI 서비스입니다.";

function setMeta(
  selector: string,
  attribute: string,
  content: string
): void {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    // attribute는 "property" 또는 "name"
    const attrName = selector.includes("[property=") ? "property" : "name";
    const attrValue = selector
      .replace(/\[property="?/, "")
      .replace(/\[name="?/, "")
      .replace(/"?\]/, "");
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute(attribute, content);
}

function setCanonical(url: string): void {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", url);
}

function setJsonLd(data: Record<string, unknown>): () => void {
  const id = "seo-json-ld";
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);

  return () => {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
  };
}

export function useSEO(options: SEOOptions): void {
  useEffect(() => {
    const {
      title,
      description = DEFAULT_DESCRIPTION,
      canonical,
      ogTitle,
      ogDescription,
      ogImage,
      ogType = "website",
      articlePublishedTime,
      noindex = false,
      jsonLd,
    } = options;

    // 1. <title>
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;

    // 2. 기본 meta
    setMeta('meta[name="description"]', "content", description);
    setMeta(
      'meta[name="robots"]',
      "content",
      noindex ? "noindex, nofollow" : "index, follow"
    );

    // 3. OG
    setMeta('meta[property="og:type"]', "content", ogType);
    setMeta(
      'meta[property="og:title"]',
      "content",
      ogTitle ?? fullTitle
    );
    setMeta(
      'meta[property="og:description"]',
      "content",
      ogDescription ?? description
    );
    setMeta(
      'meta[property="og:url"]',
      "content",
      canonical ?? `${BASE_URL}${window.location.pathname}`
    );
    setMeta('meta[property="og:site_name"]', "content", SITE_NAME);
    if (ogImage) {
      setMeta('meta[property="og:image"]', "content", ogImage);
      setMeta('meta[property="og:image:width"]', "content", "1200");
      setMeta('meta[property="og:image:height"]', "content", "630");
    }
    if (ogType === "article" && articlePublishedTime) {
      setMeta(
        'meta[property="article:published_time"]',
        "content",
        articlePublishedTime
      );
    }

    // 4. Twitter Card
    setMeta('meta[name="twitter:card"]', "content", ogImage ? "summary_large_image" : "summary");
    setMeta(
      'meta[property="twitter:title"]',
      "content",
      ogTitle ?? fullTitle
    );
    setMeta(
      'meta[property="twitter:description"]',
      "content",
      ogDescription ?? description
    );
    if (ogImage) {
      setMeta('meta[property="twitter:image"]', "content", ogImage);
    }

    // 5. Canonical
    setCanonical(
      canonical ?? `${BASE_URL}${window.location.pathname}`
    );

    // 6. JSON-LD
    let cleanupJsonLd: (() => void) | undefined;
    if (jsonLd) {
      cleanupJsonLd = setJsonLd(jsonLd);
    }

    return () => {
      // 페이지 이탈 시 JSON-LD 정리
      cleanupJsonLd?.();
    };
  }, [
    options.title,
    options.description,
    options.canonical,
    options.ogTitle,
    options.ogDescription,
    options.ogImage,
    options.ogType,
    options.articlePublishedTime,
    options.noindex,
    options.jsonLd,
  ]);
}
