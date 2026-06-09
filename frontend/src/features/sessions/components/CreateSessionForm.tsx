import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { createSession } from '../services/localSessionService';
import type { LocalPatientSync, LocalSession } from '../../../core/offline/LocalDatabase';
import { PatientAutocomplete } from './PatientAutocomplete';

interface CreateSessionFormProps {
  onCreated?: () => void;
}

export function CreateSessionForm({ onCreated }: CreateSessionFormProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<LocalPatientSync[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const newSession: LocalSession = {
        id: crypto.randomUUID(),
        title: title.trim(),
        date,
        time,
        patientIds: selectedPatients.map(p => p.id),
        syncStatus: 'pending_create',
        lastModifiedAt: new Date().toISOString(),
      };

      await createSession(newSession);
      setTitle('');
      setDate('');
      setTime('');
      setSelectedPatients([]);
      onCreated?.();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">New session</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Weekly assessment"
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Time</label>
            <input
              type="time"
              required
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <PatientAutocomplete
          selectedPatients={selectedPatients}
          onChange={setSelectedPatients}
        />

        <div className="flex justify-end pt-1">
          <Button type="submit" size="sm" loading={submitting} disabled={!title.trim() || !date || !time}>
            Create session
          </Button>
        </div>
      </form>
    </Card>
  );
}
