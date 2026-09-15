// ---------------------------------------------------------------------------
// THE OTHER CANDIDATES, SO THE BENCHMARK CAN ACTUALLY COMPARE THEM.
//
// The model is not chosen in this repository. Claude is wired first because
// the build was written against it; these two exist so that
// `npm run bench -- --vendor=openai` and `--vendor=gemini` are a command
// rather than a piece of work, and so the decision is made on measured
// preservation instead of on reputation.
//
// DELIBERATELY THIN, AND DELIBERATELY WITHOUT SDKs. Each is one REST call
// against a published endpoint shape. A benchmark harness that pulled in two
// more vendor SDKs would have to be maintained for a decision that is taken
// once — and the adapters' only job is to turn a system prompt and a user turn
// into text.
//
// NOT VERIFIED AGAINST EITHER SERVICE. This environment has no keys for them.
// The shapes below are the documented ones; the first real run may need a
// field moved, and until somebody makes that run nothing here is a result.
// ---------------------------------------------------------------------------

import type { CompletionRequest, CompletionResult, LanguageModel } from './provider';

/** OpenAI's chat completions shape. */
export function openAIModel(options: { model?: string; apiKey?: string; endpoint?: string } = {}): LanguageModel {
  const model = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o';
  const key = options.apiKey ?? process.env.OPENAI_API_KEY;
  const endpoint = options.endpoint ?? process.env.OPENAI_ENDPOINT
    ?? 'https://api.openai.com/v1/chat/completions';

  return {
    id: model,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      if (!key) throw new Error('OPENAI_API_KEY is not set, so this model cannot be scored.');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_completion_tokens: request.maxTokens ?? 16000,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
      }

      const payload = await response.json() as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = payload.choices?.[0]?.message?.content?.trim() ?? '';
      if (!text) throw new Error('OpenAI returned nothing.');
      // Truncation is silent otherwise, and a script that stops two-thirds of
      // the way through reads as a finished script until somebody counts.
      if (payload.choices?.[0]?.finish_reason === 'length') {
        throw new Error('OpenAI ran out of room before finishing.');
      }

      return {
        text,
        producedBy: `${model} (OpenAI)`,
        usage: {
          inputTokens: payload.usage?.prompt_tokens,
          outputTokens: payload.usage?.completion_tokens,
        },
      };
    },
  };
}

/** Google's generateContent shape. */
export function geminiModel(options: { model?: string; apiKey?: string; endpoint?: string } = {}): LanguageModel {
  const model = options.model ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-pro';
  const key = options.apiKey ?? process.env.GEMINI_API_KEY;
  const endpoint = options.endpoint ?? process.env.GEMINI_ENDPOINT
    ?? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  return {
    id: model,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      if (!key) throw new Error('GEMINI_API_KEY is not set, so this model cannot be scored.');

      const response = await fetch(`${endpoint}?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: 'user', parts: [{ text: request.user }] }],
          generationConfig: { maxOutputTokens: request.maxTokens ?? 16000 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
      }

      const payload = await response.json() as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const candidate = payload.candidates?.[0];
      const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
      if (!text) throw new Error('Gemini returned nothing.');
      if (candidate?.finishReason === 'MAX_TOKENS') {
        throw new Error('Gemini ran out of room before finishing.');
      }

      return {
        text,
        producedBy: `${model} (Google)`,
        usage: {
          inputTokens: payload.usageMetadata?.promptTokenCount,
          outputTokens: payload.usageMetadata?.candidatesTokenCount,
        },
      };
    },
  };
}

export type Vendor = 'claude' | 'openai' | 'gemini';

/** Which of them the benchmark should score. */
export function modelFor(vendor: Vendor, model?: string): LanguageModel {
  switch (vendor) {
    case 'openai': return openAIModel({ model });
    case 'gemini': return geminiModel({ model });
    default: throw new Error('Claude is built by `ai/anthropic.ts`; ask the engine for it.');
  }
}
