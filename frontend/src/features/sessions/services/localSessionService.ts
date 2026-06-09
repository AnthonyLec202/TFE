import { db } from '../../../core/offline/LocalDatabase';
import type { LocalNote, LocalSession } from '../../../core/offline/LocalDatabase';

export async function createSession(session: LocalSession): Promise<void> {
  await db.sessions.put(session);
}

export async function getSessionById(sessionId: string): Promise<LocalSession | undefined> {
  return db.sessions.get(sessionId);
}

export async function getAllSessions(): Promise<LocalSession[]> {
  return db.sessions.orderBy('date').reverse().toArray();
}

export async function getSessionsForPatient(patientId: string): Promise<LocalSession[]> {
  return db.sessions.where('patientIds').equals(patientId).toArray();
}

export async function saveNoteLocally(note: LocalNote): Promise<void> {
  await db.notes.put(note);
}

export async function getNoteForSession(sessionId: string): Promise<LocalNote | undefined> {
  return db.notes.where('sessionId').equals(sessionId).first();
}
