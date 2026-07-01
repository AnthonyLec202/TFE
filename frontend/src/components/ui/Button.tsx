import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-petrol-600 text-white hover:bg-petrol-700 focus-visible:ring-petrol-600',
  secondary:
    'bg-sand-100 text-ink-700 hover:bg-sand-200 focus-visible:ring-sand-400',
  ghost:
    'text-taupe-500 hover:bg-sand-100 focus-visible:ring-sand-400',
  danger:
    'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500',
  // Discreet destructive action: no fill, red text, soft red hover — for toolbar/header actions
  // where a solid red button would be too heavy.
  dangerGhost:
    'text-red-600 hover:bg-red-50 focus-visible:ring-red-500',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
