import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, Gauge, Coins, Target, Boxes, Store, FileSearch, Megaphone, ScanLine, FlaskConical, Radio } from 'lucide-react';
import clsx from 'clsx';
import { TopBar, Page, ModelTag, ErrorNote, VERDICT } from '../components/ui.jsx';
import { get } from '../lib/api.js';

// Display rate for naira estimates; shown on the page next to every ₦ figure.
const NGN_PER_USD = Number(import.meta.env.VITE_NGN_PER_USD) || 1500;

const VERDICT_LABEL = {
  genuine_authorized: 'Genuine: authorized chain', checked_open_market: 'Checked: open market', no_red_flags: 'No red flags',
  no_record: 'No record', caution: 'Caution', high_risk: 'High risk', cant_verify: "Can't verify",
};
const VERDICT_ORDER = ['genuine_authorized', 'checked_open_market', 'no_red_flags', 'no_record', 'cant_verify', 'caution', 'high_risk'];
const VERDICT_FILL = { ok: '#1A9E5C', warn: '#E39B0E', bad: '#D92D3F', mute: '#8A93A0', info: '#2F6FEB' };

const CHECK_LABEL = {
  SERIAL_CLONE: 'Copied serial caught at the door', WRONG_SHOP: 'Sold by a different shop', EXPIRED: 'Expired',
  ALERT_MATCH: 'Matched a NAFDAC alert', SERIAL_NEVER_ISSUED: 'Serial never issued by maker', TAMPER_SIGNS: 'Signs of date tampering',
  REG_NOT_FOUND: 'NAFDAC number not registered', REG_PRODUCT_MISMATCH: 'NAFDAC number belongs to another product',
  SHELF_LIFE_IMPLAUSIBLE: 'Impossible shelf life', GS1_INVALID: 'Invalid 2D code', BARCODE_PRINT_MISMATCH: 'Barcode disagrees with print',
  ALREADY_SOLD_ELSEWHERE: 'Already sold in another city', ARTWORK_DIFFERENCE: 'Artwork differs from genuine', LOOKALIKE_NAME: 'Lookalike brand name',
  BATCH_SHOP_MISMATCH: 'Batch never sent to that shop', REPEAT_NEARBY: 'Checked before nearby',
};
const FIELD_LABEL = { brandName: 'Product name', regNo: 'NAFDAC number', batch: 'Batch', expiry: 'Expiry date', manufactureDate: 'Manufacture date' };
const STEP_LABEL = {
  quality: ['Photo quality checked', null], samBarcode0: ['Barcode found', 'SAM 3.1'], extraction: ['Label read', 'Muse Spark'],
  tamper: ['Date block checked for tampering', 'Muse Spark'], total: ['Verdict ready', null],
};
const MODEL_NAME = (id) => (id.startsWith('muse-spark') ? 'Muse Spark' : id.startsWith('sam') ? 'SAM 3.1' : id.startsWith('muse-voice') ? 'Voice Transcribe' : id);

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const secs = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)} s`);
const num = (n) => (n ?? 0).toLocaleString('en-NG');
const naira = (usd) => `₦${(usd * NGN_PER_USD).toLocaleString('en-NG', { maximumFractionDigits: usd * NGN_PER_USD < 100 ? 1 : 0 })}`;

/**
 * Network insights: is the AI right, what the network caught, and Meta AI at work.
 * Public, totals only. Every section is labelled Live, Evaluation, or Sample data.
 */
export default function Insights() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['insights'], queryFn: () => get('/insights'), refetchInterval: 30_000 });

  return (
    <Page lab>
      <TopBar dark back={<button onClick={() => navigate(-1)} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back"><ArrowLeft className="size-5" /></button>} />
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-8">
        <header className="mb-8">
          <p className="mono text-xs font-semibold uppercase tracking-[0.2em] text-mint">Network insights</p>
          <h1 className="display mt-2 text-4xl font-bold leading-tight md:text-5xl">Is TrueMed right, and what has it caught?</h1>
          <p className="mt-3 max-w-2xl text-lab-dim">Totals only. No photos, phones or exact locations are shown here. Each panel says where its numbers come from.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <SourceBadge source="live" /><SourceBadge source="eval" /><SourceBadge source="sample" />
          </div>
        </header>

        {isLoading && <Skeleton />}
        {error && <ErrorNote dark onRetry={refetch}>We couldn’t load the numbers just now.</ErrorNote>}
        {data && (
          <div className="space-y-12">
            <Accuracy e={data.evaluation} />
            <Network n={data.network} />
            <MetaAtWork m={data.meta} />
            <p className="text-center text-xs text-lab-dim">Updated {new Date(data.generatedAt).toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' })} WAT · refreshes every 30 s · ₦ figures at ₦{num(NGN_PER_USD)}/$</p>
          </div>
        )}
      </div>
    </Page>
  );
}

/* ---------- sections ---------- */

function Accuracy({ e }) {
  const fields = Object.entries(e.fieldAccuracy ?? {});
  return (
    <Section n="01" title="Is the AI right?" sub={`Tested on ${num(e.cases)} labelled packs${e.ranAt ? `, ${new Date(e.ranAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}.`} source={e.source}>
      <div className="grid gap-3 md:grid-cols-[1.3fr_1fr]">
        <Tile big Icon={ShieldCheck} tone="mint"
          value={`${num(e.falseHighOnGenuine)} of ${num(e.genuineCases)}`}
          label="genuine packs wrongly called High risk"
          note="The number that matters most: a false alarm can cost a pharmacy its customers." />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <Tile Icon={Target} value={pct(e.verdictAccuracy)} label="verdicts correct" />
          <Tile Icon={Gauge} value={secs(e.medianLatencyMs)} label="median scan, photo to verdict" />
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Panel title="Reading the label" tag={<ModelTag dark model="Muse Spark" />}>
          <Bars rows={fields.map(([k, v]) => ({ key: k, label: FIELD_LABEL[k] ?? k, value: v, display: pct(v) }))} max={1} />
        </Panel>
        <Panel title="Hard checks">
          <div className="grid grid-cols-2 gap-3">
            <Mini value={pct(e.hardCheckPrecision)} label="precision" hint="When a hard check fails, how often it was right" />
            <Mini value={pct(e.hardCheckRecall)} label="recall" hint="Of the real problems, how many were caught" />
            <Mini value={`$${(e.costPerScanUsd ?? 0).toFixed(3)}`} label={`per scan · ≈ ${naira(e.costPerScanUsd ?? 0)}`} hint="All Meta AI calls for one scan" />
            <Mini value={num(e.cases)} label="test packs" hint={`${num(e.genuineCases)} genuine, the rest with known problems`} />
          </div>
        </Panel>
      </div>
    </Section>
  );
}

function Network({ n }) {
  const verdicts = VERDICT_ORDER.map((k) => ({ key: k, value: n.verdicts?.[k] ?? 0 })).filter((v) => v.value > 0);
  const vTotal = verdicts.reduce((a, v) => a + v.value, 0) || 1;
  const caught = Object.entries(n.caught ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const cityMax = Math.max(1, ...(n.cities ?? []).map((c) => c.scans));
  return (
    <Section n="02" title="What the network caught" sub="Every pack checked at a pharmacy door (Gate 1) or at home (Gate 2)." source={n.source}
      extra={n.source === 'sample' && n.liveScans != null ? `${num(n.liveScans)} real scans so far; live numbers appear from 20.` : null}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile Icon={ScanLine} value={num(n.scans?.total)} label={`scans · ${num(n.scans?.home)} home, ${num(n.scans?.receiving)} receiving`} />
        <Tile Icon={Boxes} value={num(n.packsInLedger)} label="packs in the ledger" />
        <Tile Icon={Megaphone} value={num(n.shopsWarned)} label="shops warned" />
        <Tile Icon={FileSearch} value={num(n.caseFiles)} label="case files opened" />
      </div>

      <Panel className="mt-3" title="Verdicts">
        <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Share of verdicts">
          {verdicts.map((v) => (
            <Hover key={v.key} tip={`${VERDICT_LABEL[v.key]}: ${num(v.value)} (${pct(v.value / vTotal)})`} style={{ width: `${(v.value / vTotal) * 100}%` }}>
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6 }} className="h-full origin-left" style={{ background: VERDICT_FILL[VERDICT[v.key].tone] }} />
            </Hover>
          ))}
        </div>
        <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {verdicts.map((v) => {
            const { Icon, tone } = VERDICT[v.key];
            return (
              <li key={v.key} className="flex items-center gap-2 text-sm">
                <Icon className="size-4 shrink-0" style={{ color: VERDICT_FILL[tone] }} />
                <span className="flex-1 text-lab-ink">{VERDICT_LABEL[v.key]}</span>
                <span className="mono tabular-nums text-lab-ink">{num(v.value)}</span>
                <span className="mono w-10 text-right tabular-nums text-lab-dim">{pct(v.value / vTotal)}</span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Panel title="Problems caught">
          {caught.length ? <Bars rows={caught.map(([k, v]) => ({ key: k, label: CHECK_LABEL[k] ?? k, value: v, display: num(v) }))} /> : <Empty>Nothing flagged yet.</Empty>}
        </Panel>
        <Panel title="Where scans happen" tag={<span className="text-xs text-lab-dim">city level only</span>}>
          {n.cities?.length ? (
            <Bars rows={n.cities.map((c) => ({ key: c.city, label: c.city, value: c.scans, display: num(c.scans), note: `${num(c.flagged)} flagged` }))} max={cityMax} />
          ) : <Empty>No city data yet (shared only with consent).</Empty>}
        </Panel>
      </div>
    </Section>
  );
}

function MetaAtWork({ m }) {
  const t = m.timings ?? {};
  const steps = Object.keys(STEP_LABEL).filter((k) => t[k] != null);
  const stepMax = Math.max(1, ...steps.map((k) => t[k]));
  const callMax = Math.max(1, ...m.byModel.map((x) => x.calls));
  return (
    <Section n="03" title="Meta AI at work" sub={`Every call to Meta’s models over the last ${m.days} day${m.days === 1 ? '' : 's'}.`} source="live">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile Icon={Radio} value={num(m.calls)} label="model calls" />
        <Tile Icon={Coins} value={`$${m.costUsd.toFixed(2)}`} label={`total spend · ≈ ${naira(m.costUsd)}`} />
        <div className="col-span-2 flex flex-wrap content-center gap-2 rounded-3xl border border-lab-line bg-lab-2 p-4 md:col-span-1">
          <ModelTag dark active model="Muse Spark" /><ModelTag dark active model="SAM 3.1" /><ModelTag dark active model="Voice Transcribe" />
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Panel title="Calls by model">
          {m.byModel.length ? (
            <Bars rows={m.byModel.map((x) => ({ key: x.model, label: MODEL_NAME(x.model), value: x.calls, display: num(x.calls), note: `$${x.costUsd.toFixed(2)}` }))} max={callMax} />
          ) : <Empty>No calls yet today.</Empty>}
        </Panel>
        <Panel title="Photo to verdict" tag={<SourceBadge source={t.source} small />}>
          <Bars rows={steps.map((k) => ({ key: k, label: STEP_LABEL[k][0], value: t[k], display: secs(t[k]), note: STEP_LABEL[k][1] }))} max={stepMax} />
          <p className="mt-3 text-xs text-lab-dim">Seconds from the photo arriving until each step is done (median of {t.source === 'live' ? `${num(t.n)} real scans` : 'sample scans'}). SAM runs alongside Muse Spark’s reading.</p>
        </Panel>
      </div>
    </Section>
  );
}

/* ---------- pieces ---------- */

const SOURCE = {
  live: { label: 'Live', cls: 'bg-mint/15 text-mint ring-mint/30', Icon: Radio },
  eval: { label: 'Evaluation', cls: 'bg-cyan/15 text-cyan ring-cyan/30', Icon: FlaskConical },
  sample: { label: 'Sample data', cls: 'bg-warn/15 text-warn ring-warn/40', Icon: FlaskConical },
};

function SourceBadge({ source, small }) {
  const s = SOURCE[source] ?? SOURCE.sample;
  return (
    <span className={clsx('mono inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider ring-1', small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]', s.cls)}>
      <s.Icon className="size-3" />{s.label}
    </span>
  );
}

function Section({ n, title, sub, source, extra, children }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono text-xs text-lab-dim">{n}</p>
          <h2 className="display text-2xl font-semibold md:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-lab-dim">{sub}</p>
        </div>
        <SourceBadge source={source} />
      </div>
      {source === 'sample' && (
        <p className="mb-3 rounded-2xl bg-warn/10 px-4 py-2.5 text-sm text-warn ring-1 ring-warn/30">
          Sample data for layout only. These are not results. {extra}
        </p>
      )}
      {children}
    </section>
  );
}

function Tile({ Icon, value, label, note, big, tone }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      className={clsx('rounded-3xl border border-lab-line bg-lab-2 p-5', big && 'flex flex-col justify-between md:p-7')}>
      <Icon className={clsx('size-5', tone === 'mint' ? 'text-mint' : 'text-lab-dim')} />
      <div className={clsx(big ? 'mt-6' : 'mt-3')}>
        <p className={clsx('display font-bold tabular-nums leading-none', big ? 'text-5xl md:text-6xl' : 'text-3xl')}>{value}</p>
        <p className={clsx('mt-2 text-lab-dim', big ? 'text-base' : 'text-sm')}>{label}</p>
        {note && <p className="mt-4 max-w-sm text-sm text-lab-ink/80">{note}</p>}
      </div>
    </motion.div>
  );
}

function Mini({ value, label, hint }) {
  return (
    <Hover tip={hint} className="block rounded-2xl bg-lab-3/60 p-3">
      <p className="display text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-lab-dim">{label}</p>
    </Hover>
  );
}

function Panel({ title, tag, className, children }) {
  return (
    <div className={clsx('rounded-3xl border border-lab-line bg-lab-2 p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-lab-dim">{title}</h3>
        {tag}
      </div>
      {children}
    </div>
  );
}

/** One measure, one hue (mint). Value and label are always printed, so the bar is never the only carrier. */
function Bars({ rows, max }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <Hover tip={`${r.label}: ${r.display}${r.note ? ` · ${r.note}` : ''}`} className="block">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-lab-ink">{r.label}{r.note && <span className="ml-2 text-xs text-lab-dim">{r.note}</span>}</span>
              <span className="mono tabular-nums text-lab-ink">{r.display}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-lab-3">
              <motion.div initial={{ width: 0 }} whileInView={{ width: `${Math.max(2, (r.value / top) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.7, ease: 'easeOut' }}
                className="h-full rounded-full bg-mint" />
            </div>
          </Hover>
        </li>
      ))}
    </ul>
  );
}

/** Hover / focus tooltip. */
function Hover({ tip, children, className, style }) {
  const [on, setOn] = useState(false);
  return (
    <div className={clsx('relative', className)} style={style} tabIndex={tip ? 0 : undefined}
      onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)} onFocus={() => setOn(true)} onBlur={() => setOn(false)}>
      {children}
      {tip && on && (
        <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-64 -translate-x-1/2 rounded-lg bg-lab-ink px-2.5 py-1.5 text-xs font-medium text-lab shadow-lg">{tip}</span>
      )}
    </div>
  );
}

function Empty({ children }) {
  return <p className="py-6 text-center text-sm text-lab-dim">{children}</p>;
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-lab-2" />)}
    </div>
  );
}
