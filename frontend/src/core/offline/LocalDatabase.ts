import Dexie, { type Table } from 'dexie';

export type SyncStatus = 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';

export interface LocalSession {
  id: string;
  date: string;          // ISO date string, e.g. "2026-06-09"
  time: string;          // e.g. "14:30"
  patientIds: string[];
  title: string;
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
}

class ClinicalAppDatabase extends Dexie {
  sessions!: Table<LocalSession, string>;
  notes!: Table<LocalNote, string>;
  patients!: Table<LocalPatientSync, string>;

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
  }
}

export const db = new ClinicalAppDatabase();
