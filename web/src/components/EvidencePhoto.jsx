import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const TONE = { red: '#FF4D5E', green: '#3DDC97', amber: '#F5B83D' };

/**
 * The pack photo with SAM 3.1 masks and boxes drawn over it.
 * Regions carry the size of the image the server analysed, so the SVG viewBox
 * lines up with the photo exactly.
 *
 * @param {{ src: string, regions?: object[], scanning?: boolean, size?: {width:number,height:number}, className?: string, rounded?: boolean }} p
 */
export default function EvidencePhoto({ src, regions = [], scanning = false, size, className, rounded = true }) {
  const s = size ?? regions[0]?.size ?? null;
  const [natural, setNatural] = useState(null);
  const ratio = s ? `${s.width} / ${s.height}` : natural ?? '3 / 4';
  return (
    <div className={clsx('relative w-full overflow-hidden bg-lab', rounded && 'rounded-3xl', className)} style={{ aspectRatio: ratio }}>
      <img src={src} alt="Your pack" className="absolute inset-0 size-full object-cover" onLoad={(e) => setNatural(`${e.currentTarget.naturalWidth} / ${e.currentTarget.naturalHeight}`)} />
      {scanning && (
        <>
          <div className="absolute inset-0 bg-lab/35" />
          <div className="absolute inset-0 lab-grid opacity-70" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-mint/0 via-mint/25 to-mint/0 animate-scan" />
          <div className="absolute inset-x-0 top-0 h-px bg-mint shadow-[0_0_18px_4px_rgba(61,220,151,.7)] animate-scan" />
        </>
      )}
      {s && regions.length > 0 && (
        <svg viewBox={`0 0 ${s.width} ${s.height}`} className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice">
          {regions.map((r, i) => {
            const c = TONE[r.tone] ?? TONE.green;
            const sw = Math.max(3, s.width / 260);
            const font = Math.max(20, s.width / 34);
            return (
              <g key={`${r.kind}-${i}`}>
                {r.path?.d && (
                  <motion.path
                    d={r.path.d} transform={r.path.transform} fill={c} fillOpacity={0.22} stroke={c} strokeWidth={sw}
                    initial={{ pathLength: 0, fillOpacity: 0 }} animate={{ pathLength: 1, fillOpacity: 0.22 }} transition={{ duration: 1.1, delay: 0.25 + i * 0.35, ease: 'easeInOut' }}
                  />
                )}
                <motion.rect
                  x={r.box.left} y={r.box.top} width={r.box.right - r.box.left} height={r.box.bottom - r.box.top} rx={sw * 3}
                  fill="none" stroke={c} strokeWidth={sw} strokeDasharray={r.path?.d ? `${sw * 3} ${sw * 3}` : undefined}
                  initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45, delay: 0.1 + i * 0.35 }}
                  style={{ transformOrigin: `${(r.box.left + r.box.right) / 2}px ${(r.box.top + r.box.bottom) / 2}px` }}
                />
                <motion.g initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.35 }}>
                  <rect x={r.box.left} y={Math.max(0, r.box.top - font * 1.5)} width={(r.label.length * font * 0.6) + font} height={font * 1.35} rx={font * 0.35} fill={c} />
                  <text x={r.box.left + font * 0.5} y={Math.max(0, r.box.top - font * 1.5) + font * 0.98} fontSize={font} fontWeight="700" fontFamily="Inter, sans-serif" fill="#06100B">{r.label}</text>
                </motion.g>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
