import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import EvidencePhoto from './EvidencePhoto.jsx';
import { ModelTag } from './ui.jsx';

/**
 * The dark "lab" screen shown while Meta AI works. The step list is driven by
 * real server events; the planned steps give it shape before they arrive.
 */
const PLAN = [
  { key: 'quality', text: 'Checking the photo is clear', model: null },
  { key: 'reading', text: 'Reading the label', model: 'Muse Spark' },
  { key: 'regions', text: 'Finding the barcode, label and date block', model: 'SAM 3.1' },
  { key: 'tamper', text: 'Examining the date area for tampering', model: 'Muse Spark' },
  { key: 'rules', text: 'Checking NAFDAC data and the ledger', model: 'Rule engine' },
];

const PACK_PROGRESS = { quality: 1, reading: 1, read: 2, regions: 3, tamper: 3, artwork: 3 };

export default function Analysis({ photo, steps, captions = true, title = 'Checking your pack', plan = PLAN, progress = PACK_PROGRESS, media }) {
  const seen = new Set(steps.map((s) => s.step));
  const brand = steps.find((s) => s.step === 'read')?.brand;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 100);
    return () => clearInterval(id);
  }, []);

  // How many planned steps each server event completes; the next one is active.
  const activeIdx = Math.min(plan.length - 1, Math.max(0, ...[...seen].map((k) => progress[k] ?? 0)));

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[1.05fr_1fr] md:items-center md:py-12">
      <div className="relative">
        {media ?? <EvidencePhoto src={photo} scanning className="ring-1 ring-lab-line shadow-[0_0_80px_-20px_rgba(61,220,151,.45)]" />}
        <AnimatePresence>
          {brand && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-4 left-4 right-4 rounded-2xl bg-lab/80 p-3 ring-1 ring-lab-line backdrop-blur">
              <p className="text-[11px] uppercase tracking-widest text-lab-dim mono">Read from pack</p>
              <p className="display text-xl font-semibold text-lab-ink">{brand}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div>
        <div className="mb-5 flex items-baseline justify-between">
          <h1 className="display text-2xl font-semibold md:text-3xl">{title}</h1>
          <span className="mono text-sm text-lab-dim tabular-nums">{elapsed.toFixed(1)}s</span>
        </div>
        <ol className="space-y-2">
          {plan.map((p, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <motion.li
                key={p.key}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: i <= activeIdx ? 1 : 0.4, x: 0 }} transition={{ delay: i * 0.06 }}
                className={clsx('flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 transition', active ? 'bg-lab-3 ring-mint/40' : 'bg-lab-2/60 ring-lab-line')}
              >
                <span className={clsx('grid size-7 shrink-0 place-items-center rounded-full', done ? 'bg-mint text-lab' : active ? 'bg-mint/15 text-mint' : 'bg-white/5 text-lab-dim')}>
                  {done ? <Check className="size-4" strokeWidth={3} /> : active ? <Loader2 className="size-4 animate-spin" /> : <span className="mono text-xs">{i + 1}</span>}
                </span>
                <span className="flex-1 text-[15px]">{p.text}</span>
                {captions && p.model && <ModelTag dark model={p.model} active={active} />}
              </motion.li>
            );
          })}
        </ol>
        <p className="mt-5 text-sm text-lab-dim">Hard facts decide a High-risk verdict. AI findings alone can only raise Caution.</p>
      </div>
    </div>
  );
}
