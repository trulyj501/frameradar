import {
  AnalysesResponse,
  AnalysisResponse,
  LeaderboardResponse,
  UsageResponse
} from "../types/api";

const resolveApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (import.meta.env.DEV) {
    return "/api";
  }

  return "http://localhost:4000/api";
};

const API_BASE_URL = resolveApiBaseUrl();

interface AnalyzePayload {
  title?: string;
  url?: string;
  text?: string;
}

const buildNetworkErrorMessage = (baseUrl: string): string => {
  const startHint =
    "백엔드 서버가 실행 중인지 확인해 주세요. (권장: 프로젝트 루트에서 `npm run dev`)";
  const endpointHint = `현재 API 주소: ${baseUrl}`;

  if (typeof window !== "undefined" && window.location.protocol === "https:" && baseUrl.startsWith("http://")) {
    return `보안 페이지(https)에서 비보안 API(http)를 호출해 차단되었습니다. ${endpointHint}`;
  }

  return `네트워크 요청에 실패했습니다. ${startHint} ${endpointHint}`;
};

const request = async <T>(
  path: string,
  init?: RequestInit,
  options?: { timeoutMs?: number }
): Promise<T> => {
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      ...init
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "분석 응답이 지연되고 있습니다. 잠시 후 다시 시도하거나 기사 본문을 직접 붙여넣어 주세요."
      );
    }
    throw new Error(buildNetworkErrorMessage(API_BASE_URL));
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const fallbackMessage = `요청에 실패했습니다. (상태 코드: ${response.status})`;
    let message = fallbackMessage;
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    if (contentType.includes("application/json")) {
      try {
        const payload = (await response.json()) as { error?: string };
        if (payload.error) {
          message = payload.error;
        }
      } catch {
        // Keep fallback message when JSON parsing fails.
      }
    } else if (response.status >= 500 && API_BASE_URL.startsWith("/")) {
      message =
        "백엔드 서버에 연결하지 못했습니다. 프로젝트 루트에서 `npm run dev`로 백엔드와 프론트를 함께 실행해 주세요.";
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
};

export const analyzeArticle = (payload: AnalyzePayload): Promise<AnalysisResponse> =>
  request<AnalysisResponse>("/analyze", {
    method: "POST",
    body: JSON.stringify(payload)
  }, {
    timeoutMs: 90_000
  });

export const fetchRecentAnalyses = (): Promise<AnalysesResponse> =>
  request<AnalysesResponse>("/analyses?limit=20");

export const fetchAnalysisById = (id: string): Promise<AnalysisResponse> =>
  request<AnalysisResponse>(`/analyses/${id}`);

export const fetchLeaderboard = (range: "7d" | "all"): Promise<LeaderboardResponse> =>
  request<LeaderboardResponse>(`/leaderboard?range=${range}`);

export const fetchUsageStatus = (): Promise<UsageResponse> =>
  request<UsageResponse>("/usage");
