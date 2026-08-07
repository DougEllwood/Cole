// The Intelligence Gateway (Layer 1) — vendor-neutral. Every engine reaches
// intelligence through here, never through a model SDK. Owns routing, fallback,
// and the behaviour-bar check. (ADR-0003, docs/architecture/30-shared-platform-architecture.md)

import type { IntelligenceGateway } from '../shared/contracts';
import type { ModelAdapter } from './adapters/mockAdapter';

export class Gateway implements IntelligenceGateway {
  private primary: ModelAdapter;
  private fallback?: ModelAdapter;

  constructor(primary: ModelAdapter, fallback?: ModelAdapter) {
    // A model is not adopted until it passes the human-first behaviour bar.
    if (!primary.passesBehaviourBar()) {
      throw new Error(`Model ${primary.name} failed the human-first behaviour bar; refusing to adopt.`);
    }
    this.primary = primary;
    this.fallback = fallback;
  }

  activeModel(): string {
    return this.primary.name;
  }

  async generate(prompt: string, task: string): Promise<string> {
    try {
      return await this.primary.complete(prompt, task);
    } catch (err) {
      if (this.fallback) return this.fallback.complete(prompt, task);
      throw err;
    }
  }
}
