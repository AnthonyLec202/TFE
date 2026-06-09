import { getPatients } from '../../../services/patientService';
import type { PatientResponse } from '../../../types/patient';

export async function fetchPatientsSummary(): Promise<PatientResponse[]> {
  return getPatients();
}
