// Text endpoints: call summary and insights, both structured output from the Flash model (shared/ai-core.ts).
import type { AiResponse, InsightsRequest, InsightsResult, SummarizeRequest, SummaryResult } from "../../shared/ai-types";
import { insights, summarize } from "../../shared/ai-core";
import { AI } from "./config";
import { geminiClient, logUsage, withRetry } from "./gemini";

export async function summarizeCall(req: SummarizeRequest, user: string): Promise<AiResponse<SummaryResult>> {
  const r = await withRetry("summarize", () => summarize(geminiClient(), AI.textModel, req));
  logUsage("summarize", r.usage, { user: user.slice(0, 24), chars: req.text.length });
  return r;
}

export async function callInsights(req: InsightsRequest, user: string): Promise<AiResponse<InsightsResult>> {
  const r = await withRetry("insights", () => insights(geminiClient(), AI.textModel, req));
  logUsage("insights", r.usage, { user: user.slice(0, 24), chars: req.text.length });
  return r;
}
