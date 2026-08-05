import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'ok' | 'warn' | 'danger' | 'neutral' | 'brand';
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Money({ value }: { value: number }) {
  return (
    <span className="mono">
      {new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      }).format(value)}
    </span>
  );
}

export function Loading() {
  return (
    <div className="loading-state page-enter" role="status">
      <span className="loading-spinner" aria-hidden />
      Cargando…
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="error-banner page-enter">{message}</div>;
}
