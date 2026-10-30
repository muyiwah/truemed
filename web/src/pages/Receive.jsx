import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Truck, Store, Camera as CameraIcon, Video, CheckCircle2, XCircle, AlertTriangle, Bell, LogOut, Upload, PackageCheck } from 'lucide-react';
import clsx from 'clsx';
import { TopBar, Page, Button, ErrorNote, ModelTag } from '../components/ui.jsx';
import Camera from '../components/Camera.jsx';
import Analysis from '../components/Analysis.jsx';
import EvidencePhoto from '../components/EvidencePhoto.jsx';
import { EvidenceTrail } from '../components/Result.jsx';
import { Confirm } from './Scan.jsx';
import { useSettings } from '../lib/settings.jsx';
import { post, stream } from '../lib/api.js';

const DECISION = {
  accepted: { Icon: CheckCircle2, title: 'Accepted', cls: 'bg-ok', line: 'Logged to your stock. It can go on the shelf.' },
  accepted_after_review: { Icon: CheckCircle2, title: 'Accepted after review', cls: 'bg-ok', line: 'Logged to your stock.' },
  review: { Icon: AlertTriangle, title: 'Hold for review', cls: 'bg-warn', line: 'Look at this pack yourself before it goes on the shelf.' },
  rejected: { Icon: XCircle, title: 'Rejected', cls: 'bg-bad', line: 'Keep it off the shelf. Quarantine it and report it.' },
};

const CARTON_PLAN = [
  { key: 'video', text: 'Preparing the video', model: null },
  { key: 'track', text: 'Tracking every pack across frames', model: 'SAM 3.1' },
  { key: 'read', text: 'Reading each pack', model: 'Muse Spark' },
  { key: 'check', text: 'Checking serials against the ledger', model: 'Rule engine' },
];

export default function Receive() {
  const { verified, shop, signIn, t, captions } = useSettings();
  const navigate = useNavigate();
  const [source, setSource] = useState({ source: 'authorized', supplierName: '', marketStall: '' });
  const [mode, setMode] = useState(null); // single | carton
  const [stage, setStage] = useState('setup');
  const [photo, setPhoto] = useState(null);
  const [steps, setSteps] = useState([]);
  const [scan, setScan] = useState(null);
  const [carton, setCarton] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const videoInput = useRef(null);

  useEffect(() => { if (!verified) navigate('/welcome', { replace: true }); }, [verified, navigate]);
  if (!verified) return null;

  const form = (extra) => {
    const f = new FormData();
    Object.entries(source).forEach(([k, v]) => v && f.append(k, v));
    Object.entries(extra).forEach(([k, v]) => f.append(k, v));
    return f;
  };

  async function single(blob) {
    const url = URL.createObjectURL(blob);
    setPhoto(url); setStage('analysing'); setSteps([]); setError(null);
    try {
      const f = form({});
      f.append('images', blob, 'pack.jpg');
      const res = await stream('/scan/receiving', f, (s) => setSteps((p) => [...p, s]));
      handle(res);
    } catch (err) { setError(err.message); setStage('setup'); }
  }

  function handle(res) {
    setScan(res);
    if (res.stage === 'retake') { setError('That photo was hard to read. Try again closer, in good light.'); setStage('capture'); return; }
    if (res.stage === 'error') { setError(res.message); setStage('capture'); return; }
    setStage(res.stage);
    if (res.stage === 'result') setLog((l) => [{ id: res.sessionId, name: res.read ?? 'Pack', decision: res.decision, at: new Date() }, ...l]);
  }

  async function cartonVideo(file) {
    if (!file) return;
    setStage('carton-analysing'); setSteps([]); setError(null);
    try {
      const f = form({});
      f.append('video', file, file.name || 'carton.mp4');
      const res = await stream('/scan/carton', f, (s) => setSteps((p) => [...p, s]));
      setCarton(res); setStage('carton-result');
    } catch (err) { setError(err.message); setStage('setup'); }
  }

  const confirm = async (values) => {
    setBusy(true);
    try { handle(await post(`/scan/${scan.sessionId}/confirm`, { values })); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const acceptReview = async () => {
    setBusy(true);
    try { const r = await post(`/scan/${scan.sessionId}/accept`); setScan((s) => ({ ...s, decision: r.decision })); setLog((l) => l.map((x) => (x.id === scan.sessionId ? { ...x, decision: r.decision } : x))); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const signOut = async () => { await post('/auth/signout').catch(() => {}); signIn('public', null); navigate('/'); };
  const next = () => { setScan(null); setPhoto(null); setStage(mode === 'carton' ? 'setup' : 'capture'); };

  const lab = stage === 'analysing' || stage === 'carton-analysing';

  return (
    <Page lab={lab}>
      <TopBar dark={lab} back={<button onClick={() => (stage === 'setup' ? navigate('/') : setStage('setup'))} className="grid size-9 place-items-center rounded-full hover:bg-black/5" aria-label="Back"><ArrowLeft className="size-5" /></button>}
        right={<>
          <Link to="/notifications" className="grid size-10 place-items-center rounded-full hover:bg-black/5" aria-label="Notifications"><Bell className="size-5" /></Link>
          <button onClick={signOut} className="grid size-10 place-items-center rounded-full hover:bg-black/5" aria-label="Sign out"><LogOut className="size-5" /></button>
        </>} />

      <AnimatePresence mode="wait">
        <motion.div key={stage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {stage === 'setup' && (
            <div className="mx-auto max-w-xl px-4 py-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand">Gate 1 · Receiving</p>
              <h1 className="display mt-1 text-4xl font-bold">Receive stock</h1>
              <p className="mt-1 text-ink-2">{shop?.name} · {shop?.area}, {shop?.city}</p>
              {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

              <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wider text-ink-3">Where did this stock come from?</h2>
              <div className="grid grid-cols-2 gap-3">
                {[{ k: 'authorized', Icon: Truck, title: 'Authorized supplier', sub: 'Manufacturer or appointed distributor' }, { k: 'open_market', Icon: Store, title: 'Open market', sub: 'Idumota, Onitsha, Aba, Kano…' }].map(({ k, Icon, title, sub }) => (
                  <button key={k} onClick={() => setSource({ ...source, source: k })} className={clsx('rounded-2xl border-2 bg-card p-4 text-left transition', source.source === k ? 'border-brand' : 'border-line')}>
                    <Icon className={clsx('mb-2 size-6', source.source === k ? 'text-brand' : 'text-ink-3')} />
                    <span className="block font-semibold">{title}</span><span className="text-sm text-ink-3">{sub}</span>
                  </button>
                ))}
              </div>
              <input value={source.source === 'authorized' ? source.supplierName : source.marketStall}
                onChange={(e) => setSource({ ...source, [source.source === 'authorized' ? 'supplierName' : 'marketStall']: e.target.value })}
                placeholder={source.source === 'authorized' ? 'Supplier name (optional)' : 'Market and stall (optional)'}
                className="mt-3 h-12 w-full rounded-xl border border-line bg-card px-3 outline-none focus:border-brand" />

              <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wider text-ink-3">How do you want to check?</h2>
              <div className="grid gap-3">
                <button onClick={() => { setMode('single'); setStage('capture'); }} className="flex items-center gap-4 rounded-3xl bg-brand p-5 text-left text-white shadow-lift">
                  <CameraIcon className="size-8" /><span className="flex-1"><span className="display block text-xl font-semibold">One pack</span><span className="text-white/80">Photo of the back of the pack</span></span>
                </button>
                <button onClick={() => { setMode('carton'); videoInput.current?.click(); }} className="flex items-center gap-4 rounded-3xl border border-line bg-card p-5 text-left shadow-card">
                  <Video className="size-8 text-brand" />
                  <span className="flex-1"><span className="display block text-xl font-semibold">Whole carton by video</span><span className="text-ink-3">Film slowly across the open carton, 5–15 s</span></span>
                  <ModelTag model="SAM 3.1" />
                </button>
                <input ref={videoInput} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => { cartonVideo(e.target.files?.[0]); e.target.value = ''; }} />
              </div>

              {log.length > 0 && <SessionLog log={log} />}
            </div>
          )}

          {stage === 'capture' && (
            <div className="mx-auto max-w-xl px-4 py-5">
              {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}
              <Camera title="Back of the pack" hint="Batch, expiry, barcode and serial in view" captureLabel={t('capture')} uploadLabel={t('upload')} onCapture={single} />
              {log.length > 0 && <SessionLog log={log} />}
            </div>
          )}

          {stage === 'analysing' && <Analysis photo={photo} steps={steps} captions={captions} title="Checking at the door" />}

          {stage === 'carton-analysing' && (
            <Analysis steps={steps} captions={captions} title="Checking the carton" plan={CARTON_PLAN} progress={{ video: 0, track: 1, tracked: 2, read: 2, check: 3 }}
              media={<div className="grid aspect-[4/3] place-items-center rounded-3xl bg-lab-2 ring-1 ring-lab-line lab-grid"><Video className="size-14 text-mint animate-pulse" /></div>} />
          )}

          {stage === 'confirm' && scan && <Confirm scan={scan} photo={photo} t={t} busy={busy} error={error} onConfirm={confirm} />}

          {stage === 'result' && scan && (
            <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1fr_1.15fr]">
              <div className="lab rounded-[28px] p-3 ring-1 ring-lab-line lg:sticky lg:top-20 lg:self-start">
                <EvidencePhoto src={photo} regions={(scan.regions ?? []).filter((r) => r.image === 0)} />
              </div>
              <div className="space-y-4">
                <DecisionCard scan={scan} />
                {scan.decision === 'review' && <Button variant="secondary" className="w-full" loading={busy} onClick={acceptReview}>I’ve checked it — accept into stock</Button>}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={next}><PackageCheck className="size-5" />Next pack</Button>
                  {scan.canInvestigate && <Button variant="secondary" onClick={() => navigate(`/case/${scan.sessionId}`)}>Investigate</Button>}
                </div>
                <EvidenceTrail checks={scan.checks ?? []} t={t} />
              </div>
            </div>
          )}

          {stage === 'carton-result' && carton && <CartonResult carton={carton} onNext={() => setStage('setup')} />}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

function DecisionCard({ scan }) {
  const d = DECISION[scan.decision] ?? DECISION.review;
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-line">
      <div className={clsx('flex items-center gap-4 p-5 text-white', d.cls)}>
        <d.Icon className="size-12" strokeWidth={1.8} />
        <div><p className="text-xs font-semibold uppercase tracking-widest text-white/80">Receiving decision</p><h2 className="display text-[28px] font-bold leading-tight">{d.title}</h2></div>
      </div>
      <div className="space-y-2 p-5">
        <p className="text-[17px] font-medium">{scan.verdict.line}</p>
        <p className="text-ink-3">{d.line}</p>
        {scan.read && <p className="text-sm text-ink-3">Pack: <span className="font-semibold text-ink">{scan.read}</span></p>}
      </div>
    </motion.section>
  );
}

function SessionLog({ log }) {
  return (
    <div className="mt-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-3">This session</h2>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
        {log.map((l) => {
          const d = DECISION[l.decision] ?? DECISION.review;
          return <li key={l.id} className="flex items-center gap-3 p-3"><d.Icon className={clsx('size-5', l.decision?.startsWith('accepted') ? 'text-ok' : l.decision === 'rejected' ? 'text-bad' : 'text-warn')} /><span className="flex-1 font-medium">{l.name}</span><span className="text-sm text-ink-3">{d.title}</span></li>;
        })}
      </ul>
    </div>
  );
}

function CartonResult({ carton, onNext }) {
  const s = carton.summary ?? {};
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">Carton check</p>
      <h1 className="display mt-1 text-4xl font-bold">{s.total ?? 0} packs found</h1>
      {carton.message && <p className="mt-2 text-ink-2">{carton.message}</p>}
      <div className="mt-4 flex gap-2">
        <Stat n={s.accepted} label="accepted" cls="bg-ok-soft text-ok" />
        <Stat n={s.review} label="to review" cls="bg-warn-soft text-warn" />
        <Stat n={s.rejected} label="rejected" cls="bg-bad-soft text-bad" />
      </div>
      {carton.annotatedImage && (
        <div className="lab mt-5 rounded-[28px] p-3 ring-1 ring-lab-line">
          <img src={carton.annotatedImage} alt="Carton with each tracked pack outlined" className="w-full rounded-3xl" />
          <div className="flex justify-end gap-1.5 px-2 pt-3"><ModelTag dark model="SAM 3.1 video tracking" /><ModelTag dark model="Muse Spark" /></div>
        </div>
      )}
      <ul className="mt-5 divide-y divide-line rounded-3xl border border-line bg-card shadow-card">
        {(carton.packs ?? []).map((p) => {
          const d = DECISION[p.decision] ?? DECISION.review;
          return (
            <li key={p.objectId} className="flex gap-3 p-4">
              <d.Icon className={clsx('mt-0.5 size-6 shrink-0', p.decision === 'accepted' ? 'text-ok' : p.decision === 'rejected' ? 'text-bad' : 'text-warn')} />
              <div className="flex-1">
                <p className="font-semibold">{p.name ?? 'Pack'} <span className="mono text-sm text-ink-3">{p.serial ?? 'no serial read'}</span></p>
                <p className="text-sm text-ink-2">{p.failed?.[0]?.reason ?? p.verdict.line}</p>
              </div>
              <span className="text-sm font-semibold text-ink-3">{d.title}</span>
            </li>
          );
        })}
      </ul>
      <Button className="mt-6 w-full" onClick={onNext}><Upload className="size-5" />Check another delivery</Button>
    </div>
  );
}

const Stat = ({ n = 0, label, cls }) => <span className={clsx('rounded-full px-3 py-1.5 text-sm font-semibold', cls)}>{n} {label}</span>;
