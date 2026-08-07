// Gateway factory — chooses the real model when a key is present, otherwise the
// deterministic mock, so the system always runs. The real model is PRIMARY with
// the mock as FALLBACK, so a transient model outage degrades gracefully instead
// of failing the person. (ADR-0003)

import type { IntelligenceGateway } from '../shared/contracts';
import { Gateway } from './gateway';
import { MockAdapter } from './adapters/mockAdapter';
import { HttpModelAdapter } from './adapters/httpAdapter';

export function buildGateway(): IntelligenceGateway {
  const apiKey = process.env.NAVIGATOR_MODEL_API_KEY;
  if (!apiKey) {
    return new Gateway(new MockAdapter());
  }
  const real = new HttpModelAdapter({
    apiKey,
    baseUrl: process.env.NAVIGATOR_MODEL_BASE_URL,
    model: process.env.NAVIGATOR_MODEL_NAME,
  });
  return new Gateway(real, new MockAdapter());
}

export function activeModelDescription(): string {
  return process.env.NAVIGATOR_MODEL_API_KEY
    ? `real model (${process.env.NAVIGATOR_MODEL_NAME ?? 'gpt-4o-mini'})`
    : 'mock model (no key set — set NAVIGATOR_MODEL_API_KEY to go live)';
}
