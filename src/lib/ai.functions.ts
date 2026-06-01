import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  workers: z.array(z.record(z.string(), z.unknown())).max(200),
  attendance: z.array(z.record(z.string(), z.unknown())).max(500),
  payroll: z.array(z.record(z.string(), z.unknown())).max(200),
  projects: z.array(z.record(z.string(), z.unknown())).max(100),
  currency: z.string().max(8).default("USD"),
});

export const generateInsights = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI is not configured. Please set the OPENAI_API_KEY environment variable." };
    }

    const prompt = `You are an enterprise workforce analyst. Given this snapshot of a company's workforce data, produce a concise executive briefing in clean Markdown with these sections (use ## headings):

## Executive Summary
2-3 sentences on overall health.

## Payroll Forecast
Project next month's total payroll spend. Show the number with currency ${data.currency}.

## Attendance Anomalies
List up to 5 workers with concerning attendance patterns (drops, missed shifts). If none, say so.

## Attrition Risk
List up to 5 workers who appear at risk of leaving, with one-line rationale.

## Recommendations
3 bullet points of concrete actions.

DATA (JSON):
Workers: ${JSON.stringify(data.workers).slice(0, 8000)}
Attendance (recent): ${JSON.stringify(data.attendance).slice(0, 8000)}
Payroll: ${JSON.stringify(data.payroll).slice(0, 6000)}
Projects: ${JSON.stringify(data.projects).slice(0, 4000)}

Keep total length under 600 words. Use concrete numbers from the data.`;

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a precise workforce analytics assistant. Always reply in Markdown." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (res.status === 429) {
        return { ok: false as const, error: "Rate limit reached. Try again in a minute." };
      }
      if (res.status === 402) {
        return { ok: false as const, error: "OpenAI credits exhausted. Please check your API key billing." };
      }
      if (!res.ok) {
        const t = await res.text();
        console.error("OpenAI error", res.status, t);
        return { ok: false as const, error: `AI error (${res.status})` };
      }

      const json = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? "No response.";
      return { ok: true as const, text };
    } catch (err) {
      console.error("AI fetch error", err);
      return { ok: false as const, error: "Failed to reach AI service." };
    }
  });
