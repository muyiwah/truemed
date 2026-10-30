import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Pencil, Check, Store, ShoppingBasket, Footprints, HelpCircle, Send, FileSearch, RotateCcw, Phone, Search, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { TopBar, Page, Button, ErrorNote, ModelTag } from '../components/ui.jsx';
import Camera from '../components/Camera.jsx';
import Analysis from '../components/Analysis.jsx';
import EvidencePhoto from '../components/EvidencePhoto.jsx';
import VoiceButton from '../components/VoiceButton.jsx';
import { VerdictCard, EvidenceTrail } from '../components/Result.jsx';
import { useSettings } from '../lib/settings.jsx';
import { get, post, postForm, stream } from '../lib/api.js';
import { LangSwitch } from './Home.jsx';

const API = import.meta.env.VITE_API_URL || '/api';
const RETAKE = {
  blurry: 'The photo is blurry. Hold the phone still and tap to focus.',
  too_dark: 'The photo is too dark. Move to better light.',
  too_small: 'The photo is too small. Move closer to the pack.',
  glare: 'There is glare on the pack. Tilt it away from the light.',
  too_far: 'Move closer so the text fills more of the photo.',
  cut_off: 'Part of the pack is cut off. Fit the whole pack in the frame.',
  not_a_product: 'We could not see a product pack in this photo.',
  unreadable: 'We could not read the pack. Try a clearer photo of the back.',
};

/**
 * The buyer's check (Gate 2). Also runs judge samples at /sample/:sampleId.
 * stage: front → back → analysing → confirm → ask_shop → confirm_shop → result
 */
export default function Scan() {
  const { sampleId } = useParams();
  const { t, language, setLanguage, captions } = useSettings();
  const navigate = useNavigate();
  const [stage, setStage] = useState(sampleId ? 'analysing' : 'front');
  const [photos, setPhotos] = useState([]); // { blob, url }
  const [steps, setSteps] = useState([]);
  const [scan, setScan] = useState(null); // latest server payload
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const photoUrl = sampleId ? `${API}/samples/${sampleId}.jpg` : photos[photos.length > 1 ? 1 : 0]?.url;
  const firstPhoto = sampleId ? `${API}/samples/${sampleId}.jpg` : photos[0]?.url;

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  // Samples start immediately.
  useEffect(() => {
    if (!sampleId || started.current) return;
    started.current = true;
    run(() => stream(`/samples/${sampleId}/run`, { language }, onStep));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleId]);

  const onStep = (s) => setSteps((prev) => [...prev, s]);

  async function run(fn) {
    setStage('analysing'); setSteps([]); setError(null);
    const t0 = Date.now();
    try {
      const res = await fn();
      // Let the last step land before switching screens.
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - t0))));
      apply(res);
    } catch (err) {
      setError(err.message); setStage('error');
    }
  }

  function apply(res) {
    setScan((prev) => ({ ...prev, ...res }));
    setStage(res.stage === 'retake' ? 'retake' : res.stage === 'error' ? 'error' : res.stage);
    if (res.stage === 'error') setError(res.message);
  }

  const addPhoto = (blob) => {
    const next = [...photos, { blob, url: URL.createObjectURL(blob) }];
    setPhotos(next);
    if (next.length === 1) setStage('back');
    else submit(next);
  };

  function submit(list = photos) {
    const form = new FormData();
    list.forEach((p, i) => form.append('images', p.blob, `pack-${i}.jpg`));
    form.append('language', language);
    run(() => stream('/scan/home', form, onStep));
  }

  const act = async (fn) => {
    setBusy(true); setError(null);
    try { apply(await fn()); } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const reset = () => { setPhotos([]); setScan(null); setSteps([]); setError(null); setStage('front'); if (sampleId) navigate('/check'); };

  const lab = stage === 'analysing';

  return (
    <Page lab={lab} className={clsx(stage === 'result' && 'bg-paper')}>
      <TopBar dark={lab} back={<button onClick={() => navigate('/')} className={clsx('grid size-9 place-items-center rounded-full', lab ? 'hover:bg-white/10' : 'hover:bg-black/5')} aria-label="Back"><ArrowLeft className="size-5" /></button>}
        right={<LangSwitch dark={lab} language={language} setLanguage={setLanguage} />} />

      <AnimatePresence mode="wait">
        <motion.div key={stage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {(stage === 'front' || stage === 'back') && (
            <div className="mx-auto max-w-xl px-4 py-5">
              <Steps current={stage === 'front' ? 0 : 1} />
              <Camera
                key={stage}
                title={stage === 'front' ? t('front') : t('back')}
                hint={stage === 'front' ? t('frontHint') : t('backHint')}
                captureLabel={t('capture')} uploadLabel={t('upload')}
                onCapture={addPhoto}
                footer={stage === 'back' && (
                  <div className="flex items-center gap-3">
                    <img src={photos[0]?.url} alt="" className="size-14 rounded-xl object-cover ring-1 ring-line" />
                    <Button variant="secondary" size="md" className="flex-1" onClick={() => submit()}>{t('skipBack')}</Button>
                  </div>
                )}
              />
            </div>
          )}

          {stage === 'analysing' && <Analysis photo={photoUrl} steps={steps} captions={captions} title={t('analysing')} />}

          {stage === 'retake' && (
            <Centered>
              <img src={photoUrl} alt="" className="mx-auto mb-6 h-48 rounded-2xl object-cover opacity-80" />
              <h1 className="display text-3xl font-bold">Let’s try that again</h1>
              <ul className="mt-3 space-y-1 text-lg text-ink-2">{(scan?.issues ?? ['unreadable']).map((i) => <li key={i}>{RETAKE[i] ?? RETAKE.unreadable}</li>)}</ul>
              <Button className="mt-6 w-full" onClick={reset}><RotateCcw className="size-5" />{t('retake')}</Button>
            </Centered>
          )}

          {stage === 'error' && (
            <Centered>
              <ErrorNote>{error ?? 'Something went wrong.'}</ErrorNote>
              <div className="mt-4 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={reset}>{t('retake')}</Button>
                {photos.length > 0 && <Button className="flex-1" onClick={() => submit()}>Try again</Button>}
              </div>
            </Centered>
          )}

          {stage === 'confirm' && scan && (
            <Confirm scan={scan} photo={firstPhoto} t={t} busy={busy} error={error}
              onConfirm={(values) => act(() => post(`/scan/${scan.sessionId}/confirm`, { values }))} />
          )}

          {(stage === 'ask_shop' || stage === 'confirm_shop') && scan && (
            <AskShop scan={scan} stage={stage} t={t} busy={busy} error={error} sampleId={sampleId}
              answer={(body) => act(() => post(`/scan/${scan.sessionId}/answer`, body))}
              voice={(blob) => act(() => { const f = new FormData(); f.append('audio', blob, 'answer.webm'); return postForm(`/scan/${scan.sessionId}/answer`, f); })}
              reject={() => { setScan((s) => ({ ...s, suggestion: null })); setStage('ask_shop'); }} />
          )}

          {stage === 'result' && scan && (
            <ResultView scan={scan} photo={firstPhoto} t={t} language={language} captions={captions} onAgain={reset} />
          )}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

function Centered({ children }) {
  return <div className="mx-auto max-w-md px-5 py-12 text-center">{children}</div>;
}

function Steps({ current }) {
  return (
    <div className="mb-4 flex gap-2">
      {['Front', 'Back', 'Check'].map((s, i) => (
        <div key={s} className="flex-1">
          <div className={clsx('h-1.5 rounded-full', i <= current ? 'bg-brand' : 'bg-line')} />
          <p className={clsx('mt-1 text-xs font-semibold', i === current ? 'text-brand' : 'text-ink-3')}>{s}</p>
        </div>
      ))}
    </div>
  );
}

/** Confirm step (rule 2): show what the AI read in big text; confirm or correct. */
export function Confirm({ scan, photo, t, onConfirm, busy, error }) {
  const [values, setValues] = useState(() => Object.fromEntries(scan.read.map((r) => [r.key, r.value ?? ''])));
  const [editing, setEditing] = useState(() => new Set(scan.read.filter((r) => !r.value && r.editable).map((r) => r.key)));
  const changed = () => Object.fromEntries(scan.read.filter((r) => r.editable && (values[r.key] ?? '') !== (r.value ?? '')).map((r) => [r.key, values[r.key]]));
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[1fr_1.1fr] md:py-10">
      <div className="hidden md:block"><EvidencePhoto src={photo} /></div>
      <div>
        <div className="mb-2 flex items-center gap-2"><ModelTag model="Muse Spark" /><span className="text-sm text-ink-3">read this from your photo</span></div>
        <h1 className="display text-3xl font-bold md:text-4xl">{t('confirmTitle')}</h1>
        <p className="mt-2 text-ink-2">{t('confirmSub')}</p>
        <ul className="mt-6 space-y-3">
          {scan.read.map((r) => (
            <li key={r.key} className={clsx('rounded-2xl border-2 bg-card p-4', r.needsCheck ? 'border-info' : 'border-line')}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-3">{r.label}{r.source === 'barcode' && <span className="ml-2 rounded-full bg-ok-soft px-2 py-0.5 text-[10px] font-bold uppercase text-ok">from barcode</span>}</p>
                {r.editable && !editing.has(r.key) && (
                  <button onClick={() => setEditing(new Set([...editing, r.key]))} className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><Pencil className="size-4" />{t('fix')}</button>
                )}
              </div>
              {editing.has(r.key) ? (
                <input autoFocus value={values[r.key]} onChange={(e) => setValues({ ...values, [r.key]: e.target.value })}
                  placeholder={r.key === 'expiry' || r.key === 'manufactureDate' ? 'YYYY-MM' : 'As printed'}
                  className="mono mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-2xl font-semibold outline-none focus:border-brand" />
              ) : (
                <p className={clsx('mono mt-1 text-2xl font-semibold', !r.value && 'text-ink-3')}>{r.value ?? 'Not readable'}</p>
              )}
              {r.needsCheck && <p className="mt-1 text-sm text-info">Please check this one carefully.</p>}
            </li>
          ))}
        </ul>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        <Button className="mt-6 w-full" loading={busy} onClick={() => onConfirm(changed())}><Check className="size-5" />{t('looksRight')}</Button>
      </div>
    </div>
  );
}

/** Ask first, reveal after (rule 5). Tap a shop, say it, type it, or pick market / street. */
function AskShop({ scan, stage, t, answer, voice, reject, busy, error, sampleId }) {
  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: () => get('/shops') });
  const { data: samples = [] } = useQuery({ queryKey: ['samples'], queryFn: () => get('/samples'), enabled: Boolean(sampleId) });
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const filtered = useMemo(() => shops.filter((s) => `${s.name} ${s.area} ${s.city}`.toLowerCase().includes(q.toLowerCase())), [shops, q]);
  const hint = samples.find((s) => s.id === sampleId)?.suggest?.shop;

  if (stage === 'confirm_shop' && scan.suggestion) {
    const s = scan.suggestion;
    return (
      <Centered>
        {scan.heard && <p className="mb-4 rounded-2xl bg-card p-4 text-left text-ink-2 shadow-card"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-3">We heard</span>“{scan.transcript || scan.heard}”</p>}
        <div className="mb-2 flex justify-center gap-2"><ModelTag model="Voice Transcribe" /><ModelTag model="Muse Spark" /></div>
        <h1 className="display text-3xl font-bold">{t('didYouMean')}…</h1>
        <div className="mx-auto mt-5 flex items-center gap-3 rounded-3xl border-2 border-brand bg-card p-5 text-left">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand"><Store className="size-6" /></span>
          <span><span className="display block text-xl font-semibold">{s.name}</span><span className="text-ink-3">{s.area}, {s.city}</span></span>
        </div>
        <div className="mt-6 grid gap-3">
          <Button loading={busy} onClick={() => answer({ sourceType: 'shop', shopId: s.shopId, confirmed: true, via: 'voice' })}>{t('yes')}</Button>
          <Button variant="secondary" onClick={reject}>{t('no')}</Button>
        </div>
      </Centered>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="display text-[34px] font-bold leading-tight">{t('whereTitle')}</h1>
      <p className="mt-2 text-ink-2">{t('whereSub')}</p>
      {hint && <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-info-soft px-3 py-1.5 text-sm text-info"><Sparkles className="size-4" />Sample: say or pick “{hint}”</p>}
      {scan.message && <p className="mt-3 rounded-2xl bg-warn-soft p-3 text-sm">{scan.message}</p>}

      <div className="mt-6 flex flex-col items-center rounded-3xl border border-line bg-card p-6 shadow-card">
        <VoiceButton onAudio={voice} label={t('holdToTalk')} releaseLabel={t('release')} disabled={busy} />
        <div className="mt-2 flex gap-2"><ModelTag model="Voice Transcribe" /><ModelTag model="Muse Spark" /></div>
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) answer({ text }); }} className="mt-5 flex w-full gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`${t('orType')}: “for the chemist for Ojo junction”`} className="h-12 flex-1 rounded-xl border border-line bg-paper px-3 outline-none focus:border-brand" />
          <Button size="md" type="submit" disabled={!text.trim()} loading={busy}><Send className="size-4" /></Button>
        </form>
      </div>
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[{ k: 'market', Icon: ShoppingBasket }, { k: 'street', Icon: Footprints }, { k: 'notSure', Icon: HelpCircle }].map(({ k, Icon }) => (
          <button key={k} disabled={busy} onClick={() => answer({ sourceType: k === 'notSure' ? 'unknown' : k })} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-card p-3 text-center text-sm font-semibold shadow-card hover:border-ink-3 disabled:opacity-50">
            <Icon className="size-6 text-brand" />{t(k)}
          </button>
        ))}
      </div>

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wider text-ink-3">{t('pickShop')}</h2>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-11 w-full rounded-xl border border-line bg-card pl-9 pr-3 outline-none focus:border-brand" />
      </div>
      <ul className="space-y-2">
        {filtered.map((s) => (
          <li key={s._id}>
            <button disabled={busy} onClick={() => answer({ sourceType: 'shop', shopId: s._id, confirmed: true, via: 'tap' })}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left hover:border-brand disabled:opacity-50">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Store className="size-5" /></span>
              <span className="flex-1"><span className="block font-semibold">{s.name}</span><span className="text-sm text-ink-3">{s.type === 'pharmacy' ? 'Pharmacy' : 'Licensed chemist'} · {s.area}, {s.city}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultView({ scan, photo, t, language, captions, onAgain }) {
  const navigate = useNavigate();
  const flagged = scan.canInvestigate;
  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1fr_1.15fr] lg:py-10">
      <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <div className="lab rounded-[28px] p-3 ring-1 ring-lab-line">
          <EvidencePhoto src={photo} regions={(scan.regions ?? []).filter((r) => r.image === 0)} />
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1 pt-3">
            <p className="text-sm text-lab-dim">Evidence outlined by</p>
            <div className="flex gap-1.5"><ModelTag dark model="SAM 3.1" /><ModelTag dark model="Muse Spark" /></div>
          </div>
        </div>
        {scan.read && <p className="px-1 text-sm text-ink-3">Read from pack: <span className="font-semibold text-ink">{scan.read}</span>{scan.product?.demo && ' · fictional demo product'}</p>}
        {scan.sample && <p className="px-1 text-xs text-ink-3">Sample pack: the AI reading is cached so every judge sees the same run. Sample scans don’t change the ledger.</p>}
      </div>

      <div className="space-y-4">
        <VerdictCard verdict={scan.verdict} explanation={scan.explanation} sessionId={scan.sessionId} language={language} t={t} captions={captions} />
        <div className="grid gap-2 sm:grid-cols-2">
          {flagged && <Button onClick={() => navigate(`/case/${scan.sessionId}`)}><FileSearch className="size-5" />{t('investigate')}</Button>}
          {flagged && <Button as="a" variant="secondary" href="tel:08001623322"><Phone className="size-5" />NAFDAC 0800-162-3322</Button>}
          <Button variant={flagged ? 'ghost' : 'primary'} onClick={onAgain} className={clsx(!flagged && 'sm:col-span-2')}><RotateCcw className="size-5" />{t('checkAnother')}</Button>
        </div>
        <EvidenceTrail checks={scan.checks ?? []} t={t} />
        {scan.gatedDetail && flagged && (
          <p className="rounded-2xl bg-mute-soft p-4 text-sm text-ink-2">Exact artwork differences are shown only to verified pharmacists, so counterfeiters can’t use TrueMed to perfect their copies. <Link to="/how" className="font-semibold text-brand">Why?</Link></p>
        )}
      </div>
    </div>
  );
}
