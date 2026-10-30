import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Check, X, Minus, Volume2, Square, ExternalLink, MapPin, Info } from 'lucide-react';
import { VERDICT, ModelTag } from './ui.jsx';
import { LANGUAGES } from '../lib/i18n.js';
import { post } from '../lib/api.js';

const TTS_LANG = { en: 'en-NG', pcm: 'en-NG', yo: 'yo-NG', ha: 'ha-NG' };

/** Big verdict card: colour + icon + one line, provenance, spoken explanation. */
export function VerdictCard({ verdict, explanation, sessionId, language, t, captions }) {
  const v = VERDICT[verdict.code] ?? VERDICT.no_record;
  const [exp, setExp] = useState(explanation);
  const [lang, setLang] = useState(explanation?.lang ?? language);
  const [loadingLang, setLoadingLang] = useState(null);

  const switchLang = async (l) => {
    if (l === lang) return;
    setLoadingLang(l);
    try { const e = await post('/explain', { sessionId, lang: l }); setExp(e); setLang(l); } catch { /* keep current */ }
    setLoadingLang(null);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      className={clsx('overflow-hidden rounded-3xl bg-card shadow-card ring-1', v.ring)}
    >
      <div className={clsx('flex items-center gap-4 p-5 text-white', v.bg)}>
        <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}>
          <v.Icon className="size-12" strokeWidth={1.8} />
        </motion.div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">TrueMed result</p>
          <h2 className="display text-[28px] font-bold leading-tight">{verdict.title}</h2>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-[17px] font-medium leading-snug text-ink">{verdict.line}</p>
        {verdict.provenance && (
          <div className={clsx('flex gap-3 rounded-2xl p-3 text-[15px] text-ink', v.tone === 'ok' ? 'bg-ok-soft' : 'bg-mute-soft')}>
            <MapPin className={clsx('mt-0.5 size-5 shrink-0', v.tone === 'ok' ? 'text-ok' : 'text-ink-3')} />
            <p>{verdict.provenance}</p>
          </div>
        )}
        {exp?.text && (
          <div className="rounded-2xl bg-paper p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1">
                {LANGUAGES.map((l) => (
                  <button key={l.code} onClick={() => switchLang(l.code)}
                    className={clsx('rounded-full px-2.5 py-1 text-xs font-semibold transition', lang === l.code ? 'bg-ink text-white' : 'text-ink-2 hover:bg-black/5', loadingLang === l.code && 'animate-pulse')}>
                    {l.native}
                  </button>
                ))}
              </div>
              {captions && <ModelTag model="Muse Spark" />}
            </div>
            <p className="text-[16px] leading-relaxed text-ink">{exp.text}</p>
            <Speak text={exp.text} lang={lang} label={t('listen')} />
          </div>
        )}
        <p className="flex gap-2 text-sm text-ink-3"><Info className="mt-0.5 size-4 shrink-0" />{exp?.disclaimer ?? verdict.disclaimer}</p>
      </div>
    </motion.section>
  );
}

/** Reads the explanation aloud with the browser's voice (English and Pidgin). */
function Speak({ text, lang, label }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const utter = useRef(null);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (!supported) return null;
  const voiceFor = () => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang === TTS_LANG[lang]) ?? voices.find((v) => v.lang?.startsWith('en-NG')) ?? voices.find((v) => /en-(GB|ZA|KE)/.test(v.lang)) ?? voices.find((v) => v.lang?.startsWith('en'));
  };
  const toggle = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    const voice = voiceFor();
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    utter.current = u;
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };
  if (lang === 'yo' || lang === 'ha') return <p className="mt-2 text-xs text-ink-3">Spoken Yoruba and Hausa are coming soon.</p>;
  return (
    <button onClick={toggle} className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
      {speaking ? <Square className="size-4" /> : <Volume2 className="size-4" />}{label}
    </button>
  );
}

const STATUS = {
  pass: { Icon: Check, cls: 'bg-ok text-white' },
  fail: { Icon: X, cls: 'bg-bad text-white' },
  skipped: { Icon: Minus, cls: 'bg-mute-soft text-mute' },
};
const NAMES = {
  REG_NOT_FOUND: 'NAFDAC registration exists', REG_PRODUCT_MISMATCH: 'Registration matches this product', ALERT_MATCH: 'Not in a NAFDAC alert',
  EXPIRED: 'Not expired', SHELF_LIFE_IMPLAUSIBLE: 'Dates are believable', GS1_INVALID: 'Valid 2D code', BARCODE_PRINT_MISMATCH: 'Barcode matches print',
  SERIAL_CLONE: 'Serial not copied', WRONG_SHOP: 'From the right shop', ALREADY_SOLD_ELSEWHERE: 'Not sold elsewhere', SERIAL_NEVER_ISSUED: 'Issued by manufacturer',
  ARTWORK_DIFFERENCE: 'Packaging matches genuine', TAMPER_SIGNS: 'No tampering on dates', LOOKALIKE_NAME: 'Not a lookalike brand',
  BATCH_SHOP_MISMATCH: 'Batch stocked by the shop', REPEAT_NEARBY: 'First check of this pack', EXPIRING_SOON: 'Not expiring soon',
};
const KIND = { hard: 'Hard fact', soft: 'AI judgement', info: 'Note' };

/** Every check, with its status and source. Failed first, then passed, then not checked. */
export function EvidenceTrail({ checks, t }) {
  const [showSkipped, setShowSkipped] = useState(false);
  const order = { fail: 0, pass: 1, skipped: 2 };
  const all = [...checks].sort((a, b) => order[a.status] - order[b.status]);
  const skipped = all.filter((c) => c.status === 'skipped').length;
  const sorted = showSkipped ? all : all.filter((c) => c.status !== 'skipped');
  const counts = { pass: checks.filter((c) => c.status === 'pass').length, fail: checks.filter((c) => c.status === 'fail').length };
  return (
    <section className="rounded-3xl border border-line bg-card p-5 shadow-card">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="display text-xl font-semibold">{t('evidence')}</h3>
        <p className="text-sm text-ink-3"><span className="font-semibold text-ok">{counts.pass}</span> {t('passed')} · <span className="font-semibold text-bad">{counts.fail}</span> {t('failed')}</p>
      </div>
      <ul className="divide-y divide-line">
        {sorted.map((c, i) => {
          const s = STATUS[c.status];
          return (
            <motion.li key={c.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="flex gap-3 py-3">
              <span className={clsx('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full', s.cls)}><s.Icon className="size-3.5" strokeWidth={3} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={clsx('font-semibold', c.status === 'skipped' ? 'text-ink-3' : 'text-ink')}>{NAMES[c.id] ?? c.id}</p>
                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider mono', c.type === 'hard' ? 'bg-ink/5 text-ink-2' : 'bg-info-soft text-info')}>{KIND[c.type]}</span>
                </div>
                <p className="text-[14px] text-ink-2">{c.reason}</p>
                {c.source && /^https?:/.test(c.source) && (
                  <a href={c.source} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">Source <ExternalLink className="size-3" /></a>
                )}
              </div>
            </motion.li>
          );
        })}
      </ul>
      {skipped > 0 && (
        <button onClick={() => setShowSkipped(!showSkipped)} className="mt-2 text-sm font-semibold text-brand">
          {showSkipped ? 'Hide' : 'Show'} {skipped} {t('skipped')}
        </button>
      )}
    </section>
  );
}
