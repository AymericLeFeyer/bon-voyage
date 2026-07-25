import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';

interface DeleteTripDialogProps {
  open: boolean;
  /** Titre du voyage : rappelé et à retaper pour confirmer. */
  title: string;
  /** Contenu perdu, rappelé dans l'avertissement. */
  stageCount?: number;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

/**
 * Garde-fou de suppression : la suppression est définitive (le voyage est un
 * document JSON, aucune corbeille), on demande donc de retaper le titre exact.
 */
export function DeleteTripDialog({
  open,
  title,
  stageCount,
  onCancel,
  onConfirm,
}: DeleteTripDialogProps) {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setConfirmation('');
      setError(null);
    }
  }, [open]);

  const expected = title.trim();
  const matches = confirmation.trim().toLowerCase() === expected.toLowerCase() && expected !== '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!matches || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('La suppression a échoué. Réessayez.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open={open} onClose={deleting ? () => {} : onCancel} className="w-full max-w-md">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle className="h-5 w-5 text-red-600" /> Supprimer le voyage
        </h2>
        <Button variant="ghost" size="icon" onClick={onCancel} disabled={deleting} title="Fermer">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={submit} className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="space-y-2 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">
          <p>
            <span className="font-semibold">{expected || 'Ce voyage'}</span> sera{' '}
            <span className="font-semibold">définitivement supprimé</span> : étapes, lieux,
            hébergements, budget et accès des participants.
          </p>
          {stageCount !== undefined && stageCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {stageCount} étape{stageCount > 1 ? 's' : ''} seront perdues. Cette action est
              irréversible.
            </p>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm">
            Pour confirmer, retapez le titre : <span className="font-semibold">{expected}</span>
          </span>
          <Input
            value={confirmation}
            autoFocus
            placeholder={expected}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={deleting}>
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={!matches || deleting}
            className="bg-red-600 text-white hover:bg-red-600/90"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Supprimer définitivement
          </Button>
        </div>
      </form>
    </Modal>
  );
}
