import type { ReactNode } from "react";

interface AppModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

export default function AppModal({
  open,
  onClose,
  ariaLabel,
  children,
  className = "",
}: AppModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <div
        className={`w-full rounded-md border border-border-light bg-surface shadow-card-hover ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
