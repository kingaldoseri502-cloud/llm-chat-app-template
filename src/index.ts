import type { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
const SYSTEM_PROMPT = "You are NOVA AI, a helpful, honest and friendly general-purpose AI assistant. Respond naturally in the user's language, including Arabic and Gulf Arabic. Explain clearly, ask clarifying questions only when necessary, and acknowledge uncertainty. Never invent facts or claim to have performed actions you did not perform. Format answers clearly when helpful.";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, service: "NOVA AI", aiConfigured: Boolean(env.AI) });
    }
    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) return json({ error: "Cross-origin requests are not allowed" }, 403);
      if (!env.AI) return json({ error: "Workers AI binding is missing" }, 503);
      const length = Number(request.headers.get("content-length") || 0);
      if (length > 40000) return json({ error: "Request is too large" }, 413);
      try {
        const rawText = await request.text();
        if (rawText.length > 40000) return json({ error: "Request is too large" }, 413);
        const payload = JSON.parse(rawText) as { messages?: unknown };
        if (!Array.isArray(payload.messages)) return json({ error: "Messages must be an array" }, 400);
        const valid = payload.messages.filter(
          (entry: unknown): entry is ChatMessage =>
            typeof entry === "object" && entry !== null &&
            ("role" in entry) && ("content" in entry) &&
            (entry.role === "user" || entry.role === "assistant") &&
            typeof entry.content === "string" &&
            entry.content.trim().length > 0 && entry.content.length <= 4000
        );
        if (valid.length === 0 || payload.messages.length > 60 || valid.length !== payload.messages.length || valid.at(-1)?.role !== "user") {
          return json({ error: "Invalid chat messages" }, 400);
        }
        const messages: ChatMessage[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...valid.slice(-16).map((msg) => ({ role: msg.role, content: msg.content })),
        ];
        const stream = await env.AI.run<typeof MODEL_ID>(MODEL_ID, {
          messages,
          max_tokens: 1200,
          stream: true,
        } satisfies AiTextGenerationInput & { stream: true });
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            "x-content-type-options": "nosniff",
            "x-accel-buffering": "no",
          },
        });
      } catch (error) {
        console.error("NOVA chat error", error);
        if (error instanceof SyntaxError) return json({ error: "Invalid JSON" }, 400);
        return json({ error: "AI service is unavailable. Please try again." }, 503);
      }
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
