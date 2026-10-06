// Request/response shapes shared by the AI backend (server/) and the React app (src/).

/** Who is calling, appended to the system prompt server-side (short, plain values only). */
export interface CallerContext { residentName?: string; unitLabel?: string; siteName?: string; inDlp?: boolean }
export interface LiveTokenRequest { userId: string; userName?: string; role?: string; lang: "en" | "ar"; caller?: CallerContext }
export interface LiveTokenResponse {
  token: string;              // ephemeral token name, used as the apiKey by the browser
  model: string;              // the model the token is locked to
  apiVersion: string;         // the API version the browser must connect with
  expiresAt: string;          // session messages rejected after this
  newSessionBy: string;       // the session must start before this
  voiceName: string;
}

export interface SummarizeRequest { text: string; lang?: "en" | "ar"; context?: string }
export interface SummaryResult { summary: string; keyPoints: string[]; actionItems: string[]; openQuestions: string[] }

export interface InsightsRequest { text: string; lang?: "en" | "ar"; context?: string }
export interface InsightsResult {
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  sentimentReason: string;
  intents: string[];
  topics: string[];
  issuesRaised: Array<{ issue: string; severity: "low" | "medium" | "high" }>;
  suggestedFollowUps: string[];
}

export interface UsageNote { model: string; inputTokens?: number; outputTokens?: number; totalTokens?: number }
export interface AiResponse<T> { result: T; usage: UsageNote }

export interface AiSettings { voiceSystemPrompt: string; updatedBy?: string; updatedAt?: string }
export interface ApiError { error: string; code: "unauthorized" | "rate_limited" | "bad_request" | "upstream" | "misconfigured" | "not_found" }
