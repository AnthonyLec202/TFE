import Dexie, { type Table } from 'dexie';
import type { CreatePatientPayload } from '../../types/patient';

export type SyncStatus = 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';

// Mirrors TFE.Api.Models.SessionStatus. Numeric values must stay in sync with the backend enum,
// which (de)serializes as an integer. Declared as a `const` object plus a derived union type rather
// than a TS `enum`: enums emit runtime code and are therefore disallowed under the project's
// `erasableSyntaxOnly` compiler option. This pattern keeps both the value namespace
// (`SessionStatus.Completed`) and the `SessionStatus` type intact for every existing call site.
export const SessionStatus = {
  Scheduled: 0,
  Completed: 1,
  PatientCancelled: 2,
  NoShow: 3,
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

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

/**
 * Schema and store definitions for the local mirror. Deliberately free of any encryption concern:
 * the sensitive fields (notes.content, notes.unprocessedStrokes, sessions.aiReport) are encrypted by
 * `recordEncryption.ts` at the service call sites, NOT here.
 *
 * Do not reintroduce encryption as a Dexie hook or a DBCore middleware. Hooks are synchronous by
 * contract — Dexie does not await a Promise returned from one, so an async WebCrypto call inside a
 * 'creating'/'updating' hook resolves after the record has already been written and the cleartext is
 * stored silently. A DBCore middleware cannot work either: it runs inside the open IndexedDB
 * transaction, which cannot survive an await on a native promise. See the header of
 * `recordEncryption.ts` for the full rationale.
 */
/**
 * Row shapes handled by the schema upgrades below. A migration reads columns that the current
 * `LocalSession` no longer declares, so each version gets a minimal type describing exactly the
 * fields it touches — narrower and safer than `any`, which would silence every typo.
 */
interface LegacySessionV5 {
  isCompleted?: boolean;
  status?: SessionStatus;
}

interface LegacySessionV6 {
  status?: SessionStatus;
  patientIds?: string[];
  isClosed?: boolean;
  attendances?: LocalSessionAttendance[];
}

interface LegacySessionV7 {
  toolIds?: string[];
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
      await tx.table('sessions').toCollection().modify((session: LegacySessionV5) => {
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
      await tx.table('sessions').toCollection().modify((session: LegacySessionV6) => {
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
      await tx.table('sessions').toCollection().modify((session: LegacySessionV7) => {
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
  }
}

export const db = new ClinicalAppDatabase();
