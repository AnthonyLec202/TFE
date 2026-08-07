import { Button } from './Button';
import { Card } from './Card';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  // French defaults: the whole interface is French, so an omitted label must not leak English into a
  // dialog. Call sites that pass their own label still win.
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <Card className="w-full max-w-sm p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
