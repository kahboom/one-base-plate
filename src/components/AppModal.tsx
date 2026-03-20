import { useEffect, type ReactNode } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

const DEFAULT_BACKDROP =
  "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";

interface AppModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  /** Classes for the full-screen overlay (positioning, padding). */
  backdropClassName?: string;
  closeOnBackdropClick?: boolean;
  backdropTestId?: string;
  /** Applied to the bordered panel (not the backdrop). */
  panelTestId?: string;
}

export default function AppModal({
  open,
  onClose,
  ariaLabel,
  children,
  className = "",
  backdropClassName = DEFAULT_BACKDROP,
  closeOnBackdropClick = true,
  backdropTestId,
  panelTestId,
}: AppModalProps) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={backdropClassName}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-testid={backdropTestId}
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        className={`w-full rounded-md border border-border-light bg-surface shadow-card-hover ${className}`}
        data-testid={panelTestId}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
