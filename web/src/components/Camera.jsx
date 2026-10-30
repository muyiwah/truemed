import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ImageUp, Zap, ZapOff, CameraOff } from 'lucide-react';
import clsx from 'clsx';

/**
 * Live camera viewfinder with a pack-shaped framing guide.
 * Falls back to file upload when there is no camera, no permission, or no HTTPS.
 *
 * @param {{ title: string, hint: string, onCapture: (blob: Blob) => void, footer?: React.ReactNode, captureLabel: string, uploadLabel: string }} props
 */
export default function Camera({ title, hint, onCapture, footer, captureLabel, uploadLabel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [state, setState] = useState('starting'); // starting | live | unavailable
  const [torch, setTorch] = useState(null); // null = unsupported
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setState('unavailable'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        const caps = stream.getVideoTracks()[0]?.getCapabilities?.();
        if (caps?.torch) setTorch(false);
        setState('live');
      } catch {
        if (!cancelled) setState('unavailable');
      }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch(!torch); } catch { setTorch(null); }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    c.toBlob((b) => b && onCapture(b), 'image/jpeg', 0.92);
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f) onCapture(f);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-lab sm:aspect-[4/3]">
        <video ref={videoRef} playsInline muted className={clsx('absolute inset-0 size-full object-cover transition-opacity duration-500', state === 'live' ? 'opacity-100' : 'opacity-0')} />

        {state !== 'live' && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center text-lab-dim lab-grid">
            {state === 'starting' ? (
              <p className="text-sm">Starting camera…</p>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <CameraOff className="size-8" />
                <p className="text-sm text-lab-ink/80">Camera not available here. Upload a photo instead.</p>
              </div>
            )}
          </div>
        )}

        {/* Framing guide */}
        <div className="pointer-events-none absolute inset-[9%_12%] sm:inset-[10%_22%]">
          {['top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl', 'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl', 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl', 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl'].map((c) => (
            <span key={c} className={clsx('absolute size-10 border-mint drop-shadow-[0_0_8px_rgba(61,220,151,.6)]', c)} />
          ))}
          {state === 'live' && <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-mint to-transparent animate-scan" />}
        </div>

        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-4 pb-10 text-white">
          <p className="display text-lg font-semibold">{title}</p>
          <p className="text-sm text-white/80">{hint}</p>
        </div>

        {flash && <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} className="absolute inset-0 bg-white" />}

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-6 pb-5 pt-12">
          <button onClick={() => fileRef.current?.click()} className="grid size-12 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25" aria-label={uploadLabel}>
            <ImageUp className="size-5" />
          </button>
          <button
            onClick={state === 'live' ? capture : () => fileRef.current?.click()}
            className="group relative grid size-[76px] place-items-center rounded-full bg-white/20 backdrop-blur"
            aria-label={state === 'live' ? captureLabel : uploadLabel}
          >
            <span className="size-[60px] rounded-full bg-white transition group-active:scale-90" />
          </button>
          {torch !== null ? (
            <button onClick={toggleTorch} className="grid size-12 place-items-center rounded-full bg-white/15 text-white backdrop-blur" aria-label="Torch">
              {torch ? <Zap className="size-5" /> : <ZapOff className="size-5" />}
            </button>
          ) : <span className="size-12" />}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </div>
      {footer}
    </div>
  );
}
