import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from "react";

/* ---------- Page shell ---------- */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      {children}
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-text-primary">{title}</h1>
      {subtitle && <p className="mt-1 text-base text-text-muted">{subtitle}</p>}
    </div>
  );
}

/* ---------- Card ---------- */
export function Card({
  children,
  className = "",
  ...props
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-md border border-border-light bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/* ---------- Card grid ---------- */
export function CardGrid({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div
      className={`grid gap-4 ${compact ? "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(260px,1fr))]"}`}
    >
      {children}
    </div>
  );
}

/* ---------- Buttons ---------- */
type ButtonVariant = "default" | "primary" | "danger" | "ghost";

const btnBase =
  "inline-flex items-center justify-center font-medium rounded-sm transition-colors cursor-pointer min-h-[40px] text-sm focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2";

const btnVariants: Record<ButtonVariant, string> = {
  default:
    "border border-border-default bg-surface text-text-primary hover:bg-bg hover:shadow-card",
  primary:
    "border border-brand bg-brand text-white hover:bg-brand-hover",
  danger:
    "border border-danger text-danger hover:bg-danger-light",
  ghost:
    "border-none bg-transparent text-brand hover:underline p-0 min-h-0",
};

export function Button({
  variant = "default",
  small = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  small?: boolean;
}) {
  return (
    <button
      className={`${btnBase} ${small ? "px-2 py-1 text-xs min-h-[32px]" : "px-4 py-2"} ${btnVariants[variant]} ${className}`}
      {...props}
    />
  );
}

/* ---------- Inputs ---------- */
export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-sm border border-border-default bg-surface px-4 py-2 text-base text-text-primary min-h-[40px] transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-sm border border-border-default bg-surface px-4 py-2 text-base text-text-primary min-h-[40px] transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light ${className}`}
      {...props}
    />
  );
}

/* ---------- Field label (stacked: label above input) ---------- */
export function FieldLabel({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

/* ---------- Chips ---------- */
type ChipVariant = "success" | "warning" | "danger" | "info" | "neutral";

const chipVariants: Record<ChipVariant, string> = {
  success: "bg-success-bg text-success-text",
  warning: "bg-warning-bg text-warning-text",
  danger: "bg-conflict-bg text-conflict-text",
  info: "bg-info-bg text-info-text",
  neutral: "bg-neutral-bg text-neutral-text",
};

export function Chip({
  variant = "neutral",
  children,
  className = "",
  ...props
}: {
  variant?: ChipVariant;
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-block rounded-pill px-2 py-0.5 text-xs font-medium ${chipVariants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border-default bg-bg p-8 text-center text-sm text-text-muted">
      {children}
    </div>
  );
}

/* ---------- Section ---------- */
export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      {title && <h2 className="mb-4 text-xl font-semibold text-text-primary">{title}</h2>}
      {children}
    </section>
  );
}

/* ---------- Nav bar ---------- */
export function NavBar({ children }: { children: ReactNode }) {
  return (
    <nav className="mt-8 flex flex-wrap items-center gap-3 border-t border-border-light pt-4">
      {children}
    </nav>
  );
}

/* ---------- Form row ---------- */
export function FormRow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-end gap-2">
      {children}
    </div>
  );
}

/* ---------- Action group ---------- */
export function ActionGroup({ children }: { children: ReactNode }) {
  return <div className="mt-8 flex gap-3">{children}</div>;
}
