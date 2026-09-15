// ---------------------------------------------------------------------------
// THE CLAUDE ADAPTER. SERVER ONLY.
//
// THE KEY NEVER REACHES A BROWSER. Nothing in this file is imported by a
// client component; every call arrives through a route under /api, and
// `ANTHROPIC_API_KEY` is read from the server environment. A key prefixed
// NEXT_PUBLIC_ would be printed into the JavaScript bundle and read by every
// student on the course.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import type { CompletionRequest, CompletionResult, LanguageModel } from './provider';

/**
 * The transformations are long — a corrected lecture text runs to thousands of
 * words — so every call streams and the final message is read at the end.
 * A non-streaming request at this size risks an HTTP timeout, and a
 * transformation that dies at minute nine has cost the money anyway.
 */
const MODEL = process.env.ACADEMIC_AI_MODEL ?? 'claude-opus-5';

export function anthropicModel(apiKey?: string): LanguageModel {
  const client = new Anthropic(apiKey ? { apiKey } : {});

  return {
    id: MODEL,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: request.maxTokens ?? 32000,
        // Adaptive thinking: the correction pass has to decide what a
        // mis-heard word was meant to be, and the extraction pass has to
        // decide what a lecture actually teaches. Both are judgement.
        thinking: { type: 'adaptive' },
        output_config: { effort: request.effort ?? 'high' },
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
      });

      const message = await stream.finalMessage();

      // A refusal is an HTTP 200 with nothing in it. Reading `content[0].text`
      // without checking gives the lecturer an empty artefact and no reason.
      if (message.stop_reason === 'refusal') {
        const why = message.stop_details && 'explanation' in message.stop_details
          ? String(message.stop_details.explanation)
          : 'no explanation given';
        throw new Error(`The model declined this material (${why}).`);
      }

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();

      if (!text) throw new Error('The model returned nothing.');

      // Truncation is silent otherwise: a 2,100-word script that stops at
      // 1,400 words reads as a finished script until somebody counts.
      if (message.stop_reason === 'max_tokens') {
        throw new Error('The model ran out of room before finishing. Try a shorter source.');
      }

      return { text, producedBy: `${message.model} (Anthropic)` };
    },
  };
}

/** Is a live model configured at all? Settings shows the answer. */
export function anthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY || !!process.env.ANTHROPIC_AUTH_TOKEN;
}
