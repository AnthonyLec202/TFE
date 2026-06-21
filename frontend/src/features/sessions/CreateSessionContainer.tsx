import { useState } from 'react';
import { createSession } from './services/localSessionService';
import type { LocalPatientSync, LocalSession } from '../../core/offline/LocalDatabase';
import { runSyncCycle } from '../../core/offline/syncEngine';
import { CreateSessionForm } from './components/CreateSessionForm';

export function CreateSessionContainer() {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<LocalPatientSync[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const newSession: LocalSession = {
        id: crypto.randomUUID(),
        title: title.trim(),
        date,
        time,
        patientIds: selectedPatients.map(p => p.id),
        toolIds: [],
        isClosed: false,
        attendances: [],
        syncStatus: 'pending_create',
        lastModifiedAt: new Date().toISOString(),
      };

      await createSession(newSession);
      setTitle('');
      setDate('');
      setTime('');
      setSelectedPatients([]);
      runSyncCycle(); // fire-and-forget: push the new session to the server immediately if online
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CreateSessionForm
      title={title}
      date={date}
      time={time}
      selectedPatients={selectedPatients}
      submitting={submitting}
      onTitleChange={setTitle}
      onDateChange={setDate}
      onTimeChange={setTime}
      onPatientsChange={setSelectedPatients}
      onSubmit={handleSubmit}
    />
  );
}
