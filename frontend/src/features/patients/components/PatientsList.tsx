import { Archive, ArchiveRestore, Calendar, ChevronRight, Clock, Lock, RotateCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import type { LocalPatientSync, SyncStatus } from '../../../core/offline/LocalDatabase';

/**
 * A patient row for the dashboard list. `syncStatus` (inherited from LocalPatientSync) is present
 * while a local change is not yet synced — 'pending_create' for an offline creation, 'pending_update'
 * for an offline archive/restore toggle — and absent for synced, server-backed records.
 */
export type PatientListItem = LocalPatientSync;

export interface PatientsListProps {
  patients: PatientListItem[];
  isLoading: boolean;
  error?: string;
  // Shown in place of the list when it is empty (e.g. a contextual "no search results" message).
  emptyMessage?: string;
  onSelectPatient: (id: string) => void;
  onRetry?: () => void;
  // When provided, each card renders an Archiver / Restaurer action toggling the archived flag.
  onToggleArchive?: (patient: PatientListItem, nextArchived: boolean) => void;
  // Read-only mode (e.g. offline on the Archives view): navigation into the private dossier is
  // blocked upstream, so the card is dimmed, shows a lock instead of the chevron, and uses a
  // not-allowed cursor. The click still fires so the container can surface its explanatory message.
  lockNavigation?: boolean;
}

// Mirrors the "Terminer la séance" button styling from the Session cards.
const ARCHIVE_BUTTON_CLASS =
  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white';

function formatBirthDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-BE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

// Whole years elapsed since the birth date.
function computeAge(iso: string): number {
  const today = new Date();
  const birth = new Date(iso);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// First letter of the first + last name, e.g. "Marie Dumont" → "MD".
function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// Mirrors the SessionCard "pending" indicator: a patient created/updated offline is awaiting sync.
function isPendingSync(status: SyncStatus | undefined): boolean {
  return status === 'pending_create' || status === 'pending_update';
}

export function PatientsList({ patients, isLoading, error, emptyMessage, onSelectPatient, onRetry, onToggleArchive, lockNavigation = false }: PatientsListProps) {
  if (isLoading) {
    return <p className="text-sm text-taupe-400">Chargement des patients…</p>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
        <p className="text-sm text-red-600">{error}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCw className="h-3.5 w-3.5" />
            Réessayer
          </Button>
        )}
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <p className="text-sm text-taupe-400">{emptyMessage ?? 'Aucun patient pour le moment.'}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {patients.map(patient => (
        <div
          key={patient.id}
          className={[
            'rounded-xl border border-sand-200 bg-white transition-[border-color,box-shadow]',
            // Only the navigation affordance is dimmed when locked (see the nav button below) so the
            // archive/restore action stays at full opacity and clearly usable offline.
            lockNavigation ? '' : 'hover:border-petrol-100 hover:shadow-[0_2px_10px_rgba(31,111,107,0.08)]',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-3 px-[18px] py-4">
            {/* Navigation target — a dedicated button so the archive action can sit beside it as a
                sibling (valid HTML: no interactive element nested inside another). The button stays
                clickable when locked so the container can explain the restriction; only the cursor
                signals the blocked state. */}
            <button
              type="button"
              onClick={() => onSelectPatient(patient.id)}
              aria-disabled={lockNavigation}
              className={[
                'flex items-center gap-[13px] min-w-0 flex-1 text-left',
                lockNavigation ? 'cursor-not-allowed opacity-70' : '',
              ].join(' ')}
            >
              <span className="w-[42px] h-[42px] rounded-full bg-petrol-50 text-petrol-600 flex items-center justify-center font-bold text-sm shrink-0">
                {initials(patient.firstName, patient.lastName)}
              </span>
              <div className="flex flex-col gap-[3px] min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-[15px] font-semibold text-ink truncate">
                    {patient.lastName.toUpperCase()}, {patient.firstName}
                  </span>
                  {isPendingSync(patient.syncStatus) && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#F7EFDC] text-[#9A6A18] border border-[#E4D2A6]">
                      <Clock className="h-[11px] w-[11px]" />
                      en attente
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-[7px] text-[13px] text-taupe-500">
                  <Calendar className="h-3.5 w-3.5 text-[#B6AFA4]" />
                  Né(e) le {formatBirthDate(patient.birthDate)} · {computeAge(patient.birthDate)} ans
                </div>
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              {/* Archive toggle is hidden only for not-yet-synced offline *creations* (no server record
                  to archive yet). An offline archive/restore toggle ('pending_update') stays actionable
                  so the clinician can re-toggle it before it syncs — it already exists server-side. */}
              {onToggleArchive && patient.syncStatus !== 'pending_create' && (
                patient.isArchived ? (
                  <button
                    type="button"
                    onClick={() => onToggleArchive(patient, false)}
                    className={ARCHIVE_BUTTON_CLASS}
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    Restaurer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleArchive(patient, true)}
                    className={ARCHIVE_BUTTON_CLASS}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archiver
                  </button>
                )
              )}
              {lockNavigation ? (
                <Lock
                  className="h-[18px] w-[18px] text-[#C2BBB0] shrink-0"
                  aria-label="Dossier privé inaccessible hors ligne"
                />
              ) : (
                <ChevronRight className="h-5 w-5 text-[#C2BBB0] shrink-0" />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
