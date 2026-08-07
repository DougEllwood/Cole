// Voice & Personality Engine (Layer 2) — HOW the companion expresses itself.
// Delivery only, never content. Shared Core (guardrails) + per-Navigator overlay.
// "One soul, many voices." docs/architecture/engines/04-voice-personality-engine.md

import type { VoicePersonalityEngine } from '../../shared/contracts';
import type { Persona } from '../../shared/types';

// The Personality Core's non-negotiable delivery rules (cannot be tuned away):
// no manufactured urgency, no guilt, no flattery-as-manipulation.
const MANIPULATIVE = [/\bhurry\b/gi, /\bright now or\b/gi, /\byou'll regret\b/gi, /!!+/g];

export class VoicePersonalityEngineImpl implements VoicePersonalityEngine {
  render(text: string, persona: Persona): string {
    let out = text;
    // Enforce the core guardrails first — delivery may never manipulate.
    for (const re of MANIPULATIVE) out = out.replace(re, '');
    out = out.replace(/\s{2,}/g, ' ').trim();

    // Apply the per-Navigator overlay (tone), not the content.
    if (persona.warmth === 'calm') {
      out = out.replace(/!/g, '.'); // Appraiser-style: precise and calm
    }
    return out;
  }
}
