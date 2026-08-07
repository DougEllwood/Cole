// Scope Registry (kernel) — holds each Navigator's scope boundaries. Verticals
// register their rules here at composition; the Ethics governor reads from it,
// so scope is config-driven, not hardcoded into the engine.
// docs/architecture/engines/07-ethics-engine.md (scope enforcement)

import type { NavigatorId, ScopeRule } from '../shared/types';

export class ScopeRegistry {
  private rules = new Map<NavigatorId, ScopeRule[]>();

  register(navigatorId: NavigatorId, rules: ScopeRule[]): void {
    this.rules.set(navigatorId, rules);
  }

  outOfScope(message: string, navigatorId: NavigatorId): string | undefined {
    const m = message.toLowerCase();
    for (const r of this.rules.get(navigatorId) ?? []) {
      if (r.cues.some((c) => m.includes(c))) return r.boundary;
    }
    return undefined;
  }
}
