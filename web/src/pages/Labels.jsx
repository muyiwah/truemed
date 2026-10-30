import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { TopBar, Page, Button } from '../components/ui.jsx';

const API = import.meta.env.VITE_API_URL || '/api';
const GROUPS = [
  { title: 'Received by Ikeja Care (authorized)', serials: ['DQ000001', 'DQ000002', 'DQ000003', 'DQ000004', 'DQ000005'] },
  { title: 'Received by Ojo chemist (open market)', serials: ['DQ000006', 'DQ000007', 'DQ000008'] },
  { title: 'Logged in Kano — scan at another shop for the clone demo', serials: ['DQ000009'] },
  { title: 'Dispatched, not yet received — clean receiving', serials: ['DQ000010', 'DQ000011', 'DQ000012'] },
  { title: 'Never dispatched', serials: ['DQ000016'] },
  { title: 'Never issued — the container fake', serials: ['DQ999999'] },
];

/** Printable GS1 DataMatrix labels for the DemoQuin supply-chain demo. */
export default function Labels() {
  const navigate = useNavigate();
  const [custom, setCustom] = useState('');
  return (
    <Page>
      <div className="print:hidden"><TopBar back={<button onClick={() => navigate(-1)} className="grid size-9 place-items-center rounded-full hover:bg-black/5" aria-label="Back"><ArrowLeft className="size-5" /></button>} /></div>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h1 className="display text-4xl font-bold">DemoQuin labels</h1>
            <p className="mt-1 max-w-2xl text-ink-2">Print these and stick them on any plain box to run the supply-chain demo with a real camera. Every label says DEMO — NOT A REAL PRODUCT.</p>
          </div>
          <Button size="md" onClick={() => window.print()}><Printer className="size-4" />Print</Button>
        </div>
        {GROUPS.map((g) => (
          <section key={g.title} className="mt-8 break-inside-avoid">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-3">{g.title}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {g.serials.map((s) => (
                <figure key={s} className="rounded-2xl border border-line bg-white p-3">
                  <img src={`${API}/demo/labels/${s}.png`} alt={`DemoQuin label ${s}`} className="w-full" loading="lazy" />
                </figure>
              ))}
            </div>
          </section>
        ))}
        <section className="mt-8 print:hidden">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-3">Any serial</h2>
          <input value={custom} onChange={(e) => setCustom(e.target.value.toUpperCase())} placeholder="DQ000013" className="mono h-12 w-60 rounded-xl border border-line bg-card px-3" />
          {/^DQ\d{6}$/.test(custom) && <img src={`${API}/demo/labels/${custom}.png`} alt="" className="mt-3 w-64 rounded-2xl border border-line bg-white p-3" />}
        </section>
      </div>
    </Page>
  );
}
