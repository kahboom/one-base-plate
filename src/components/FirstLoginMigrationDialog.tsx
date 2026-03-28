import { useState } from 'react';
import AppModal from './AppModal';
import { Button } from './ui';
import type { FirstLoginContext, ConflictChoice } from '../sync/types';

interface Props {
  open: boolean;
  context: FirstLoginContext;
  onResolve: (choice: ConflictChoice) => void;
  onCancel: () => void;
}

export default function FirstLoginMigrationDialog({ open, context, onResolve, onCancel }: Props) {
  const [busy, setBusy] = useState(false);

  const localCount = context.localHouseholds.length;
  const remoteCount = context.remoteHouseholds.length;

  function handle(choice: ConflictChoice) {
    setBusy(true);
    onResolve(choice);
  }

  return (
    <AppModal
      open={open}
      onClose={onCancel}
      ariaLabel="Sync local and cloud data"
      className="max-w-md p-6"
      closeOnBackdropClick={false}
    >
      <h2 className="mb-2 text-lg font-bold text-text-primary">Sync your data</h2>
      <p className="mb-4 text-sm text-text-secondary">
        You have <strong>{localCount}</strong> household{localCount !== 1 ? 's' : ''} on this device
        and <strong>{remoteCount}</strong> in your cloud account. How would you like to proceed?
      </p>

      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          disabled={busy}
          data-testid="migration-keep-local"
          onClick={() => handle('keep-local')}
        >
          Keep this device's data and upload it
        </Button>
        <Button
          disabled={busy}
          data-testid="migration-keep-remote"
          onClick={() => handle('keep-remote')}
        >
          Use cloud data and replace this device
        </Button>
        <Button disabled={busy} data-testid="migration-merge" onClick={() => handle('merge')}>
          Merge both (combine by household)
        </Button>
        <Button variant="ghost" disabled={busy} data-testid="migration-cancel" onClick={onCancel}>
          Cancel and stay signed out
        </Button>
      </div>

      {busy && (
        <p className="mt-4 text-xs text-text-muted" data-testid="migration-busy">
          Syncing...
        </p>
      )}
    </AppModal>
  );
}
