import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../auth';
import { createPatient, getPatients } from '../../services/patientService';
import type { CreatePatientPayload, PatientResponse } from '../../types/patient';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CreatePatientForm } from './components/CreatePatientForm';
import { PatientsList } from './components/PatientsList';

const EMPTY_FORM: CreatePatientPayload = { firstName: '', lastName: '', birthDate: '' };

interface Props {
  onSelectPatient: (id: string) => void;
  onJoinPatient?: () => void;
}

export function DashboardContainer({ onSelectPatient, onJoinPatient }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('Admin') ?? false;

  const [patients, setPatients] = useState<PatientResponse[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  const [form, setForm] = useState<CreatePatientPayload>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    getPatients()
      .then(setPatients)
      .catch(() => setListError('Impossible de charger la liste des patients.'))
      .finally(() => setLoadingList(false));
  }, []);

  async function handleCreate() {
    setCreateError('');
    setCreating(true);
    try {
      const created = await createPatient(form);
      setPatients(prev => [...prev, created].sort((a, b) => a.lastName.localeCompare(b.lastName)));
      setForm(EMPTY_FORM);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {isAdmin ? 'Mes patients' : 'Patients suivis'}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {patients.length} patient{patients.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          {isAdmin ? (
            <CreatePatientForm
              firstName={form.firstName}
              lastName={form.lastName}
              birthDate={form.birthDate}
              submitting={creating}
              error={createError}
              onFirstNameChange={value => setForm(prev => ({ ...prev, firstName: value }))}
              onLastNameChange={value => setForm(prev => ({ ...prev, lastName: value }))}
              onBirthDateChange={value => setForm(prev => ({ ...prev, birthDate: value }))}
              onSubmit={handleCreate}
            />
          ) : onJoinPatient ? (
            <Card className="p-5 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-slate-700">Rejoindre un patient</h2>
              <p className="text-xs text-slate-500">
                Utilisez un code d'invitation pour accéder au suivi d'un patient.
              </p>
              <Button variant="secondary" size="sm" onClick={onJoinPatient} className="w-full">
                <UserPlus className="h-4 w-4" />
                Rejoindre un patient
              </Button>
            </Card>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <PatientsList
            patients={patients}
            isLoading={loadingList}
            error={listError}
            onSelectPatient={onSelectPatient}
          />
        </div>
      </div>
    </div>
  );
}
