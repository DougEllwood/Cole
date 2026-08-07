// Voice out — text-to-speech behind the gateway idea (ADR-0003 applies to voice
// too). Provider is chosen by which key is present; ElevenLabs is preferred.
// With NO key, synth() returns null and the client falls back to the browser's
// built-in voice — so voice always works, and a lifelike voice switches on with
// a key.
//
// ElevenLabs (recommended):
//   ELEVENLABS_API_KEY        (required to activate)
//   ELEVENLABS_VOICE_ID       (the voice to speak as — pick one in your account)
//   ELEVENLABS_MODEL_ID       (default: eleven_turbo_v2_5 — fast + natural)
//
// OpenAI-compatible TTS (fallback option):
//   NAVIGATOR_TTS_API_KEY, NAVIGATOR_TTS_BASE_URL, NAVIGATOR_TTS_MODEL, NAVIGATOR_TTS_VOICE

export interface VoiceSynth {
  contentType: string;
  describe(): string;
  synth(text: string): Promise<Buffer | null>; // null => caller uses browser voice
}

const BROWSER_FALLBACK: VoiceSynth = {
  contentType: 'audio/mpeg',
  describe: () => 'browser voice (set ELEVENLABS_API_KEY for a lifelike voice)',
  synth: async () => null,
};

export function buildVoice(): VoiceSynth {
  if (process.env.ELEVENLABS_API_KEY) return elevenLabs();
  if (process.env.NAVIGATOR_TTS_API_KEY) return openAiCompatible();
  return BROWSER_FALLBACK;
}

// ---- ElevenLabs ----
function elevenLabs(): VoiceSynth {
  const key = process.env.ELEVENLABS_API_KEY!;
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM'; // a default; set your own
  const modelId = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_turbo_v2_5';
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  return {
    contentType: 'audio/mpeg',
    describe: () => `ElevenLabs (${modelId} · voice ${voiceId})`,
    async synth(text: string): Promise<Buffer | null> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
          }),
          signal: controller.signal,
        });
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
      } catch {
        return null; // any failure → graceful fall back to browser voice
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ---- OpenAI-compatible /v1/audio/speech ----
function openAiCompatible(): VoiceSynth {
  const key = process.env.NAVIGATOR_TTS_API_KEY!;
  const baseUrl = process.env.NAVIGATOR_TTS_BASE_URL ?? 'https://api.openai.com/v1/audio/speech';
  const model = process.env.NAVIGATOR_TTS_MODEL ?? 'gpt-4o-mini-tts';
  const voiceName = process.env.NAVIGATOR_TTS_VOICE ?? 'alloy';

  return {
    contentType: 'audio/mpeg',
    describe: () => `neural voice (${model} · ${voiceName})`,
    async synth(text: string): Promise<Buffer | null> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, voice: voiceName, input: text, format: 'mp3' }),
          signal: controller.signal,
        });
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
