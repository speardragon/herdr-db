import type { ReactNode } from 'react';

export type BannerVariant = 'info' | 'warn' | 'danger' | 'success';

export function Banner({ variant, title, children }: { variant: BannerVariant; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={`banner banner-${variant}`} role={variant === 'danger' ? 'alert' : 'status'}>
      <div>
        <strong>{title}</strong>
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export function StatCards({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="stat-cards">
      {items.map((item) => (
        <div className="stat-card" key={item.label}>
          <div className="label">{item.label}</div>
          <div className="value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
