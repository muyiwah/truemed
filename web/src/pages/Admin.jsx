import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Radar, CheckCircle2, RotateCcw, Printer, Activity, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { TopBar, Page, Button, ErrorNote, ModelTag, Card } from '../components/ui.jsx';
import { get, post, safeGet, safeSet } from '../lib/api.js';
import Videos from '../components/Videos.jsx';

/** Hidden admin: Sentinel (ingest → review → approve → warn shops) and DemoQuin controls. */
export default function Admin() {
  const navigate = useNavigate();
  const [pin, setPin] = useState(() => safeGet('tm.adminPin') ?? '');
  const [unlocked, setUnlocked] = useState(Boolean(safeGet('tm.adminPin')));
  return (
    <Page>
      <TopBar back={<button onClick={() => navigate('/')} className="grid size-9 place-items-center rounded-full hover:bg-black/5" aria-label="Back"><ArrowLeft className="size-5" /></button>} />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="display text-4xl font-bold">Control room</h1>
        {!unlocked ? (
          <form className="mt-6 flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); safeSet('tm.adminPin', pin); setUnlocked(true); }}>
            <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" placeholder="Admin PIN" className="h-12 flex-1 rounded-xl border border-line bg-card px-3" />
            <Button size="md" type="submit">Unlock</Button>
          </form>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <Sentinel />
            <div className="space-y-6"><Health /><Demo /></div>
            <div className="lg:col-span-2"><Videos /></div>
          </div>
        )}
      </div>
    </Page>
  );
}

function Sentinel() {
  const qc = useQueryClient();
  const { data: alerts = [] } = useQuery({ queryKey: ['alerts'], queryFn: () => get('/alerts') });
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [approved, setApproved] = useState(null);
  const [error, setError] = useState(null);

  const ingest = async () => {
    setBusy(true); setError(null); setDraft(null); setApproved(null);
    try { setDraft(await post('/alerts/ingest', url ? { url } : { text })); qc.invalidateQueries({ queryKey: ['alerts'] }); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const approve = async () => {
    setBusy(true);
    try { setApproved(await post(`/alerts/${draft.alert._id}/approve`, {})); setDraft(null); qc.invalidateQueries({ queryKey: ['alerts'] }); } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="display flex items-center gap-2 text-2xl font-semibold"><Radar className="size-6 text-brand" />Sentinel</h2>
        <ModelTag model="Muse Spark + web search" />
      </div>
      <p className="text-ink-2">Paste a NAFDAC alert link or its text. Muse Spark turns it into batch records; you approve before anything is saved; every shop holding a match is warned.</p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://nafdac.gov.ng/public-alert-…" className="mt-4 h-12 w-full rounded-xl border border-line bg-paper px-3" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste the alert text" rows={4} className="mt-2 w-full rounded-xl border border-line bg-paper p-3" />
      <Button className="mt-3 w-full" loading={busy && !draft} disabled={!url && !text} onClick={ingest}>Read alert</Button>
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}

      {draft && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-2xl border-2 border-info bg-info-soft/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-info">Pending your approval · read via {draft.via}</p>
          <p className="display mt-1 text-xl font-semibold">{draft.alert.title}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Field k="Alert no." v={draft.alert.alertNo} /><Field k="Type" v={draft.alert.type} />
            <Field k="Product" v={draft.alert.productName} /><Field k="Reg no. on fake" v={draft.alert.regNoOnFake} />
            <Field k="Batches" v={draft.alert.batches?.map((b) => `${b.batchNo}${b.expiry ? ` (${b.expiry})` : ''}`).join(', ')} mono />
          </dl>
          {draft.alert.telltaleSigns?.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm">{draft.alert.telltaleSigns.map((s, i) => <li key={i}>{s}</li>)}</ul>}
          <p className="mt-3 rounded-xl bg-card p-3 text-sm"><span className="font-semibold">{draft.preview.packs}</span> logged pack(s) in <span className="font-semibold">{draft.preview.shops}</span> shop(s) match this alert.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="md" loading={busy} onClick={approve}><CheckCircle2 className="size-4" />Approve & warn</Button>
            <Button size="md" variant="secondary" onClick={() => post(`/alerts/${draft.alert._id}/reject`).then(() => { setDraft(null); qc.invalidateQueries({ queryKey: ['alerts'] }); })}>Discard</Button>
          </div>
        </motion.div>
      )}
      {approved && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-5 rounded-2xl bg-ok-soft p-4">
          <p className="font-semibold text-ok">Approved. {approved.notified.length} shop(s) warned.</p>
          <ul className="mt-2 space-y-1 text-sm">{approved.notified.map((n) => <li key={n.shopId}>{n.name}, {n.city} — {n.packs} pack(s)</li>)}</ul>
        </motion.div>
      )}

      <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-ink-3">Alerts on record</h3>
      <ul className="divide-y divide-line">
        {alerts.map((a) => (
          <li key={a._id} className="flex items-start gap-3 py-2 text-sm">
            <span className={clsx('mt-1 size-2 shrink-0 rounded-full', a.status === 'approved' ? 'bg-ok' : a.status === 'pending' ? 'bg-info' : 'bg-mute')} />
            <span className="flex-1">{a.title}{a.alertNo && <span className="text-ink-3"> · {a.alertNo}</span>}</span>
            {/^https?:/.test(a.sourceUrl) && <a href={a.sourceUrl} target="_blank" rel="noreferrer" className="text-brand"><ExternalLink className="size-4" /></a>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const Field = ({ k, v, mono }) => (<div><dt className="text-ink-3">{k}</dt><dd className={clsx('font-semibold', mono && 'mono')}>{v || '—'}</dd></div>);

function Health() {
  const { data } = useQuery({ queryKey: ['health'], queryFn: () => get('/health'), refetchInterval: 15000 });
  const row = (k, ok, v) => <li className="flex justify-between py-1.5"><span className="text-ink-2">{k}</span><span className={clsx('font-semibold', ok ? 'text-ok' : 'text-bad')}>{v}</span></li>;
  return (
    <Card className="p-5">
      <h2 className="display mb-2 flex items-center gap-2 text-xl font-semibold"><Activity className="size-5 text-brand" />Health</h2>
      {data && (
        <ul className="divide-y divide-line text-sm">
          {row('Database', data.database === 'connected', data.database)}
          {row('Meta API', data.meta === 'configured', data.meta)}
          {row('ImageKit', data.storage === 'configured', data.storage)}
          {row('Data', true, `${data.data.products} products · ${data.data.alerts} alerts · ${data.data.shops} shops`)}
          {row('Spend today', data.today.costUsd < data.today.cap, `$${data.today.costUsd} / $${data.today.cap} · ${data.today.calls} calls`)}
        </ul>
      )}
    </Card>
  );
}

function Demo() {
  const { data } = useQuery({ queryKey: ['scenarios'], queryFn: () => get('/demo/scenarios') });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const reset = async () => { setBusy(true); try { await post('/demo/reset'); setMsg('Demo world reset.'); } catch (e) { setMsg(e.message); } setBusy(false); };
  return (
    <Card className="p-5">
      <h2 className="display mb-1 text-xl font-semibold">DemoQuin chain</h2>
      <p className="text-sm text-ink-3">GTIN <span className="mono">{data?.gtin}</span> · fictional manufacturer that shares its issued serials</p>
      <ul className="mt-3 space-y-2 text-sm">
        {data?.scenarios.map((s) => <li key={s.id} className="rounded-xl bg-paper p-2.5"><span className="mono font-semibold">{s.serial}</span> — {s.title}<span className="block text-ink-3">{s.how}</span></li>)}
      </ul>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="md" variant="secondary" loading={busy} onClick={reset}><RotateCcw className="size-4" />Reset</Button>
        <Button size="md" as={Link} to="/labels" variant="secondary"><Printer className="size-4" />Labels</Button>
      </div>
      {msg && <p className="mt-2 text-sm text-ink-2">{msg}</p>}
    </Card>
  );
}
