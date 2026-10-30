import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import clsx from 'clsx';

const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) ?? '';

/**
 * Hold to talk. Records with MediaRecorder (webm/opus or mp4/aac on Safari),
 * shows a live level ring, and hands the blob up on release. Max 15 s.
 */
export default function VoiceButton({ onAudio, label, releaseLabel, disabled }) {
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState(null);
  const rec = useRef(null);
  const raf = useRef(0);
  const timer = useRef(0);

  useEffect(() => () => stopAll(), []);

  function stopAll() {
    cancelAnimationFrame(raf.current);
    clearTimeout(timer.current);
    rec.current?.stream?.getTracks().forEach((t) => t.stop());
    rec.current?.ctx?.close?.().catch(() => {});
  }

  async function start(e) {
    e.preventDefault();
    if (disabled || recording) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = pickMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      mr.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        stopAll();
        if (blob.size > 2000) onAudio(blob);
        else setError('That was too short. Hold the button while you talk.');
      };
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(peak / 128);
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      rec.current = { mr, stream, ctx };
      mr.start(250);
      setRecording(true);
      timer.current = setTimeout(stop, 15_000);
    } catch {
      setError('Microphone not available. You can type or pick from the list instead.');
    }
  }

  function stop() {
    if (rec.current?.mr?.state === 'recording') rec.current.mr.stop();
    setRecording(false);
    setLevel(0);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onPointerDown={start} onPointerUp={stop} onPointerLeave={() => recording && stop()} onContextMenu={(e) => e.preventDefault()}
        disabled={disabled}
        className={clsx('relative grid size-24 touch-none select-none place-items-center rounded-full text-white transition', recording ? 'bg-bad scale-105' : 'bg-brand shadow-lift hover:bg-brand-2', disabled && 'opacity-50')}
        aria-label={label}
      >
        {recording && <span className="absolute inset-0 rounded-full bg-bad/40" style={{ transform: `scale(${1 + level * 0.9})`, transition: 'transform 80ms linear' }} />}
        {!recording && <span className="absolute inset-0 rounded-full bg-brand/40 animate-pulse-ring" />}
        <Mic className="relative size-9" />
      </button>
      <p className="text-sm font-medium text-ink-2">{recording ? releaseLabel : label}</p>
      {error && <p className="text-center text-sm text-bad">{error}</p>}
    </div>
  );
}
