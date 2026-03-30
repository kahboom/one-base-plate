import { useState, useCallback } from 'react';
import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from 'react';
import AppModal from './AppModal';
import { Link, useParams, useLocation } from 'react-router-dom';
import {
  GLOBAL_NAV_ITEMS,
  SECONDARY_NAV_ITEMS,
  buildHouseholdPath,
  isGlobalNavItemActive,
  isSecondaryNavItemActive,
} from '../nav/householdNavConfig';

/* ---------- App header (OneBasePlate brand) ---------- */
export function AppHeader() {
  const { householdId } = useParams<{ householdId?: string }>();
  const homeHref = householdId ? `/household/${householdId}/home` : '/households';
  return (
    <header className="mb-6 pb-4 border-b border-border-light">
      <Link
        to={homeHref}
        className="text-2xl font-bold tracking-tight text-text-primary hover:text-brand transition-colors"
      >
        OneBasePlate
      </Link>
    </header>
  );
}

/* ---------- Page shell ---------- */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <AppHeader />
      {children}
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({
  title,
  subtitle,
  subtitleTo,
}: {
  title: string;
  subtitle?: string;
  subtitleTo?: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">{title}</h1>
      {subtitle && (
        <p className="mt-2 text-sm text-text-secondary">
          {subtitleTo ? (
            <Link to={subtitleTo} className="font-medium text-brand hover:underline">
              {subtitle}
            </Link>
          ) : (
            subtitle
          )}
        </p>
      )}
    </div>
  );
}

/* ---------- Card ---------- */
export function Card({
  children,
  className = '',
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
export function CardGrid({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-4 ${compact ? 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(260px,1fr))]'}`}
    >
      {children}
    </div>
  );
}

/* ---------- Buttons ---------- */
type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';

const btnBase =
  'inline-flex items-center justify-center font-medium rounded-sm transition-colors cursor-pointer min-h-[44px] text-sm focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2';

const btnVariants: Record<ButtonVariant, string> = {
  default:
    'border border-border-default bg-surface text-text-primary hover:bg-bg hover:shadow-card',
  primary: 'border border-brand bg-brand text-white hover:bg-brand-hover',
  danger: 'border border-danger text-danger hover:bg-danger-light',
  ghost: 'border-none bg-transparent text-brand hover:underline p-0 min-h-0',
};

export function Button({
  variant = 'default',
  small = false,
  type = 'button',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  small?: boolean;
}) {
  return (
    <button
      type={type}
      className={`${btnBase} ${small ? 'px-3 py-1.5 text-xs min-h-[36px]' : 'px-4 py-2'} ${btnVariants[variant]} disabled:cursor-not-allowed disabled:opacity-45 disabled:pointer-events-none ${className}`}
      {...props}
    />
  );
}

/* ---------- Inputs ---------- */
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-sm border border-border-default bg-surface px-4 py-2 text-base text-text-primary min-h-[44px] transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-sm border border-border-default bg-surface px-4 py-2 text-base text-text-primary min-h-[44px] transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

/* ---------- Field label (stacked: label above input) ---------- */
export function FieldLabel({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

/* ---------- Chips ---------- */
type ChipVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const chipVariants: Record<ChipVariant, string> = {
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-conflict-bg text-conflict-text',
  info: 'bg-info-bg text-info-text',
  neutral: 'bg-neutral-bg text-neutral-text',
};

export function Chip({
  variant = 'neutral',
  children,
  className = '',
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
export function Section({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mb-8 ${className}`}>
      {title && <h2 className="mb-4 text-xl font-semibold text-text-primary">{title}</h2>}
      {children}
    </section>
  );
}

/* ---------- Nav bar ---------- */
export function NavBar({
  children,
  placement = 'bottom',
}: {
  children: ReactNode;
  placement?: 'top' | 'bottom';
}) {
  const isTop = placement === 'top';
  return (
    <nav
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${
        isTop ? 'mb-6 border-b border-border-light pb-4' : 'mt-8 border-t border-border-light pt-4'
      }`}
    >
      {children}
    </nav>
  );
}

/** Primary destinations: pill bar inside the unified household nav card */
function globalNavRowClass() {
  return 'flex flex-wrap items-center gap-1.5 rounded-t-md border-b border-border-light bg-surface px-2 py-2 sm:gap-2 sm:px-3';
}

export function GlobalNav({ householdId }: { householdId?: string }) {
  const location = useLocation();
  const currentPath = location.pathname;

  if (!householdId) {
    return null;
  }

  return (
    <nav className={globalNavRowClass()} data-testid="global-nav" aria-label="Global navigation">
      {GLOBAL_NAV_ITEMS.map((item) => {
        const href = buildHouseholdPath(householdId, item.path);
        const active = isGlobalNavItemActive(currentPath, householdId, item.path);
        return (
          <Link
            key={item.path}
            to={href}
            className={navLinkClass(active)}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SecondaryNav({ householdId }: { householdId?: string }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const items = SECONDARY_NAV_ITEMS.filter(
    (item) => item.path === '/households' || Boolean(householdId),
  );

  const showDividerAbove = Boolean(householdId);

  return (
    <nav
      className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 py-2.5 sm:px-4 ${
        showDividerAbove ? 'border-t border-border-light bg-bg' : 'bg-bg'
      }`}
      data-testid="section-nav"
      aria-label="Secondary navigation"
    >
      {items.map((item) => {
        const href = buildHouseholdPath(householdId, item.path);
        const active = isSecondaryNavItemActive(currentPath, householdId, item.path);
        return (
          <Link
            key={item.path}
            to={href}
            className={secondaryNavLinkClass(active)}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** @deprecated Use SecondaryNav; kept for tests and incremental migration */
export const SectionNav = SecondaryNav;

/** Global + secondary navigation stack (PRD F053) — single card, secondary row is text links */
export function HouseholdNavStack({ householdId }: { householdId?: string }) {
  return (
    <div className="mb-6 overflow-hidden rounded-md border border-border-light bg-surface shadow-card">
      <GlobalNav householdId={householdId} />
      <SecondaryNav householdId={householdId} />
    </div>
  );
}

/* ---------- Backward-compatible global nav alias ---------- */
export function HouseholdNav({ householdId }: { householdId?: string }) {
  return <GlobalNav householdId={householdId} />;
}

function navLinkClass(isActive: boolean) {
  const base =
    'inline-flex items-center rounded-pill px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px] whitespace-nowrap';
  return isActive
    ? `${base} bg-brand text-white`
    : `${base} text-text-secondary hover:bg-brand-light hover:text-brand`;
}

function secondaryNavLinkClass(isActive: boolean) {
  const base =
    'inline-flex items-center rounded-md px-0.5 py-1 text-sm transition-colors min-h-[36px] whitespace-nowrap';
  return isActive
    ? `${base} font-semibold text-brand`
    : `${base} font-medium text-text-secondary hover:text-brand`;
}

/* ---------- Form row ---------- */
export function FormRow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">{children}</div>
  );
}

/* ---------- Action group ---------- */
export function ActionGroup({
  children,
  placement = 'bottom',
}: {
  children: ReactNode;
  placement?: 'top' | 'bottom';
}) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${placement === 'top' ? 'mb-6' : 'mt-8'}`}>
      {children}
    </div>
  );
}

/* ---------- Confirm dialog ---------- */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <AppModal open={open} onClose={onCancel} ariaLabel={title} className="max-w-sm p-6">
      <h2 className="mb-2 text-lg font-bold text-text-primary">{title}</h2>
      <p className="mb-6 text-sm text-text-secondary">{message}</p>
      <div className="flex gap-3">
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </AppModal>
  );
}

/* ---------- useConfirm hook ---------- */
export function useConfirm() {
  const [pending, setPending] = useState<{
    entityName: string;
    action: () => void | Promise<void>;
  } | null>(null);

  const requestConfirm = useCallback((entityName: string, action: () => void | Promise<void>) => {
    setPending({ entityName, action });
  }, []);

  const confirm = useCallback(async () => {
    await pending?.action();
    setPending(null);
  }, [pending]);

  const cancel = useCallback(() => {
    setPending(null);
  }, []);

  return { pending, requestConfirm, confirm, cancel };
}
