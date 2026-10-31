import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldX, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { TopBar, Page, ModelTag, Card } from '../components/ui.jsx';

const HARD = [
  ['NAFDAC registration exists', 'Positive answer from NAFDAC’s registry; “not in our list” is never enough'],
  ['Registration matches the product', 'The number belongs to this product and strength'],
  ['Not in a NAFDAC alert', 'Batch or fake-only registration number in an approved public alert'],
  ['Not expired', 'Expiry month has not passed'],
  ['Dates are believable', 'Expiry minus manufacture date fits the product’s normal shelf life (catches relabeled stock)'],
  ['Valid 2D code', 'GS1 structure and check digit'],
  ['Barcode matches print', 'The batch and expiry inside the code match what is printed'],
  ['Serial not copied', 'At receiving: no other shop already logged this serial'],
  ['From the right shop', 'The shop you confirmed is the shop that received this serial'],
  ['Issued by the manufacturer', 'The serial is on the maker’s issued and dispatched list'],
];
const SOFT = [
  ['Packaging matches genuine', 'Muse Spark compares artwork with genuine reference photos'],
  ['No tampering on dates', 'Muse Spark examines the SAM-outlined date block for overprinting or stickers'],
  ['Not a lookalike brand', '“Coglaet” for Colgate'],
  ['First check of this pack', 'Another phone already checked this serial nearby'],
];
const REGISTRY = [
  ['Greenbook, copied by hand', 'Real products, each linked to its NAFDAC Greenbook page. We never bulk-copy the portal.'],
  ['NAFDAC sandbox (simulated)', 'Our mock of the API NAFDAC’s 2024 traceability rules imply, for the fictional DemoQuin brand only. Not operated by NAFDAC.'],
  ['NAFDAC registry API', 'Not connected: NAFDAC has not opened one. TrueMed is built so connecting it is configuration, not a rebuild.'],
  ['No answer', 'If no source can answer, the number is never called fake; the verdict is “No record”.'],
];
// VITE_API_URL ends in /api; the sandbox sits beside it.
const SANDBOX = `${(import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')}/sandbox/nafdac/v1`;

const LIMITS = [
  'NAFDAC has no public API. Real registrations come from records copied by hand, so many genuine products show “No record” until NAFDAC opens access.',
  'A perfect copy with an invented serial passes until brands share the serials they actually issued. That integration is the first production step — DemoQuin shows how it works.',
  'Packs with only a batch number (no unit serial) can’t be bound to one shop; a mismatch is Caution only.',
  'What is inside the pack needs a lab. TrueMed checks the pack, not the pill.',
  'Methanol-laced or unbranded products have no label to check.',
  'Spoken Yoruba and Hausa are not yet supported by Meta’s hosted speech model; written explanations are.',
];

export default function How() {
  const navigate = useNavigate();
  return (
    <Page>
      <TopBar back={<button onClick={() => navigate(-1)} className="grid size-9 place-items-center rounded-full hover:bg-black/5" aria-label="Back"><ArrowLeft className="size-5" /></button>} />
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        <header>
          <h1 className="display text-5xl font-bold leading-tight">How TrueMed decides</h1>
          <p className="mt-3 text-lg text-ink-2">The ledger knows where every pack should be. Meta AI checks whether it really is — at the pharmacy door (Gate 1) and at home (Gate 2).</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <Tier Icon={ShieldX} cls="text-bad" title="High risk" text="Only when a hard fact fails. If the fact came from text the AI read, you confirm it first." />
          <Tier Icon={ShieldAlert} cls="text-warn" title="Caution" text="AI judgement alone (artwork, tampering, lookalike) can never go higher than this." />
          <Tier Icon={ShieldCheck} cls="text-ok" title="Genuine: authorized chain / Checked: open-market" text="All checks pass and the shop you named is the shop that received the pack." />
          <Tier Icon={ShieldQuestion} cls="text-mute" title="No record" text="We don’t hold this product. This does not mean it’s fake." />
        </section>

        <section>
          <h2 className="display mb-3 text-2xl font-semibold">Meta models, and what each one does</h2>
          <Card className="divide-y divide-line">
            {[
              ['Muse Spark', 'Reads the pack into structured fields; examines the date block; compares artwork; understands Pidgin shop answers; explains results in four languages; powers the Sentinel and the Investigator.'],
              ['SAM 3.1', 'Outlines the barcode, label and date block on every photo; tracks every pack across a carton video.'],
              ['Muse Voice Transcribe', 'Turns a spoken “where did you buy it?” into text, including Nigerian Pidgin.'],
            ].map(([m, d]) => <div key={m} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start"><div className="w-48 shrink-0"><ModelTag model={m} /></div><p className="text-ink-2">{d}</p></div>)}
          </Card>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div><h2 className="display mb-3 text-2xl font-semibold">Hard facts</h2><List items={HARD} /></div>
          <div><h2 className="display mb-3 text-2xl font-semibold">AI judgement <span className="text-base font-normal text-ink-3">(Caution at most)</span></h2><List items={SOFT} /></div>
        </section>

        <section>
          <h2 className="display mb-3 text-2xl font-semibold">Where NAFDAC data comes from</h2>
          <p className="mb-3 text-ink-2">NAFDAC has no public API yet, so TrueMed asks the most honest source it has, and says which one answered.</p>
          <List items={REGISTRY} />
          <p className="mt-3 text-sm text-ink-3">
            Try the sandbox: <a className="font-medium text-brand hover:underline" href={`${SANDBOX}/registrations/DEMO-0001`} target="_blank" rel="noreferrer">DEMO-0001</a> (registered) ·{' '}
            <a className="font-medium text-brand hover:underline" href={`${SANDBOX}/registrations/DEMO-0099`} target="_blank" rel="noreferrer">DEMO-0099</a> (not registered)
          </p>
        </section>

        <section>
          <h2 className="display mb-3 text-2xl font-semibold">Why anonymous users see less detail</h2>
          <p className="text-ink-2">Anyone gets a clear verdict and plain reasons. Exact artwork differences are shown only to verified pharmacists and chemists, so counterfeiters can’t use TrueMed to perfect their copies. Repeated near-identical failing scans from one phone are flagged.</p>
        </section>

        <section>
          <h2 className="display mb-3 text-2xl font-semibold">Accuracy</h2>
          <Card className="p-5 text-ink-2">Results from our test set of real packs will appear here: verdict accuracy, false High-risk rate on genuine packs (target: zero), median scan time and cost per scan.</Card>
        </section>

        <section>
          <h2 className="display mb-3 text-2xl font-semibold">What TrueMed can’t do yet</h2>
          <ul className="list-disc space-y-2 pl-5 text-ink-2">{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
        </section>

        <section className="text-sm text-ink-3">
          <p>Data: NAFDAC public alerts (each linked to its source), registry entries copied by hand from NAFDAC’s Greenbook, and the network’s own scans. All demo shops and the DemoQuin brand are fictional.</p>
          <p className="mt-2">This is a screening tool, not a lab test. Confirm with a pharmacist.</p>
        </section>
      </div>
    </Page>
  );
}

const Tier = ({ Icon, cls, title, text }) => (
  <Card className="flex gap-3 p-5"><Icon className={`size-8 shrink-0 ${cls}`} /><div><p className="font-semibold">{title}</p><p className="text-[15px] text-ink-2">{text}</p></div></Card>
);
const List = ({ items }) => (
  <ul className="space-y-2">{items.map(([k, v]) => <li key={k} className="rounded-2xl border border-line bg-card p-3"><p className="font-semibold">{k}</p><p className="text-sm text-ink-3">{v}</p></li>)}</ul>
);
