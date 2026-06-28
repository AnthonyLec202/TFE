import Dexie, { type Table } from 'dexie';
import type {
  Middleware,
  DBCore,
  DBCoreTable,
  DBCoreGetRequest,
  DBCoreGetManyRequest,
  DBCoreQueryRequest,
  DBCoreQueryResponse,
} from 'dexie';
import type { CreatePatientPayload } from '../../types/patient';
import {
  encryptString,
  decryptString,
  getActiveEncryptionKey,
  ENCRYPTION_SENTINEL,
} from './cryptoService';

export type SyncStatus = 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';

// Mirrors TFE.Api.Models.SessionStatus. Numeric values must stay in sync with the backend enum,
// which (de)serializes as an integer.
export enum SessionStatus {
  Scheduled = 0,
  Completed = 1,
  PatientCancelled = 2,
  NoShow = 3,
}

// A therapeutic tool's Type and Theme are free-form category strings (the clinician curates the
// taxonomy on the fly). They mirror the backend's string columns and stay indexed in IndexedDB so
// the catalog filters on them efficiently. Kept as named aliases (rather than bare `string`) so call
// sites and props remain self-documenting.
export type ToolType = string;
export type CbtTheme = string;

// One participating patient's attendance outcome within a session (mirrors the backend junction).
export interface LocalSessionAttendance {
  patientId: string;
  status: SessionStatus;
}

export interface LocalSession {
  id: string;
  date: string;          // ISO date string, e.g. "2026-06-09"
  time: string;          // e.g. "14:30"
  patientIds: string[];
  toolIds: string[];     // therapeutic tools associated to this session (many-to-many)
  title: string;
  isClosed: boolean;     // open sessions are active; closed sessions archive to patients' history
  attendances: LocalSessionAttendance[]; // per-patient outcome, populated when the session is closed
  // AI-generated clinical report (Markdown) and its validation flag. Absent until a report is
  // generated; non-indexed, so the store key declarations are unchanged.
  aiReport?: string;
  isReportValidated?: boolean;
  syncStatus: SyncStatus;
  lastModifiedAt: string; // ISO datetime string
}

/**
 * Read-only local mirror of a server TherapeuticTool. The catalog is authored by the practitioner
 * and pulled into IndexedDB so the clinician can search and filter it with zero latency — including
 * offline, during an active session. Type/Theme are free-form category strings, indexed so the
 * filtering UI can branch on them without scanning the whole store.
 */
export interface LocalTherapeuticTool {
  id: string;
  title: string;
  description: string;
  type: ToolType;
  theme: CbtTheme;
  downGradingStrategy: string;
  upGradingStrategy: string;
}

export interface LocalNote {
  id: string;
  sessionId: string;
  content: string;
  syncStatus: SyncStatus;
  lastModifiedAt: string; // ISO datetime string
  unprocessedStrokes?: string; // JSON-stringified array of strokes pending cloud recognition
}

export interface LocalPatientSync {
  id: string;
  firstName: string;
  lastName: string;
  searchableName: string; // lowercase "firstname lastname" for fast substring search
  birthDate: string;      // ISO date "YYYY-MM-DD"
  userRole: string;       // requesting user's role for this patient (Admin | Parent | Collaborator)
  // Optional contact details mirrored from the server (non-indexed). Absent until set via the dossier.
  email?: string | null;
  phoneNumber?: string | null;
  postalAddress?: string | null;
  // Archived patients are filtered out of "Mes patients" and listed under "Archives". Optional so
  // pre-v10 cached rows (and offline-queued creations) default to active.
  isArchived?: boolean;
  // Offline mutation flag, mirroring the model sessions/notes use. Absent (undefined) means the row is
  // in sync with the server. Set to 'pending_update' when an archive/restore toggle is made offline,
  // so syncPatients pushes the change (PUT) on reconnect. Non-indexed (filtered in memory).
  syncStatus?: SyncStatus;
}

/**
 * A 'Create Patient' submission made while offline, awaiting POST to the server.
 * Holds the exact request payload so the background sync can replay it unchanged.
 */
export interface QueuedPatientCreation {
  id: string;                    // the client-generated patient id (also the queue primary key)
  payload: CreatePatientPayload; // the request body to POST once back online
  queuedAt: string;              // ISO datetime — preserves first-in-first-out ordering
}

class ClinicalAppDatabase extends Dexie {
  sessions!: Table<LocalSession, string>;
  notes!: Table<LocalNote, string>;
  patients!: Table<LocalPatientSync, string>;
  offlinePatientQueue!: Table<QueuedPatientCreation, string>;
  therapeuticTools!: Table<LocalTherapeuticTool, string>;

  constructor() {
    super('ClinicalAppDB');
    this.version(1).stores({
      sessions: 'id, *patientIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
    });
    this.version(2).stores({
      sessions: 'id, *patientIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
      patients: 'id, searchableName',
    });
    this.version(3).stores({
      sessions: 'id, *patientIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
      patients: 'id, searchableName',
      offlinePatientQueue: 'id, queuedAt',
    });
    // v4 adds birthDate + userRole to LocalPatientSync. These are non-indexed fields, so the store
    // key declarations are unchanged (Dexie stores arbitrary object properties); the version bump
    // marks the shape change. Existing cached rows backfill the new fields on the next sync, whose
    // bulkPut replaces each record with the complete profile.
    this.version(4).stores({
      sessions: 'id, *patientIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
      patients: 'id, searchableName',
      offlinePatientQueue: 'id, queuedAt',
    });
    // v5 replaces LocalSession.isCompleted (boolean) with status (SessionStatus). Existing rows
    // are migrated in place: completed sessions become Completed, others Scheduled.
    this.version(5).stores({
      sessions: 'id, *patientIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
      patients: 'id, searchableName',
      offlinePatientQueue: 'id, queuedAt',
    }).upgrade(async tx => {
      await tx.table('sessions').toCollection().modify((session: any) => {
        session.status = session.isCompleted ? SessionStatus.Completed : SessionStatus.Scheduled;
        delete session.isCompleted;
      });
    });
    // v6 moves attendance from the session level (single status) to a per-patient model:
    // status is dropped in favour of isClosed + an attendances array. Existing rows are migrated in
    // place — a non-Scheduled status becomes a single-entry attendance for the primary patient and
    // closes the session; Scheduled sessions stay open with no attendances.
    this.version(6).stores({
      sessions: 'id, *patientIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
      patients: 'id, searchableName',
      offlinePatientQueue: 'id, queuedAt',
    }).upgrade(async tx => {
      await tx.table('sessions').toCollection().modify((session: any) => {
        const previousStatus: SessionStatus = session.status ?? SessionStatus.Scheduled;
        const isClosed = previousStatus !== SessionStatus.Scheduled;
        const primaryPatientId: string | undefined = Array.isArray(session.patientIds) ? session.patientIds[0] : undefined;

        session.isClosed = isClosed;
        session.attendances = isClosed && primaryPatientId
          ? [{ patientId: primaryPatientId, status: previousStatus }]
          : [];
        delete session.status;
      });
    });

    // v7 adds the therapeutic tool catalog (read-only local mirror, indexed on type + theme for the
    // filter UI) and the session→tool association (sessions.toolIds, multi-entry indexed so a tool's
    // sessions can be looked up). Existing session rows backfill an empty toolIds array in place.
    this.version(7).stores({
      sessions: 'id, *patientIds, *toolIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
      patients: 'id, searchableName',
      offlinePatientQueue: 'id, queuedAt',
      therapeuticTools: 'id, type, theme',
    }).upgrade(async tx => {
      await tx.table('sessions').toCollection().modify((session: any) => {
        if (!Array.isArray(session.toolIds)) session.toolIds = [];
      });
    });

    // v8: TherapeuticTool.type/theme changed from numeric enum ordinals to free-form category
    // strings. The catalog is a read-only server mirror, so rather than translate stale ordinals we
    // clear it — the next hydration (post-sync pull) repopulates it with the authoritative string
    // values. The index declaration is unchanged (Dexie indexes whatever value type is stored).
    this.version(8).stores({
      sessions: 'id, *patientIds, *toolIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
      patients: 'id, searchableName',
      offlinePatientQueue: 'id, queuedAt',
      therapeuticTools: 'id, type, theme',
    }).upgrade(async tx => {
      await tx.table('therapeuticTools').clear();
    });

    // v9 adds optional contact details (email, phoneNumber, postalAddress) to LocalPatientSync. These
    // are non-indexed fields, so the store key declarations are unchanged; the version bump marks the
    // shape change. Existing cached rows backfill the new fields on the next sync, whose bulkPut
    // replaces each record with the complete profile.
    this.version(9).stores({
      sessions: 'id, *patientIds, *toolIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
      patients: 'id, searchableName',
      offlinePatientQueue: 'id, queuedAt',
      therapeuticTools: 'id, type, theme',
    });

    // v10 adds the non-indexed `isArchived` flag to LocalPatientSync. Stores are unchanged (the flag
    // is filtered in memory, not indexed); existing rows backfill it on the next sync's bulkPut.
    this.version(10).stores({
      sessions: 'id, *patientIds, *toolIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
      patients: 'id, searchableName',
      offlinePatientQueue: 'id, queuedAt',
      therapeuticTools: 'id, type, theme',
    });

    // v11 adds the non-indexed `aiReport` + `isReportValidated` fields to LocalSession. Stores are
    // unchanged (neither field is indexed); existing rows leave them undefined and backfill on the
    // next sync's reconciliation (or when a report is generated locally).
    this.version(11).stores({
      sessions: 'id, *patientIds, *toolIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
      patients: 'id, searchableName',
      offlinePatientQueue: 'id, queuedAt',
      therapeuticTools: 'id, type, theme',
    });

    // v12 adds the non-indexed `syncStatus` field to LocalPatientSync, enabling offline archive/restore
    // toggles to be flagged 'pending_update' — the same on-entity mechanism sessions and notes use.
    // Stores are unchanged (the flag is filtered in memory, not indexed); existing rows leave it
    // undefined (treated as synced) and backfill on the next sync's reconciliation.
    this.version(12).stores({
      sessions: 'id, *patientIds, *toolIds, date, syncStatus',
      notes: 'id, sessionId, syncStatus',
      patients: 'id, searchableName',
      offlinePatientQueue: 'id, queuedAt',
      therapeuticTools: 'id, type, theme',
    });

    // ─── Note encryption hooks ────────────────────────────────────────────────
    //
    // Only `content` and `unprocessedStrokes` are encrypted. All other fields
    // (id, sessionId, syncStatus, lastModifiedAt) remain in cleartext so that
    // Dexie's index engine can continue to operate on them without modification.
    //
    // The reading hook is synchronous (Dexie requirement) and acts as a defensive
    // assertion only. Actual async decryption is performed by the DBCore middleware
    // registered below, which runs before the reading hook in the pipeline:
    //   IndexedDB → [DBCore middleware: async decrypt] → [reading hook: assert] → app

    // Synchronous assertion: throws loudly if an encrypted blob reaches the application
    // layer undecrypted, indicating either a missing active key or an uncovered read path.
    this.notes.hook('reading', (obj: LocalNote): LocalNote => {
      if (
        obj.content.startsWith(ENCRYPTION_SENTINEL) ||
        (typeof obj.unprocessedStrokes === 'string' &&
          obj.unprocessedStrokes.startsWith(ENCRYPTION_SENTINEL))
      ) {
        throw new Error(
          '[NoteEncryption] Encrypted blob reached the reading hook undecrypted. ' +
          'Ensure the encryption key is active before reading notes.',
        );
      }
      return obj;
    });

    // Encrypts content and unprocessedStrokes in-place before a new record is stored.
    // Dexie 4 awaits the returned Promise at runtime despite the declared hook return type
    // being void | undefined | TKey — the cast is required to satisfy the type checker.
    this.notes.hook('creating', async function (_primKey: string, obj: LocalNote): Promise<void> {
      const key = getActiveEncryptionKey();
      if (!key) return;
      obj.content = await encryptString(key, obj.content);
      if (typeof obj.unprocessedStrokes === 'string') {
        obj.unprocessedStrokes = await encryptString(key, obj.unprocessedStrokes);
      }
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    // Returns encrypted overrides for any sensitive field present in the modifications delta.
    // Dexie merges the returned object on top of the original modifications, so non-sensitive
    // fields (syncStatus, lastModifiedAt, …) are preserved unchanged.
    this.notes.hook('updating', async function (
      modifications: Record<string, unknown>,
      _primKey: string,
      _obj: LocalNote,
    ): Promise<Record<string, unknown> | undefined> {
      const key = getActiveEncryptionKey();
      if (!key) return;

      const encryptedOverrides: Record<string, unknown> = {};

      if (typeof modifications['content'] === 'string') {
        encryptedOverrides['content'] = await encryptString(key, modifications['content']);
      }
      if (typeof modifications['unprocessedStrokes'] === 'string') {
        encryptedOverrides['unprocessedStrokes'] = await encryptString(
          key,
          modifications['unprocessedStrokes'],
        );
      }

      return Object.keys(encryptedOverrides).length > 0 ? encryptedOverrides : undefined;
    });

    // ─── DBCore decryption middleware ─────────────────────────────────────────
    //
    // Intercepts get / getMany / query at the storage layer to perform async AES-GCM
    // decryption before records propagate up to the Dexie hooks layer and the app.
    //
    // openCursor is intentionally left as a pass-through. The cursor start() protocol
    // drives iteration via a synchronous onNext callback, which is incompatible with
    // async AES-GCM decryption. In this codebase, all note reads go through query(),
    // get(), or getMany() — Collection.filter().toArray() issues a full-table query()
    // at DBCore level; Collection.each() (which uses openCursor) is not used on the
    // notes table. The reading hook above provides a loud, detectable failure if an
    // encrypted blob ever reaches the app via an uncovered path.

    this.use({
      stack: 'dbcore',
      name: 'NoteDecryptionMiddleware',
      create(downlevel: DBCore): Partial<DBCore> {
        async function decryptNote(record: unknown): Promise<LocalNote> {
          const key = getActiveEncryptionKey();
          if (!key) return record as LocalNote;
          const note = record as LocalNote;

          // Per-note isolation: a single corrupted blob (wrong key, truncated ciphertext) must
          // never reject the surrounding get/getMany/query Promise. A rejection there would
          // bubble up through db.notes.*.toArray() and fail the whole sync cycle — including
          // unrelated tables like patients. Instead we log the offending id and blank the
          // ciphertext so the synchronous reading-hook assertion does not fire on it either.
          // Every field access is typeof-guarded so a malformed/partial record can never make
          // the catch block itself throw (e.g. content === undefined → undefined.startsWith).
          try {
            return {
              ...note,
              content:
                typeof note.content === 'string'
                  ? await decryptString(key, note.content)
                  : note.content,
              unprocessedStrokes:
                typeof note.unprocessedStrokes === 'string'
                  ? await decryptString(key, note.unprocessedStrokes)
                  : note.unprocessedStrokes,
            };
          } catch (error) {
            console.error(
              `[NoteDecryption] Failed to decrypt note ${note?.id} — returning blank content to keep sync alive.`,
              error,
            );
            return {
              ...note,
              content:
                typeof note.content === 'string' && note.content.startsWith(ENCRYPTION_SENTINEL)
                  ? ''
                  : note.content,
              unprocessedStrokes:
                typeof note.unprocessedStrokes === 'string' &&
                note.unprocessedStrokes.startsWith(ENCRYPTION_SENTINEL)
                  ? undefined
                  : note.unprocessedStrokes,
            };
          }
        }

        return {
          ...downlevel,
          table(tableName: string): DBCoreTable {
            const downlevelTable = downlevel.table(tableName);
            if (tableName !== 'notes') return downlevelTable;

            return {
              ...downlevelTable,

              async get(req: DBCoreGetRequest): Promise<LocalNote | undefined> {
                const result = (await downlevelTable.get(req)) as LocalNote | undefined;
                return result !== undefined ? decryptNote(result) : undefined;
              },

              async getMany(req: DBCoreGetManyRequest): Promise<(LocalNote | undefined)[]> {
                const results = (await downlevelTable.getMany(req)) as (LocalNote | undefined)[];
                return Promise.all(
                  results.map(r => (r !== undefined ? decryptNote(r) : Promise.resolve(undefined))),
                );
              },

              async query(req: DBCoreQueryRequest): Promise<DBCoreQueryResponse> {
                const response = await downlevelTable.query(req);
                // A keys-only query (req.values === false) returns primary keys, not note
                // objects — Collection.delete() and bulkPut's hook bookkeeping issue these.
                // Decrypting a string key would dereference `content` on it. Pass them through.
                if (!req.values) return response;
                const decryptedResult = await Promise.all(
                  (response.result as LocalNote[]).map(r => decryptNote(r)),
                );
                return { ...response, result: decryptedResult };
              },
            };
          },
        };
      },
    } satisfies Middleware<DBCore>);
  }
}

export const db = new ClinicalAppDatabase();
