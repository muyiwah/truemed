import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, CircleHelp, ScanSearch, Loader2 } from 'lucide-react';

export function Logo({ dark = false, size = 'md' }) {
  const s = size === 'lg' ? 'text-2xl' : 'text-lg';
  return (
    <Link to="/" className={clsx('inline-flex items-center gap-2 font-bold display', s, dark ? 'text-lab-ink' : 'text-ink')} aria-label="TrueMed home">
      <span className={clsx('grid place-items-center rounded-[10px] bg-brand text-white', size === 'lg' ? 'size-9' : 'size-7')}>
        <svg viewBox="0 0 24 24" className="size-[62%]" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <span>True<span className={dark ? 'text-mint' : 'text-brand'}>Med</span></span>
    </Link>
  );
}

export function Button({ as: As = 'button', variant = 'primary', size = 'lg', className, children, loading, ...props }) {
  const base = 'relative inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none select-none';
  const sizes = { lg: 'h-14 px-6 rounded-2xl text-[17px]', md: 'h-11 px-4 rounded-xl text-[15px]', sm: 'h-9 px-3 rounded-lg text-sm' };
  const variants = {
    primary: 'bg-brand text-white shadow-lift hover:bg-brand-2',
    secondary: 'bg-card text-ink border border-line hover:border-ink-3 shadow-card',
    ghost: 'text-ink-2 hover:bg-black/5',
    danger: 'bg-bad text-white hover:brightness-110',
    lab: 'bg-mint text-lab hover:brightness-110',
    labGhost: 'text-lab-ink border border-lab-line hover:bg-white/5',
  };
  return (
    <As className={clsx(base, sizes[size], variants[variant], className)} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="size-5 animate-spin" />}
      {children}
    </As>
  );
}

/** A Meta model named on screen while it works (demo rule: name each model). */
export function ModelTag({ model, dark = false, active = false, className }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider mono',
      dark ? 'bg-white/5 text-lab-ink ring-1 ring-lab-line' : 'bg-brand-soft text-brand',
      className,
    )}>
      <span className={clsx('size-1.5 rounded-full', active ? 'bg-mint animate-pulse' : dark ? 'bg-lab-dim' : 'bg-brand')} />
      {model}
    </span>
  );
}

export function Card({ className, children, ...p }) {
  return <div className={clsx('rounded-3xl bg-card border border-line shadow-card', className)} {...p}>{children}</div>;
}

export function Page({ children, className, lab = false }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
      className={clsx('min-h-dvh', lab && 'lab', className)}
    >
      {children}
    </motion.main>
  );
}

export function TopBar({ dark = false, right, back }) {
  return (
    <header className={clsx('sticky top-0 z-30 backdrop-blur-md', dark ? 'bg-lab/70 border-b border-lab-line' : 'bg-paper/80 border-b border-line/70')}>
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2">{back}<Logo dark={dark} /></div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

/** Verdict code → colours and icon. Same mapping everywhere. */
export const VERDICT = {
  genuine_authorized: { tone: 'ok', Icon: ShieldCheck, ring: 'ring-ok/30', bg: 'bg-ok', soft: 'bg-ok-soft', text: 'text-ok' },
  checked_open_market: { tone: 'ok', Icon: ShieldCheck, ring: 'ring-ok/30', bg: 'bg-ok', soft: 'bg-ok-soft', text: 'text-ok' },
  no_red_flags: { tone: 'ok', Icon: ShieldCheck, ring: 'ring-ok/30', bg: 'bg-ok', soft: 'bg-ok-soft', text: 'text-ok' },
  caution: { tone: 'warn', Icon: ShieldAlert, ring: 'ring-warn/30', bg: 'bg-warn', soft: 'bg-warn-soft', text: 'text-warn' },
  high_risk: { tone: 'bad', Icon: ShieldX, ring: 'ring-bad/30', bg: 'bg-bad', soft: 'bg-bad-soft', text: 'text-bad' },
  no_record: { tone: 'mute', Icon: ShieldQuestion, ring: 'ring-mute/30', bg: 'bg-mute', soft: 'bg-mute-soft', text: 'text-mute' },
  cant_verify: { tone: 'mute', Icon: CircleHelp, ring: 'ring-mute/30', bg: 'bg-mute', soft: 'bg-mute-soft', text: 'text-mute' },
  needs_confirmation: { tone: 'info', Icon: ScanSearch, ring: 'ring-info/30', bg: 'bg-info', soft: 'bg-info-soft', text: 'text-info' },
};

export function ErrorNote({ children, onRetry, dark }) {
  return (
    <div role="alert" className={clsx('rounded-2xl p-4 text-[15px]', dark ? 'bg-bad/15 text-lab-ink ring-1 ring-bad/40' : 'bg-bad-soft text-ink ring-1 ring-bad/20')}>
      <p>{children}</p>
      {onRetry && <button onClick={onRetry} className="mt-2 font-semibold underline underline-offset-4">Try again</button>}
    </div>
  );
}
