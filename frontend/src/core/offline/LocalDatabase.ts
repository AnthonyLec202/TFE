import Dexie, { type Table } from 'dexie';
import type { CreatePatientPayload } from '../../types/patient';

export type SyncStatus = 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';

// Mirrors TFE.Api.Models.SessionStatus. Numeric values must stay in sync with the backend enum,
// which (de)serializes as an integer.
export enum SessionStatus {
  Scheduled = 0,
  Completed = 1,
  PatientCancelled = 2,
  NoShow = 3,
}

export interface LocalSession {
  id: string;
  date: string;          // ISO date string, e.g. "2026-06-09"
  time: string;          // e.g. "14:30"
  patientIds: string[];
  title: string;
  status: SessionStatus; // Scheduled sessions are active; any other status archives to history
  syncStatus: SyncStatus;
  lastModifiedAt: string; // ISO datetime string
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
  }
}

export const db = new ClinicalAppDatabase();
