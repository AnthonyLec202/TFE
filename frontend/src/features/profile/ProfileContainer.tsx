import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../auth';
import { changePassword } from '../../services/authService';
import { deleteAccount } from '../../services/userService';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ChangePasswordForm } from './components/ChangePasswordForm';

const ROLE_LABELS: Record<string, string> = {
  Admin: 'Administrateur',
  Other: 'Collaborateur',
};

export function ProfileContainer() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.roles?.includes('Admin') ? 'Admin' : 'Other'];

  async function handleChangePassword(currentPassword: string, newPassword: string) {
    setPwError('');
    setPwSuccess(false);
    setPwLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess(true);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setPwLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    setIsDeleting(true);
    try {
      await deleteAccount(user.userId);
      logout();
      navigate('/login');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Mon profil</h1>

      {/* Account information */}
      <Card className="p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Informations</h2>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Mail className="h-4 w-4 text-slate-400" />
          {user.email}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          {roleLabel}
        </div>
      </Card>

      {/* Change password */}
      <Card className="p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-700">Changer le mot de passe</h2>
        <ChangePasswordForm
          onSubmit={handleChangePassword}
          loading={pwLoading}
          error={pwError}
          success={pwSuccess}
        />
      </Card>

      {/* Delete account */}
      <Card className="p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-red-700">Supprimer le compte</h2>
        <p className="text-sm text-slate-500">
          Cette action est irréversible. Vos données seront supprimées et vos publications anonymisées.
        </p>
        {deleteError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {deleteError}
          </p>
        )}
        <div>
          <Button variant="danger" size="sm" onClick={() => setIsConfirmDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Supprimer mon compte
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={isConfirmDeleteOpen}
        title="Supprimer le compte"
        message="Votre compte et vos données seront définitivement supprimés. Cette action est irréversible."
        confirmLabel="Supprimer"
        loading={isDeleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setIsConfirmDeleteOpen(false)}
      />
    </div>
  );
}
