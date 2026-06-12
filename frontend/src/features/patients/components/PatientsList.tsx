import { Calendar, ChevronRight, RotateCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import type { LocalPatientSync } from '../../../core/offline/LocalDatabase';

export interface PatientsListProps {
  patients: LocalPatientSync[];
  isLoading: boolean;
  error?: string;
  onSelectPatient: (id: string) => void;
  onRetry?: () => void;
}

function formatBirthDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-BE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

export function PatientsList({ patients, isLoading, error, onSelectPatient, onRetry }: PatientsListProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-400">Chargement des patients…</p>;
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
        <p className="text-sm text-slate-400">Aucun patient pour le moment.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {patients.map(patient => (
        <button
          key={patient.id}
          onClick={() => onSelectPatient(patient.id)}
          className="block w-full text-left group"
        >
          <Card className="p-4 flex flex-col gap-2 group-hover:border-blue-200 group-hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">
                {patient.lastName.toUpperCase()}, {patient.firstName}
              </h3>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-500 shrink-0 transition-colors" />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Né(e) le {formatBirthDate(patient.birthDate)}
              </span>
            </div>
          </Card>
        </button>
      ))}
    </div>
  );
}
