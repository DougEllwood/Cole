// Speech-to-text — turns recorded audio into text using ElevenLabs (Scribe).
// This replaces the browser's built-in speech recognition, which is unreliable
// on iPhones. Recording happens in the browser (works on iOS); the transcription
// happens here. Uses the same ELEVENLABS_API_KEY as the voice.

export interface Stt {
  enabled(): boolean;
  describe(): string;
  transcribe(bytes: Buffer, contentType: string): Promise<string | null>;
}

export function buildStt(): Stt {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return { enabled: () => false, describe: () => 'no speech-to-text (set ELEVENLABS_API_KEY)', transcribe: async () => null };
  }
  const model = process.env.ELEVENLABS_STT_MODEL ?? 'scribe_v1';
  return {
    enabled: () => true,
    describe: () => `ElevenLabs speech-to-text (${model})`,
    async transcribe(bytes: Buffer, contentType: string): Promise<string | null> {
      const ext = contentType.includes('mp4') || contentType.includes('m4a') ? 'mp4'
        : contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3'
        : contentType.includes('ogg') ? 'ogg'
        : contentType.includes('wav') ? 'wav'
        : 'webm';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const form = new FormData();
        form.append('model_id', model);
        form.append('file', new Blob([bytes], { type: contentType || 'audio/webm' }), `speech.${ext}`);
        const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: { 'xi-api-key': key }, // fetch sets the multipart boundary itself
          body: form,
          signal: controller.signal,
        });
        if (!res.ok) return null;
        const data: any = await res.json();
        const text = data?.text ?? data?.transcript ?? '';
        return typeof text === 'string' ? text.trim() : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
