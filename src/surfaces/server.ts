// Navigator OS — web server surface (Layer 5). One persistent NavigatorOS for
// Kane (Campus Navigator), served over a tiny JSON API plus the voice UI. Uses
// the env-selected gateway: real model when NAVIGATOR_MODEL_API_KEY is set,
// deterministic mock otherwise. Node built-ins only — no external deps.
//
//   run:  npm run serve      (then open http://localhost:4173)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NavigatorOS } from '../navigators/navigatorOS';
import { CAMPUS_CONFIG } from '../navigators/campus/config';
import { buildStores } from '../kernel/storeFactory';
import { buildGateway, activeModelDescription } from '../intelligence/buildGateway';
import { buildVoice } from '../intelligence/voice';
import { buildStt } from '../intelligence/stt';
import { buildKeepsakeHTML, deleteConversation, getKaneMemoryFast, memoryIsStale, refreshKaneMemory } from './keepsake';
import type { Journey } from '../shared/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4173);
const PERSON = 'kane';
const NAV = 'campus';

// ---- one platform instance, persistent ----
const dataDir = join(process.cwd(), 'data');
const stores = await buildStores(dataDir); // top-level await (ESM)
const os = new NavigatorOS(undefined, buildGateway(), stores.events, stores.blobs).registerVertical(CAMPUS_CONFIG);
const voice = buildVoice();
const stt = buildStt();

// Onboard Kane once (first run), and open a first chapter.
if (os.exportPerson(PERSON).events.length === 0) {
  os.onboard(PERSON, NAV, { name: 'Kane', program: 'Media & Information', year: 1 });
  os.openChapter(PERSON, NAV, 'First Week', 'University');
}

function ensureChapter(title: string, journey: Journey = 'University'): string {
  const found = os.story(PERSON).find((s) => s.chapter.title.toLowerCase() === title.toLowerCase());
  return found ? found.chapter.chapterId : os.openChapter(PERSON, NAV, title, journey);
}

// ---- helpers ----
function send(res: ServerResponse, code: number, body: unknown, type = 'application/json') {
  const payload = type === 'application/json' ? JSON.stringify(body) : String(body);
  res.writeHead(code, { 'content-type': type });
  res.end(payload);
}
function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}
function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  try {
    if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
      let html = readFileSync(join(HERE, 'web', 'index.html'), 'utf8');
      // Hand Cole the latest memory of Kane (never blocks the page — refresh runs in background).
      html = html.replace('"__KANE_MEMORY__"', JSON.stringify(getKaneMemoryFast()));
      if (memoryIsStale()) refreshKaneMemory().catch(() => {});
      return send(res, 200, html, 'text/html; charset=utf-8');
    }

    // Peek at what Cole currently remembers about Kane (for checking).
    if (req.method === 'GET' && path === '/api/memory') {
      if (memoryIsStale()) await refreshKaneMemory();
      return send(res, 200, { memory: getKaneMemoryFast() });
    }

    // The Story of Kane — a personal copy of the event, organized by title and date.
    if (req.method === 'GET' && (path === '/keepsake' || path === '/keepsake.html')) {
      const debug = url.searchParams.get('debug') === '1';
      const edit = url.searchParams.get('edit') === '1';
      const html = await buildKeepsakeHTML({ debug, edit });
      return send(res, 200, html, 'text/html; charset=utf-8');
    }

    // Remove a single conversation (used by the keepsake edit mode).
    if (req.method === 'POST' && path === '/api/keepsake/delete') {
      const { id } = await readBody(req);
      if (!id) return send(res, 400, { ok: false, error: 'no id' });
      const result = await deleteConversation(String(id));
      return send(res, result.ok ? 200 : 502, result);
    }

    if (req.method === 'GET' && path === '/api/state') {
      const bp = os.blueprint(PERSON, NAV);
      return send(res, 200, {
        persona: os.personaFor(NAV),
        model: os.model(),
        modelDescription: activeModelDescription(),
        name: bp.identity.preferredName,
        program: (bp.extensions.campus as any)?.program ?? '',
        oneMomentPrompt: os.oneMomentPrompt(),
        storage: stores.backend,
        voice: voice.describe(),
        chapters: os.story(PERSON).map((s) => s.chapter.title),
      });
    }

    if (req.method === 'POST' && path === '/api/stt') {
      const contentType = String(req.headers['content-type'] || 'audio/webm');
      const bytes = await readRawBody(req);
      if (!bytes.length) return send(res, 400, { error: 'no audio' });
      const text = await stt.transcribe(bytes, contentType);
      return send(res, 200, { text: text ?? '' });
    }

    if (req.method === 'POST' && path === '/api/tts') {
      const { text } = await readBody(req);
      if (!text || !String(text).trim()) return send(res, 400, { error: 'no text' });
      const audio = await voice.synth(String(text));
      if (!audio) { res.writeHead(204); return res.end(); } // client uses browser voice
      res.writeHead(200, { 'content-type': voice.contentType });
      return res.end(audio);
    }

    if (req.method === 'POST' && path === '/api/say') {
      const { message } = await readBody(req);
      if (!message || !String(message).trim()) return send(res, 400, { error: 'empty message' });
      const reply = await os.say(PERSON, NAV, String(message));
      return send(res, 200, reply);
    }

    if (req.method === 'POST' && path === '/api/voicenote') {
      const contentType = String(req.headers['content-type'] || 'audio/webm');
      const bytes = await readRawBody(req);
      if (!bytes.length) return send(res, 400, { error: 'empty audio' });
      return send(res, 200, { ref: os.putVoiceNote(bytes, contentType) });
    }

    if (req.method === 'GET' && path === '/api/voicenote') {
      const blob = os.getBlob(url.searchParams.get('ref') ?? '');
      if (!blob) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'content-type': blob.contentType, 'cache-control': 'private, max-age=31536000' });
      return res.end(blob.bytes);
    }

    if (req.method === 'POST' && path === '/api/moment') {
      const b = await readBody(req);
      const chapterId = ensureChapter(String(b.chapterTitle || 'First Week'));
      const result = os.captureMoment(NAV, {
        personId: PERSON,
        chapterId,
        whyItMattered: String(b.whyItMattered ?? ''),
        covenantBasis: Array.isArray(b.covenantBasis) ? b.covenantBasis : [],
        reflection: b.reflection || undefined,
        voiceNoteText: b.voiceNoteText || undefined,
        voiceNoteRef: b.voiceNoteRef || undefined,
        occurredOn: b.occurredOn || new Date().toISOString().slice(0, 10),
        origin: b.origin || 'one_moment_rule',
      });
      return send(res, 200, result);
    }

    if (req.method === 'GET' && path === '/api/story') {
      return send(res, 200, { story: os.story(PERSON) });
    }

    if (req.method === 'GET' && path === '/api/revisit') {
      const chapter = url.searchParams.get('chapter') ?? '';
      return send(res, 200, { moment: os.revisit(PERSON, chapter) ?? null });
    }

    if (req.method === 'GET' && path === '/api/export') {
      res.writeHead(200, { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="my-navigator-export.json"' });
      return res.end(JSON.stringify(os.exportPerson(PERSON), null, 2));
    }

    send(res, 404, { error: 'not found' });
  } catch (err) {
    send(res, 500, { error: String((err as Error).message ?? err) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Navigator OS · Campus Navigator (Cole)`);
  console.log(`  ▶ http://localhost:${PORT}`);
  console.log(`  model:   ${activeModelDescription()}`);
  console.log(`  voice:   ${voice.describe()}`);
  console.log(`  hearing: ${stt.describe()}`);
  console.log(`  storage: ${stores.backend}\n`);
  refreshKaneMemory().then((m) => console.log(`  memory:  ${m ? "loaded Kane's memory" : 'no memory yet'}`)).catch(() => {});
});
