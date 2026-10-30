import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Siren, Copy as CopyIcon, BellOff } from 'lucide-react';
import clsx from 'clsx';
import { TopBar, Page } from '../components/ui.jsx';
import { useSettings } from '../lib/settings.jsx';
import { get, post } from '../lib/api.js';

const ago = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(d).toLocaleDateString();
};

export default function Notifications() {
  const { verified, shop } = useSettings();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => get('/notifications'), enabled: verified, refetchInterval: 8000 });
  useEffect(() => { if (verified && data.some((n) => !n.readAt)) post('/notifications/read').then(() => qc.invalidateQueries({ queryKey: ['notifications'] })).catch(() => {}); }, [data, verified, qc]);

  return (
    <Page>
      <TopBar back={<button onClick={() => navigate(-1)} className="grid size-9 place-items-center rounded-full hover:bg-black/5" aria-label="Back"><ArrowLeft className="size-5" /></button>} />
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="display text-4xl font-bold">Alerts for your shop</h1>
        <p className="mt-1 text-ink-3">{shop?.name ?? 'Sign in as a pharmacy or chemist to see alerts.'}</p>
        {isLoading && <p className="mt-6 text-ink-3">Loading…</p>}
        {!isLoading && verified && data.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-2 text-center text-ink-3"><BellOff className="size-8" /><p>No alerts. When NAFDAC flags a batch you hold, or someone copies one of your serials, it appears here.</p></div>
        )}
        <ul className="mt-6 space-y-3">
          {data.map((n, i) => {
            const recall = n.type === 'recall';
            const Icon = recall ? Siren : CopyIcon;
            return (
              <motion.li key={n._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={clsx('flex gap-3 rounded-3xl border bg-card p-4 shadow-card', n.readAt ? 'border-line' : 'border-bad/40')}>
                <span className={clsx('grid size-11 shrink-0 place-items-center rounded-2xl', recall ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn')}><Icon className="size-5" /></span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2"><p className="font-semibold">{n.title}</p><span className="shrink-0 text-xs text-ink-3">{ago(n.createdAt)}</span></div>
                  <p className="text-[15px] text-ink-2">{n.message}</p>
                  {n.refs?.serials?.length > 0 && <p className="mono mt-1 text-xs text-ink-3">{n.refs.serials.join(' · ')}</p>}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </Page>
  );
}
