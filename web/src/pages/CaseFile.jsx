import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Copy, Check, Mail, Loader2, Wrench, Brain, PenLine, FileText } from 'lucide-react';
import clsx from 'clsx';
import { TopBar, Page, Button, ErrorNote, ModelTag } from '../components/ui.jsx';
import { stream } from '../lib/api.js';

const TOOL_LABEL = {
  getPackHistory: 'Pack history', getShop: 'Shop record', getShopReconciliation: 'Shop reconciliation',
  findAlerts: 'NAFDAC alerts', getScansForBatch: 'Batch scans', getProduct: 'Registry record',
};

/** The Investigator: a live reasoning trail, then the case file and a draft report the user sends. */
export default function CaseFile() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [steps, setSteps] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const started = useRef(false);

  const start = () => {
    setSteps([]); setError(null); setResult(null);
    stream('/investigate', { sessionId }, (s) => setSteps((p) => [...p, s]))
      .then(setResult)
      .catch((e) => setError(e.message));
  };
  useEffect(() => { if (!started.current) { started.current = true; start(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const trail = steps.filter((s) => s.kind === 'tool' || s.kind === 'thought' || s.kind === 'writing');
  const cf = result?.caseFile;

  return (
    <Page lab={!cf}>
      <TopBar dark={!cf} back={<button onClick={() => navigate(-1)} className="grid size-9 place-items-center rounded-full hover:bg-black/5" aria-label="Back"><ArrowLeft className="size-5" /></button>} />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-10">
        <section className={clsx('rounded-[28px] p-5 ring-1', cf ? 'lab ring-lab-line lg:sticky lg:top-20 lg:self-start' : 'ring-lab-line')}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-xl font-semibold text-lab-ink">Investigator</h2>
            <ModelTag dark active={!cf && !error} model="Muse Spark · tools" />
          </div>
          <ol className="relative space-y-3 border-l border-lab-line pl-5">
            <AnimatePresence initial={false}>
              {trail.map((s, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="relative">
                  <span className="absolute -left-[29px] grid size-4 place-items-center rounded-full bg-lab ring-2 ring-mint" />
                  {s.kind === 'tool' && (
                    <div className="rounded-2xl bg-lab-2 p-3 ring-1 ring-lab-line">
                      <p className="flex items-center gap-2 text-sm font-semibold text-mint"><Wrench className="size-4" />{TOOL_LABEL[s.tool] ?? s.tool}</p>
                      <p className="mono mt-1 truncate text-xs text-lab-dim">{s.tool}({Object.values(s.args ?? {}).filter(Boolean).map((v) => JSON.stringify(v)).join(', ')})</p>
                      <p className="mt-1 text-sm text-lab-ink">{s.summary}</p>
                    </div>
                  )}
                  {s.kind === 'thought' && <p className="flex gap-2 text-sm text-lab-ink/90"><Brain className="mt-0.5 size-4 shrink-0 text-cyan" />{s.text}</p>}
                  {s.kind === 'writing' && <p className="flex items-center gap-2 text-sm text-lab-ink"><PenLine className="size-4 text-mint" />{s.text}{!cf && <Loader2 className="size-4 animate-spin" />}</p>}
                </motion.li>
              ))}
            </AnimatePresence>
            {!cf && !error && trail.length === 0 && <li className="flex items-center gap-2 text-sm text-lab-dim"><Loader2 className="size-4 animate-spin" />Opening the ledger…</li>}
          </ol>
          {error && <div className="mt-4"><ErrorNote dark onRetry={start}>{error}</ErrorNote></div>}
        </section>

        <section>
          {!cf ? (
            <div className="grid h-full min-h-60 place-items-center rounded-[28px] border border-dashed border-lab-line text-lab-dim">
              <p className="flex items-center gap-2"><FileText className="size-5" />The case file appears here</p>
            </div>
          ) : <CaseDoc cf={cf} />}
        </section>
      </div>
    </Page>
  );
}

function CaseDoc({ cf }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(cf.draftReport); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } };
  const mail = `mailto:?subject=${encodeURIComponent(`Suspected falsified product — ${cf.headline}`)}&body=${encodeURIComponent(cf.draftReport)}`;
  return (
    <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 rounded-[28px] border border-line bg-card p-6 shadow-card">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-bad">Case file</p>
        <h1 className="display mt-1 text-3xl font-bold leading-tight">{cf.headline}</h1>
        <p className="mt-2 text-[16px] text-ink-2">{cf.whatHappened}</p>
      </div>
      <Block title="Evidence"><ul className="list-disc space-y-1 pl-5">{cf.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul></Block>
      {cf.timeline.length > 0 && (
        <Block title="Timeline">
          <ol className="space-y-2">{cf.timeline.map((e, i) => <li key={i} className="flex gap-3"><span className="mono w-36 shrink-0 text-sm text-ink-3">{e.when}</span><span>{e.event}</span></li>)}</ol>
        </Block>
      )}
      {cf.shopsInvolved.length > 0 && <Block title="Shops involved"><ul className="space-y-1">{cf.shopsInvolved.map((s, i) => <li key={i}><span className="font-semibold">{s.name}</span> — {s.role}</li>)}</ul></Block>}
      {cf.matchingAlerts.length > 0 && <Block title="Matching NAFDAC alerts"><ul className="list-disc pl-5">{cf.matchingAlerts.map((a, i) => <li key={i}>{a}</li>)}</ul></Block>}
      <Block title="Recommended next step"><p className="font-medium">{cf.recommendedNextStep}</p></Block>
      <div className="rounded-2xl bg-paper p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink-3">Draft report to NAFDAC / PCN</p>
          <span className="text-xs text-ink-3">You review and send it</span>
        </div>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-sans text-[15px] leading-relaxed">{cf.draftReport}</pre>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button size="md" variant="secondary" onClick={copy}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copied' : 'Copy report'}</Button>
          <Button size="md" as="a" href={mail}><Mail className="size-4" />Open in email</Button>
        </div>
      </div>
    </motion.article>
  );
}

const Block = ({ title, children }) => (
  <div><h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-ink-3">{title}</h3><div className="text-[15px] text-ink">{children}</div></div>
);
