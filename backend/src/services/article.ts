import { sanitizeText } from "../utils/text.js";

interface FetchedArticle {
  title: string;
  content: string;
}

const MIN_CONTENT_LENGTH = 120;
const MIN_FALLBACK_CONTENT_LENGTH = 60;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_CONTENT_LENGTH = 12_000;
const STOP_LINE_PATTERNS: RegExp[] = [
  /많이\s*본\s*뉴스/u,
  /연관\s*기사/u,
  /관련\s*기사/u,
  /추천\s*기사/u,
  /By Taboola/i,
  /무단\s*전재/u,
  /Copyright/i,
  /뉴스레터/u,
  /기자\s*구독/u
];
const NOISE_LINE_PATTERNS: RegExp[] = [
  /^(?:\*|\-|\=){3,}$/,
  /^(?:로그인|회원가입|검색|메뉴|닫기|구독)$/u,
  /^(?:정치|경제|사회|국제|스포츠|문화(?:·연예)?|오피니언|연예|건강|라이프)(?:\s*[|/]\s*.*)?$/u,
  /^https?:\/\/\S+$/i,
  /^www\.\S+$/i
];
const CONTENT_NOISE_PATTERNS: RegExp[] = [
  /많이\s*본\s*뉴스/u,
  /By Taboola/i,
  /회원가입/u,
  /전체메뉴/u,
  /신문구독/u,
  /뉴스레터/u
];

interface CandidateQuality {
  score: number;
  noisy: boolean;
}

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const parsed = Number.parseInt(hex, 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _;
    });

const decodeJsonEscapes = (value: string): string =>
  value
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\\/g, "\\")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    );

const looksLikeHtml = (value: string): boolean =>
  /<!doctype html/i.test(value) || /<html[\s>]/i.test(value) || /<\/?[a-z][^>]*>/i.test(value);

const stripTags = (html: string): string =>
  decodeHtmlEntities(html)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const convertMarkdownToText = (value: string): string =>
  value
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*`_~]/g, " ")
    .replace(/\|/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const truncateContent = (content: string): string => {
  if (content.length <= MAX_CONTENT_LENGTH) {
    return content;
  }

  const slice = content.slice(0, MAX_CONTENT_LENGTH);
  const candidates = [".", "!", "?", "。", "！", "？"]
    .map((mark) => slice.lastIndexOf(mark))
    .sort((a, b) => b - a);
  const boundary = candidates[0] ?? -1;

  if (boundary > MAX_CONTENT_LENGTH * 0.7) {
    return sanitizeText(slice.slice(0, boundary + 1));
  }

  return sanitizeText(slice);
};

const normalizeExtractedContent = (value: string): string => {
  const prepared = value
    .replace(
      /(Title:|URL Source:|Published Time:|Markdown Content:)/gi,
      "\n$1 "
    )
    .replace(
      /(많이\s*본\s*뉴스|연관\s*기사|관련\s*기사|추천\s*기사|By Taboola|무단\s*전재|Copyright)/gi,
      "\n$1\n"
    )
    .replace(/(?<=[.!?。！？])\s+(?=[A-Z가-힣0-9"'(\[])/gu, "\n");

  const lines = prepared
    .split(/\r?\n/)
    .map((line) => decodeHtmlEntities(line))
    .map((line) => convertMarkdownToText(line))
    .map((line) => line.trim())
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (/^(title|url source|markdown content|published time|description|warning|error):/i.test(line)) {
      continue;
    }

    if (STOP_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
      if (deduped.length >= 3) {
        break;
      }
      continue;
    }

    if (NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
      continue;
    }

    const urlCount = line.match(/https?:\/\//g)?.length ?? 0;
    if (urlCount > 0 && line.length < 140) {
      continue;
    }

    if (line.length < 20 && !/[.!?。！？]/u.test(line)) {
      continue;
    }

    if (seen.has(line) && line.length < 100) {
      continue;
    }

    seen.add(line);
    deduped.push(line);
  }

  const normalized = truncateContent(sanitizeText(deduped.join("\n\n")));
  if (normalized.length >= 50) {
    return normalized;
  }

  // If aggressive cleanup removed too much, fall back to a softer normalization pass.
  return truncateContent(
    sanitizeText(
      convertMarkdownToText(decodeHtmlEntities(value))
        .replace(/(Title:|URL Source:|Published Time:|Markdown Content:)/gi, " ")
        .replace(/\s{2,}/g, " ")
    )
  );
};

const evaluateCandidateQuality = (content: string): CandidateQuality => {
  const paragraphCount = content.split(/\n{2,}/).filter(Boolean).length;
  const sentenceCount = content.match(/[.!?。！？]/gu)?.length ?? 0;
  const longParagraphCount = content
    .split(/\n{2,}/)
    .filter((line) => line.trim().length >= 180).length;
  const linkCount = content.match(/https?:\/\//g)?.length ?? 0;
  const noiseHits = CONTENT_NOISE_PATTERNS.reduce(
    (sum, pattern) => sum + (pattern.test(content) ? 1 : 0),
    0
  );

  const score =
    Math.min(content.length / 350, 14) +
    paragraphCount * 0.6 +
    sentenceCount * 0.8 +
    longParagraphCount * 2 -
    linkCount * 0.7 -
    noiseHits * 2.5;

  const noisy =
    content.length < MIN_FALLBACK_CONTENT_LENGTH ||
    (longParagraphCount === 0 && sentenceCount < 3) ||
    (linkCount >= 12 && paragraphCount < 5) ||
    noiseHits >= 3 ||
    score < 2;

  return { score, noisy };
};

const buildFetchCandidates = (url: string): string[] => {
  const normalized = url.replace(/^https?:\/\//i, "");
  return [url, `https://r.jina.ai/http://${normalized}`];
};

const fetchWithTimeout = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        "User-Agent": "RageCheckBot/1.0",
        Accept: "text/html, text/plain;q=0.9,*/*;q=0.8"
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

const extractFromHtml = (html: string): FetchedArticle => {
  const titleMatch =
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = decodeHtmlEntities(titleMatch?.[1] ?? "")
    .replace(/\s+/g, " ")
    .trim() || "Untitled Article";

  const articleBodyMatches = Array.from(
    html.matchAll(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/g)
  );
  const articleBodyText = articleBodyMatches
    .map((match) => decodeJsonEscapes(match[1] ?? ""))
    .map((line) => normalizeExtractedContent(line))
    .filter((line) => line.length > 40)
    .join("\n\n");

  const articleTagMatches = Array.from(html.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi));
  const articleTagText = articleTagMatches
    .map((match) => stripTags(match[1] ?? ""))
    .map((line) => normalizeExtractedContent(line))
    .filter((line) => line.length > 80)
    .join("\n\n");

  const paragraphMatches = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi));
  const paragraphText = paragraphMatches
    .map((match) => stripTags(match[1] ?? ""))
    .map((line) => normalizeExtractedContent(line))
    .filter((line) => line.length > 30)
    .join("\n\n");

  const descriptionMatch = html.match(
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  const descriptionText = normalizeExtractedContent(
    sanitizeText(decodeHtmlEntities(descriptionMatch?.[1] ?? ""))
  );

  const fallbackText = normalizeExtractedContent(stripTags(html));
  const contentCandidates = [
    articleBodyText,
    articleTagText,
    paragraphText,
    descriptionText,
    fallbackText
  ]
    .map((item) => normalizeExtractedContent(item))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const content = contentCandidates[0] ?? "";

  return { title, content };
};

const extractFromPlainText = (text: string): FetchedArticle => {
  const decodedText = decodeHtmlEntities(text);
  const titleFromHeader =
    decodedText.match(
      /(?:^|\n)\s*Title:\s*([^\n\r]+?)(?=\s*(?:URL Source:|Published Time:|Markdown Content:|$))/i
    )?.[1] ?? "";

  const title = sanitizeText(titleFromHeader)
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  let bodyText = decodedText;
  const markdownMarker = decodedText.search(/markdown content:/i);
  if (markdownMarker >= 0) {
    bodyText = decodedText.slice(markdownMarker);
    bodyText = bodyText.replace(/^[\s\S]*?markdown content:\s*/i, "");
  } else {
    bodyText = bodyText.replace(
      /\b(?:Title|URL Source|Published Time|Description):\s*[^\n\r]*/gi,
      " "
    );
  }

  const rawLines = bodyText
    .split(/\r?\n/)
    .map((line) => decodeHtmlEntities(line).trim())
    .filter(Boolean);

  const contentLines = rawLines
    .map((line) => convertMarkdownToText(line))
    .filter(Boolean)
    .filter(
    (line) =>
      !/^(title|url source|markdown content|published time|description|warning|error):/i.test(line)
    );

  const normalizedContent = normalizeExtractedContent(contentLines.join("\n\n"));

  return {
    title: title || "Untitled Article",
    content: normalizedContent
  };
};

const extractArticle = (body: string): FetchedArticle =>
  looksLikeHtml(body) ? extractFromHtml(body) : extractFromPlainText(body);

export const fetchArticleFromUrl = async (url: string): Promise<FetchedArticle> => {
  const candidates = buildFetchCandidates(url);
  let bestAttempt: FetchedArticle | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let lastError = "";

  for (const candidate of candidates) {
    let response: Response;

    try {
      response = await fetchWithTimeout(candidate);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown fetch error";
      lastError = `${candidate} fetch 실패: ${message}`;
      continue;
    }

    if (!response.ok) {
      lastError = `${candidate} 응답 코드 ${response.status}`;
      continue;
    }

    const body = await response.text();
    const extracted = extractArticle(body);
    const quality = evaluateCandidateQuality(extracted.content);

    if (quality.score > bestScore || (quality.score === bestScore && extracted.content.length > (bestAttempt?.content.length ?? 0))) {
      bestAttempt = extracted;
      bestScore = quality.score;
    }

    if (extracted.content.length >= MIN_CONTENT_LENGTH && !quality.noisy) {
      return extracted;
    }
  }

  if (bestAttempt && bestAttempt.content.length >= MIN_CONTENT_LENGTH && bestScore > -8) {
    return bestAttempt;
  }

  if (bestAttempt && bestAttempt.content.length >= MIN_FALLBACK_CONTENT_LENGTH && bestScore >= 0) {
    return bestAttempt;
  }

  throw new Error(
    lastError
      ? "URL 본문 추출이 지연되거나 차단되었습니다. 기사 본문을 붙여넣어 분석해 주세요."
      : "URL에서 읽을 수 있는 본문을 충분히 추출하지 못했습니다. 기사 본문을 붙여넣어 분석해 주세요."
  );
};
