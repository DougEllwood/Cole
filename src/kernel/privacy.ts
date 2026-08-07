// The Privacy / consent layer (kernel). Memory is scoped per Navigator by
// default; crossing the wall between chapters of a life requires explicit,
// revocable consent. (docs/architecture/20-privacy-architecture.md §3)

import type { NavigatorId, PersonId } from '../shared/types';
import type { EventLog } from './eventLog';

export class PrivacyLayer {
  constructor(private log: EventLog) {}

  // Does `navigatorId` have consent to read the person's OTHER scopes?
  // Default is always the more private choice: no.
  allowsCrossContext(personId: PersonId, navigatorId: NavigatorId): boolean {
    let allowed = false;
    for (const e of this.log.all(personId)) {
      if (e.payload.scope !== navigatorId) continue;
      if (e.type === 'consent.granted' && e.payload.grant === 'cross-context') allowed = true;
      if (e.type === 'consent.revoked' && e.payload.grant === 'cross-context') allowed = false;
    }
    return allowed;
  }

  grantCrossContext(personId: PersonId, navigatorId: NavigatorId): void {
    this.log.append(personId, navigatorId, 'consent.granted', {
      scope: navigatorId, grant: 'cross-context',
    });
  }

  revokeCrossContext(personId: PersonId, navigatorId: NavigatorId): void {
    this.log.append(personId, navigatorId, 'consent.revoked', {
      scope: navigatorId, grant: 'cross-context',
    });
  }
}
