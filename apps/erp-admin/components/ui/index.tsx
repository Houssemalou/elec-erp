import { cn } from '@/lib/utils'

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}) {
  const variants = {
    primary:
      'bg-accent-400 text-[#0B0B0B] hover:bg-accent-300 shadow-sm focus-visible:ring-accent-400 hover:shadow-glow',
    secondary:
      'bg-[#151515] text-white border border-[#2A2A2A] hover:bg-[#222222] hover:border-accent-400/30 focus-visible:ring-accent-400',
    outline:
      'border border-[#2A2A2A] bg-transparent text-white/70 hover:bg-white/5 hover:border-accent-400/30 focus-visible:ring-accent-400',
    ghost: 'text-white/60 hover:bg-white/5 hover:text-white focus-visible:ring-white/20',
    danger: 'bg-red-500 text-white hover:bg-red-400 shadow-sm focus-visible:ring-red-500',
  }
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-5 text-sm',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-[#2A2A2A] bg-[#151515] shadow-card', className)}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#2A2A2A] px-5 py-4">
      <div>
        <h3 className="font-display text-sm font-semibold text-white">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-white/50">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block text-xs font-medium text-white/60', className)}
      {...props}
    />
  )
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white placeholder:text-white/40 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/20 disabled:bg-[#0B0B0B] disabled:text-white/40',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-sm text-white focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/20',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/20',
        className,
      )}
      {...props}
    />
  )
}

const badgeTones: Record<string, string> = {
  slate: 'bg-white/10 text-white/70 ring-white/20',
  blue: 'bg-accent-400/10 text-accent-400 ring-accent-400/20',
  green: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  amber: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  red: 'bg-red-500/10 text-red-400 ring-red-500/20',
  accent: 'bg-accent-400/10 text-accent-400 ring-accent-400/30',
}

export function Badge({
  tone = 'slate',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  )
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-[#2A2A2A] bg-[#0B0B0B] text-left text-xs font-semibold uppercase tracking-wide text-white/50">
      {children}
    </thead>
  )
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('border-b border-[#2A2A2A] transition-colors hover:bg-white/5', className)}
      {...props}
    />
  )
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-4 py-3 font-semibold text-white/70', className)} {...props} />
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 text-white/70', className)} {...props} />
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">{title}</h1>
        {description ? <p className="mt-1 text-sm text-white/50">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Alert({
  tone = 'amber',
  children,
}: {
  tone?: 'amber' | 'red' | 'green' | 'blue'
  children: React.ReactNode
}) {
  const tones = {
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    red: 'border-red-500/20 bg-red-500/10 text-red-400',
    green: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    blue: 'border-accent-400/20 bg-accent-400/10 text-accent-400',
  }
  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', tones[tone])}>{children}</div>
  )
}
