// Pure date-grouping helpers for the Sessions feature. No React, no I/O.
// Session dates are stored as ISO date strings ("2026-06-09") and times as "HH:MM".

import type { LocalSession } from '../../../core/offline/LocalDatabase';

export interface WeeklyGroup {
  key: string;        // ISO date of the week's Monday, e.g. "2026-06-08"
  weekStart: Date;
  weekEnd: Date;
  sessions: LocalSession[];
}

export interface MonthlyGroup {
  key: string;        // "YYYY-MM", e.g. "2026-06"
  year: number;
  month: number;      // 0-based (0 = January)
  sessions: LocalSession[];
}

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

// Parse "YYYY-MM-DD" as a local-time date to avoid timezone shifts from `new Date(string)`.
export function parseSessionDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

// Monday 00:00 of the ISO week containing the given date.
function startOfIsoWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  const shiftToMonday = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + shiftToMonday);
  return result;
}

// Sunday 00:00 of the same ISO week.
function endOfIsoWeek(weekStart: Date): Date {
  const result = new Date(weekStart);
  result.setDate(result.getDate() + 6);
  return result;
}

function toIsoDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Chronological order: by date, then by time (ascending).
function compareSessionsChronologically(a: LocalSession, b: LocalSession): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  return 0;
}

export function groupSessionsByWeek(sessions: LocalSession[]): WeeklyGroup[] {
  const groupsByKey = new Map<string, WeeklyGroup>();

  for (const session of sessions) {
    const weekStart = startOfIsoWeek(parseSessionDate(session.date));
    const key = toIsoDateKey(weekStart);

    let group = groupsByKey.get(key);
    if (!group) {
      group = { key, weekStart, weekEnd: endOfIsoWeek(weekStart), sessions: [] };
      groupsByKey.set(key, group);
    }
    group.sessions.push(session);
  }

  const groups = Array.from(groupsByKey.values());
  // Most recent weeks first.
  groups.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  // Chronological order within each week.
  for (const group of groups) group.sessions.sort(compareSessionsChronologically);
  return groups;
}

export function groupSessionsByMonth(sessions: LocalSession[]): MonthlyGroup[] {
  const groupsByKey = new Map<string, MonthlyGroup>();

  for (const session of sessions) {
    const date = parseSessionDate(session.date);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${pad(month + 1)}`;

    let group = groupsByKey.get(key);
    if (!group) {
      group = { key, year, month, sessions: [] };
      groupsByKey.set(key, group);
    }
    group.sessions.push(session);
  }

  const groups = Array.from(groupsByKey.values());
  // Most recent months first.
  groups.sort((a, b) => (b.year - a.year) || (b.month - a.month));
  // Chronological order within each month.
  for (const group of groups) group.sessions.sort(compareSessionsChronologically);
  return groups;
}

// ── Predicates (the caller supplies the reference date to keep these pure) ──

export function isInWeekOf(session: LocalSession, reference: Date): boolean {
  const start = startOfIsoWeek(reference);
  const end = endOfIsoWeek(start);
  const date = parseSessionDate(session.date);
  return date >= start && date <= end;
}

export function isInMonthOf(session: LocalSession, reference: Date): boolean {
  const date = parseSessionDate(session.date);
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

// ── Label formatters ─────────────────────────────────────────────────────

export function formatWeekRangeLabel(group: WeeklyGroup): string {
  return `Semaine du ${formatDayMonth(group.weekStart)} au ${formatDayMonth(group.weekEnd)}`;
}

export function formatMonthLabel(group: MonthlyGroup): string {
  return `${MONTH_NAMES_FR[group.month]} ${group.year}`;
}

function formatDayMonth(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}
