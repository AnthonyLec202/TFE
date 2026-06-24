import { DashboardContainer } from './DashboardContainer';

interface Props {
  onSelectPatient: (id: string) => void;
}

/**
 * Top-level entry point for the "Archives" page. Reuses the dashboard container in its archived mode,
 * which drops the creation form and lists only archived patients — so the two pages stay in lockstep.
 */
export function PatientArchivesContainer({ onSelectPatient }: Props) {
  return <DashboardContainer mode="archived" onSelectPatient={onSelectPatient} />;
}
