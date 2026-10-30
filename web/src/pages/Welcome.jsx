import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag, Store, ArrowRight, ArrowLeft, Lock } from 'lucide-react';
import clsx from 'clsx';
import { Logo, Button, Page, ErrorNote } from '../components/ui.jsx';
import { LANGUAGES } from '../lib/i18n.js';
import { useSettings } from '../lib/settings.jsx';
import { get, post } from '../lib/api.js';

export default function Welcome() {
  const { language, hasLanguage, setLanguage, signIn, t } = useSettings();
  const [step, setStep] = useState(hasLanguage ? 'role' : 'lang');
  const [lang, setLang] = useState(language);
  const navigate = useNavigate();

  return (
    <Page className="relative overflow-hidden">
      <Backdrop />
      <div className="relative mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-8 pt-6">
        <Logo size="lg" />
        <AnimatePresence mode="wait">
          {step === 'lang' && (
            <motion.section key="lang" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-auto pt-16">
              <h1 className="display text-[44px] font-bold leading-[1.02] md:text-6xl">Every pack<br /><span className="text-brand">tells the truth.</span></h1>
              <p className="mt-4 text-lg text-ink-2">Meta AI checks medicine and everyday products for fakes — in your language.</p>
              <p className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wider text-ink-3">{t('chooseLang')}</p>
              <div className="grid grid-cols-2 gap-3">
                {LANGUAGES.map((l) => (
                  <button key={l.code} onClick={() => setLang(l.code)}
                    className={clsx('rounded-2xl border-2 p-4 text-left transition', lang === l.code ? 'border-brand bg-brand-soft' : 'border-line bg-card hover:border-ink-3')}>
                    <span className="display block text-2xl font-semibold">{l.native}</span>
                    <span className="text-sm text-ink-3">{l.name}</span>
                  </button>
                ))}
              </div>
              <Button className="mt-6 w-full" onClick={() => { setLanguage(lang); setStep('role'); }}>
                {t('continue')} <ArrowRight className="size-5" />
              </Button>
            </motion.section>
          )}

          {step === 'role' && (
            <motion.section key="role" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-auto pt-16">
              <button onClick={() => setStep('lang')} className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-ink-3"><ArrowLeft className="size-4" />{LANGUAGES.find((l) => l.code === language)?.native}</button>
              <h1 className="display text-4xl font-bold">{t('whoAreYou')}</h1>
              <div className="mt-6 space-y-3">
                <RoleCard Icon={ShoppingBag} title={t('buyer')} sub={t('buyerSub')} onClick={() => navigate('/')} primary />
                <RoleCard Icon={Store} title={t('pro')} sub={t('proSub')} onClick={() => setStep('pro')} />
              </div>
            </motion.section>
          )}

          {step === 'pro' && <ProSignIn key="pro" onBack={() => setStep('role')} onDone={(r, s) => { signIn(r, s); navigate('/receive'); }} />}
        </AnimatePresence>
      </div>
    </Page>
  );
}

function RoleCard({ Icon, title, sub, onClick, primary }) {
  return (
    <button onClick={onClick} className={clsx('group flex w-full items-center gap-4 rounded-3xl p-5 text-left transition', primary ? 'bg-brand text-white shadow-lift' : 'border border-line bg-card shadow-card hover:border-ink-3')}>
      <span className={clsx('grid size-14 shrink-0 place-items-center rounded-2xl', primary ? 'bg-white/15' : 'bg-brand-soft text-brand')}><Icon className="size-7" /></span>
      <span className="flex-1">
        <span className="display block text-xl font-semibold">{title}</span>
        <span className={clsx('text-[15px]', primary ? 'text-white/80' : 'text-ink-3')}>{sub}</span>
      </span>
      <ArrowRight className="size-5 transition group-hover:translate-x-1" />
    </button>
  );
}

function ProSignIn({ onBack, onDone }) {
  const { data: shops = [] } = useQuery({ queryKey: ['shops'], queryFn: () => get('/shops') });
  const [shopId, setShopId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { const r = await post('/auth/pin', { pin, shopId }); onDone(r.role, r.shop); } catch (err) { setError(err.message); }
    setBusy(false);
  };
  return (
    <motion.form onSubmit={submit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-auto space-y-4 pt-16">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-ink-3"><ArrowLeft className="size-4" />Back</button>
      <h1 className="display text-4xl font-bold">Your shop</h1>
      <p className="text-ink-2">Pharmacies and licensed chemists check stock at the door. In the real network each shop is verified with its PCN or PPMV licence.</p>
      <div className="max-h-72 space-y-2 overflow-auto rounded-2xl">
        {shops.map((s) => (
          <label key={s._id} className={clsx('flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-card p-3 transition', shopId === s._id ? 'border-brand' : 'border-line')}>
            <input type="radio" name="shop" value={s._id} checked={shopId === s._id} onChange={() => setShopId(s._id)} className="accent-[#0B6B3A]" />
            <span className="flex-1"><span className="block font-semibold">{s.name}</span><span className="text-sm text-ink-3">{s.type === 'pharmacy' ? 'Pharmacy' : 'Licensed chemist'} · {s.area}, {s.city}</span></span>
          </label>
        ))}
      </div>
      <label className="block">
        <span className="mb-1 flex items-center gap-1 text-sm font-semibold text-ink-2"><Lock className="size-4" />Demo PIN</span>
        <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" className="mono h-14 w-full rounded-2xl border border-line bg-card px-4 text-xl tracking-[0.4em] outline-none focus:border-brand" placeholder="••••" />
        <span className="mt-1 block text-xs text-ink-3">Judges: the demo PIN is 2468.</span>
      </label>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" className="w-full" disabled={!shopId || pin.length < 4} loading={busy}>Sign in <ArrowRight className="size-5" /></Button>
    </motion.form>
  );
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -right-40 -top-40 size-[520px] rounded-full bg-brand/10 blur-3xl" />
      <div className="absolute -left-32 top-1/3 size-[380px] rounded-full bg-mint/15 blur-3xl" />
      <svg className="absolute right-[-60px] top-24 w-[340px] opacity-[0.07]" viewBox="0 0 200 200"><path d="M40 100l40 40 80-85" fill="none" stroke="#0B6B3A" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}
