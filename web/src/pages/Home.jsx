import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Camera, PackageCheck, ArrowRight, Bell, ScanLine, Mic, Radar, FileSearch, Database, Globe } from 'lucide-react';
import clsx from 'clsx';
import { TopBar, Page, ModelTag } from '../components/ui.jsx';
import { useSettings } from '../lib/settings.jsx';
import { LANGUAGES } from '../lib/i18n.js';
import { get } from '../lib/api.js';

const API = import.meta.env.VITE_API_URL || '/api';

export default function Home() {
  const { t, verified, shop, language, setLanguage } = useSettings();
  const navigate = useNavigate();
  const { data: samples = [] } = useQuery({ queryKey: ['samples'], queryFn: () => get('/samples') });
  const { data: notes = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => get('/notifications'), enabled: verified });
  const unread = notes.filter((n) => !n.readAt).length;

  return (
    <Page>
      <TopBar right={
        <>
          <LangSwitch language={language} setLanguage={setLanguage} />
          {verified && (
            <Link to="/notifications" className="relative grid size-10 place-items-center rounded-full hover:bg-black/5" aria-label="Notifications">
              <Bell className="size-5" />
              {unread > 0 && <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-bad text-[10px] font-bold text-white">{unread}</span>}
            </Link>
          )}
        </>
      } />

      <div className="mx-auto max-w-5xl px-4 pb-16">
        <section className="relative pt-8 md:pt-14">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 flex flex-wrap gap-2">
            <ModelTag model="Muse Spark" /><ModelTag model="SAM 3.1" /><ModelTag model="Voice Transcribe" />
          </motion.p>
          <h1 className="display max-w-3xl text-[44px] font-bold leading-[1.02] md:text-7xl">{t('tagline')}</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-2 md:text-xl">{t('sub')}</p>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-[1.4fr_1fr]">
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} onClick={() => navigate('/check')}
            className="group relative overflow-hidden rounded-3xl bg-brand p-6 text-left text-white shadow-lift md:p-8">
            <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/10" />
            <div className="absolute right-6 top-6 grid size-14 place-items-center rounded-2xl bg-white/15"><Camera className="size-7" /></div>
            <p className="display mt-16 text-3xl font-bold md:text-4xl">{t('check')}</p>
            <p className="mt-1 text-white/80">{t('checkSub')}</p>
            <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-brand">Start <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
          </motion.button>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} onClick={() => navigate(verified ? '/receive' : '/welcome')}
            className="group relative overflow-hidden rounded-3xl border border-line bg-card p-6 text-left shadow-card md:p-8">
            <div className="absolute right-6 top-6 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand"><PackageCheck className="size-7" /></div>
            <p className="display mt-16 text-2xl font-bold md:text-3xl">{t('receive')}</p>
            <p className="mt-1 text-ink-3">{verified && shop ? shop.name : t('receiveSub')}</p>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-brand">{verified ? 'Open' : 'Sign in'} <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
          </motion.button>
        </section>

        {samples.length > 0 && (
          <section className="mt-10">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="display text-2xl font-semibold">{t('samples')}</h2>
              <Link to="/labels" className="text-sm font-medium text-brand hover:underline">Print demo labels</Link>
            </div>
            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:px-0">
              {samples.map((s, i) => (
                <motion.button key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                  onClick={() => navigate(`/sample/${s.id}`)}
                  className="group w-60 shrink-0 snap-start overflow-hidden rounded-3xl border border-line bg-card text-left shadow-card transition hover:-translate-y-0.5 md:w-auto">
                  <div className="relative aspect-[7/5] overflow-hidden bg-mute-soft">
                    <img src={`${API}${s.image}`} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                    <span className={clsx('absolute left-3 top-3 size-2.5 rounded-full ring-4 ring-white/70', s.tone === 'ok' ? 'bg-ok' : s.tone === 'warn' ? 'bg-warn' : 'bg-bad')} />
                  </div>
                  <div className="p-4">
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-sm text-ink-3">{s.subtitle}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <h2 className="display mb-4 text-2xl font-semibold">Four Meta AI agents. One ledger.</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Agent Icon={ScanLine} name="Inspector" models={['Muse Spark', 'SAM 3.1']} text="Reads the whole pack from one photo, outlines the barcode and date, looks for tampering and lookalike names." />
            <Agent Icon={Mic} name="Voice" models={['Voice Transcribe', 'Muse Spark']} text="Asks where you bought it before revealing anything, understands Pidgin, explains in four languages." />
            <Agent Icon={Radar} name="Sentinel" models={['Muse Spark + search']} text="Turns NAFDAC alerts into batch records and warns every shop holding a match." />
            <Agent Icon={FileSearch} name="Investigator" models={['Muse Spark + tools']} text="Follows a flagged pack through the ledger and drafts a case file for NAFDAC." />
          </div>
          <div className="mt-3 flex items-start gap-3 rounded-3xl border border-dashed border-line p-5">
            <Database className="mt-0.5 size-5 shrink-0 text-brand" />
            <p className="text-[15px] text-ink-2"><span className="font-semibold text-ink">The ledger knows where every pack should be. Meta AI checks whether it really is.</span> Hard facts — registration, alerts, expiry, the code on the pack, which shop received the serial — decide a High-risk verdict. AI on its own can only raise Caution.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/how" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">{t('how')} <ArrowRight className="size-4" /></Link>
            <Link to="/insights" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">Network insights <ArrowRight className="size-4" /></Link>
          </div>
        </section>

        <footer className="mt-16 border-t border-line pt-6 text-sm text-ink-3">
          <p>{t('disclaimer')} Report suspected fakes to NAFDAC: 0800-162-3322.</p>
          <p className="mt-2">Built in Lagos for the Meta Global AI Developer Hackathon. All shops and the DemoQuin brand are fictional.</p>
        </footer>
      </div>
    </Page>
  );
}

function Agent({ Icon, name, models, text }) {
  return (
    <div className="rounded-3xl border border-line bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon className="size-5" /></span></div>
      <p className="display text-lg font-semibold">{name}</p>
      <div className="my-2 flex flex-wrap gap-1">{models.map((m) => <ModelTag key={m} model={m} />)}</div>
      <p className="text-[14px] text-ink-2">{text}</p>
    </div>
  );
}

export function LangSwitch({ language, setLanguage, dark }) {
  return (
    <label className={clsx('relative inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold', dark ? 'bg-white/5 text-lab-ink' : 'bg-black/5')}>
      <Globe className="size-4" />
      <select value={language} onChange={(e) => setLanguage(e.target.value)} className="appearance-none bg-transparent pr-1 outline-none" aria-label="Language">
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
      </select>
    </label>
  );
}
