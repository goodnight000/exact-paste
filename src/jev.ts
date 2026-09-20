import type { JevAnswers, JevAsk } from "./types";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const MODEL = "jev-1.13.0";

export function createAsk(apiKey: string): JevAsk {
  return async (state, questions, timeoutMs) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: MODEL, state, questions }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new Error(`Jev HTTP ${res.status}`);
      }
      const body = (await res.json()) as { answers?: JevAnswers };
      if (!body.answers || typeof body.answers !== "object") {
        throw new Error("Jev missing answers");
      }
      return body.answers;
    } finally {
      clearTimeout(timer);
    }
  };
}
