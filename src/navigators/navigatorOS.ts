// NavigatorOS — the shared platform as a first-class object and the COMPOSITION
// ROOT. One kernel (log + engines + orchestrator) serves many Navigators. A
// vertical is registered as a thin VerticalConfig; the person's Memory and
// Story of Me live in the one log, so they follow the person across Navigators.
// This is the platform thesis, running. (docs/architecture/30-shared-platform-architecture.md)

import { EventLog, type Clock } from '../kernel/eventLog';
import type { EventStore } from '../kernel/eventStore';
import { InMemoryBlobStore, type Blob, type BlobStore } from '../kernel/blobStore';
import { PrivacyLayer } from '../kernel/privacy';
import { Orchestrator } from '../kernel/orchestrator';
import { ScopeRegistry } from '../kernel/scopeRegistry';
import { Gateway } from '../intelligence/gateway';
import { MockAdapter } from '../intelligence/adapters/mockAdapter';
import { MemoryEngineImpl } from '../engines/memory/memoryEngine';
import { RelationshipEngineImpl } from '../engines/relationship/relationshipEngine';
import { HumanConnectionEngineImpl } from '../engines/humanConnection/humanConnectionEngine';
import { VoicePersonalityEngineImpl } from '../engines/voicePersonality/voicePersonalityEngine';
import { TeachingEngineImpl } from '../engines/teaching/teachingEngine';
import { GrowthEngineImpl } from '../engines/growth/growthEngine';
import { EthicsEngineImpl } from '../engines/ethics/ethicsEngine';
import type { EngineSet, IntelligenceGateway, VerticalConfig } from '../shared/contracts';
import type {
  Chapter, CompanionReply, Journey, Moment, MomentInput, NavigatorId, PersonId,
} from '../shared/types';

export class NavigatorOS {
  private log: EventLog;
  private memory: MemoryEngineImpl;
  private growth: GrowthEngineImpl;
  private privacy: PrivacyLayer;
  private scope: ScopeRegistry;
  private gateway: IntelligenceGateway;
  private orchestrator: Orchestrator;
  private blobs: BlobStore;
  private verticals = new Map<NavigatorId, VerticalConfig>();

  constructor(clock?: Clock, gateway?: IntelligenceGateway, store?: EventStore, blobs?: BlobStore) {
    this.log = new EventLog(clock, store);
    this.blobs = blobs ?? new InMemoryBlobStore();
    this.memory = new MemoryEngineImpl(this.log);
    this.growth = new GrowthEngineImpl();
    this.privacy = new PrivacyLayer(this.log);
    this.scope = new ScopeRegistry();
    this.gateway = gateway ?? new Gateway(new MockAdapter());

    const engines: EngineSet = {
      memory: this.memory,
      relationship: new RelationshipEngineImpl(this.log),
      humanConnection: new HumanConnectionEngineImpl(),
      voice: new VoicePersonalityEngineImpl(),
      teaching: new TeachingEngineImpl(),
      growth: this.growth,
      ethics: new EthicsEngineImpl(this.log, this.scope),
      gateway: this.gateway,
    };
    this.orchestrator = new Orchestrator(engines, this.privacy);
  }

  // Register a vertical — its scope rules go into the shared registry.
  registerVertical(v: VerticalConfig): this {
    this.verticals.set(v.navigatorId, v);
    this.scope.register(v.navigatorId, v.scopeRules);
    return this;
  }

  private vertical(navigatorId: NavigatorId): VerticalConfig {
    const v = this.verticals.get(navigatorId);
    if (!v) throw new Error(`No Navigator registered for scope "${navigatorId}".`);
    return v;
  }

  model(): string { return this.gateway.activeModel(); }
  logSize(): number { return this.log.size(); }
  personaFor(navigatorId: NavigatorId) { return this.vertical(navigatorId).persona; }
  blueprint(personId: PersonId, navigatorId: NavigatorId) { return this.memory.projectBlueprint(personId, navigatorId); }

  onboard(personId: PersonId, navigatorId: NavigatorId, data: unknown): void {
    const bp = this.vertical(navigatorId).seed(personId, data);
    this.memory.seedBlueprint(bp);
    // Persist the seed as a log event so the Blueprint survives a restart —
    // the log, not process memory, is the source of truth. (ADR-0002)
    this.log.append(personId, navigatorId, 'blueprint.edited', { seed: bp });
  }

  say(personId: PersonId, navigatorId: NavigatorId, message: string): Promise<CompanionReply> {
    return this.orchestrator.handle(personId, navigatorId, message, this.vertical(navigatorId).persona);
  }

  openChapter(personId: PersonId, navigatorId: NavigatorId, title: string, journey?: Journey): string {
    const j = journey ?? (this.vertical(navigatorId).chapterOfLife as Journey);
    return this.memory.openChapter(personId, navigatorId, title, j);
  }

  captureMoment(navigatorId: NavigatorId, input: MomentInput) {
    return this.memory.preserveMoment({
      personId: input.personId,
      navigatorId,
      chapterId: input.chapterId,
      whyItMattered: input.whyItMattered,
      covenantBasis: input.covenantBasis,
      reflection: input.reflection,
      whatILearned: input.whatILearned,
      voiceNoteText: input.voiceNoteText,
      voiceNoteRef: input.voiceNoteRef,
      photoRef: input.photoRef,
      location: input.location,
      whoWasInvolved: input.whoWasInvolved ?? [],
      occurredOn: input.occurredOn,
      origin: input.origin ?? 'one_moment_rule',
    });
  }

  // ---- Story media (encrypted blobs, referenced from the log) ----
  putVoiceNote(bytes: Uint8Array, contentType: string): string {
    return this.blobs.put(bytes, contentType);
  }
  getBlob(ref: string): Blob | undefined {
    return this.blobs.get(ref);
  }

  // Person-level: the whole life story, across every Navigator.
  story(personId: PersonId, navigatorId?: NavigatorId): { chapter: Chapter; moments: Moment[] }[] {
    return this.memory.story(personId, navigatorId);
  }

  // Person-level revisit — searches the entire Story of Me.
  revisit(personId: PersonId, chapterTitleOrId: string): Moment | undefined {
    const needle = chapterTitleOrId.toLowerCase();
    for (const { chapter, moments } of this.story(personId)) {
      if (chapter.chapterId.toLowerCase() === needle || chapter.title.toLowerCase().includes(needle)) {
        return moments.find((m) => m.voiceNoteText) ?? moments[0];
      }
    }
    return undefined;
  }

  reflectAcrossMoments(personId: PersonId): string | undefined {
    return this.growth.connectMoments(this.story(personId).flatMap((s) => s.moments));
  }

  forget(momentId: string, mode: 'deemphasize' | 'delete' = 'delete'): void {
    this.memory.forget(momentId, mode);
  }

  grantCrossContext(personId: PersonId, navigatorId: NavigatorId): void {
    this.privacy.grantCrossContext(personId, navigatorId);
  }

  // ---- Ownership (Promise Four): the person can see, export, and delete ----

  // A complete, portable copy of everything Navigator knows about the person.
  exportPerson(personId: PersonId) {
    return {
      format: 'navigator-os.person-export/v0',
      personId,
      note: 'Your data, yours to keep. Exported from Navigator OS.',
      blueprint: this.memory.exportBlueprint(personId),
      story: this.story(personId),
      events: this.log.all(personId),
    };
  }

  // The right to be forgotten — a true deletion of the person's whole record,
  // including the encrypted audio of their voice notes.
  erasePerson(personId: PersonId): void {
    for (const { moments } of this.story(personId)) {
      for (const m of moments) if (m.voiceNoteRef) this.blobs.delete(m.voiceNoteRef);
    }
    this.log.erasePerson(personId);
    this.memory.dropSeed(personId);
  }

  oneMomentPrompt(): string {
    return 'Was there one moment today that helped shape who you’re becoming?';
  }
}
