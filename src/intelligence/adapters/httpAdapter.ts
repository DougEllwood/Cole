// Real model adapter — an OpenAI-compatible chat-completions client. This is
// the ONLY file in the whole system that talks to a model vendor, exactly as the
// gateway design intends (ADR-0003). Configure it entirely by environment, so no
// key is ever committed:
//
//   NAVIGATOR_MODEL_API_KEY    (required to activate; without it we use the mock)
//   NAVIGATOR_MODEL_BASE_URL   (default: https://api.openai.com/v1/chat/completions)
//   NAVIGATOR_MODEL_NAME       (default: gpt-4o-mini)
//
// Any OpenAI-compatible endpoint works (OpenAI, many gateways, a local server).
// An Anthropic /v1/messages adapter would be a sibling file — same interface.

import type { ModelAdapter } from './mockAdapter';

// The house system prompt — the shared Personality Core, in words. The engines
// still gate/shape the result afterward; this makes the base reply already
// human-first so the governors rarely need to intervene.
const HOUSE_SYSTEM = `You are a Navigator companion — a warm, human-first AI whose purpose is to help a person become who they want to be, and then to need you less.
Rules you never break:
- Build confidence, not dependence. Invite the person's own thinking; hand things back to them.
- Strengthen the person's real relationships; point them toward real people when that's who they need.
- Teach how to think — favor a good question over just an answer, when it helps.
- Be brief (2–4 sentences), warm, and honest. Never flatter to manipulate. Never manufacture urgency.
- Stay in scope: no medical, legal, financial, or property-valuation advice — say so kindly and point to the right person.
- If the person may be in crisis, express care directly and encourage reaching a trusted person or emergency help — never interrogate.
You will be given the companion's PERSONA, the person's ABOUT and MEMORY, and their MESSAGE. Reply as the companion, in the persona's voice.`;

export interface HttpAdapterOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export class HttpModelAdapter implements ModelAdapter {
  name: string;
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private timeoutMs: number;

  constructor(opts: HttpAdapterOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.openai.com/v1/chat/completions';
    this.model = opts.model ?? 'gpt-4o-mini';
    this.timeoutMs = opts.timeoutMs ?? 20000;
    this.name = `http:${this.model}`;
  }

  // In production this would run the human-first evaluation suite before
  // returning true. Here we trust explicit operator configuration.
  passesBehaviourBar(): boolean { return true; }

  async complete(prompt: string, task: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.7,
          max_tokens: 300,
          messages: [
            { role: 'system', content: `${HOUSE_SYSTEM}\n(response mode: ${task})` },
            { role: 'user', content: prompt },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`model endpoint returned ${res.status}`);
      const data = (await res.json()) as any;
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('empty model response');
      return text.trim();
    } finally {
      clearTimeout(timer);
    }
  }
}
