import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Film, Upload, Download, Trash2, Pencil } from 'lucide-react';
import clsx from 'clsx';
import { Button, Card, ErrorNote } from './ui.jsx';
import { get, post, patch, del } from '../lib/api.js';

// ImageKit's free plan accepts videos up to 100 MB per file.
const MAX_BYTES = 100 * 1024 * 1024;
const IMAGEKIT_UPLOAD = 'https://upload.imagekit.io/api/v1/files/upload';

const mb = (n) => (n == null ? '' : `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`);
const secs = (n) => (n == null ? '' : `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')}`);
const when = (d) => new Date(d).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Read a local video's length before upload. Resolves null if the browser can't tell. */
function durationOf(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (d) => { URL.revokeObjectURL(url); resolve(Number.isFinite(d) ? d : null); };
    v.preload = 'metadata';
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(null);
    v.src = url;
  });
}

/** Browser → ImageKit directly (the VPS never carries the bytes), with progress. */
function uploadToImageKit(file, auth, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('fileName', file.name || `clip-${Date.now()}.mp4`);
    form.append('folder', auth.folder);
    form.append('isPrivateFile', 'true');
    form.append('useUniqueFileName', 'true');
    form.append('publicKey', auth.publicKey);
    form.append('token', auth.token);
    form.append('expire', String(auth.expire));
    form.append('signature', auth.signature);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', IMAGEKIT_UPLOAD);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.fileId) resolve(body);
      else reject(new Error(body.message || `Upload failed (${xhr.status}). Check your connection and try again.`));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.send(form);
  });
}

/** Admin Videos: demo footage locker + saved carton scan videos. Behind the admin PIN. */
export default function Videos() {
  const qc = useQueryClient();
  const input = useRef(null);
  const [tab, setTab] = useState('footage');
  const [queue, setQueue] = useState([]); // { name, progress, error }
  const [error, setError] = useState(null);
  const { data = [], isLoading, error: loadError, refetch } = useQuery({ queryKey: ['videos'], queryFn: () => get('/videos') });
  const shown = data.filter((v) => v.kind === tab);
  const count = (k) => data.filter((v) => v.kind === k).length;

  const setItem = (name, patchObj) => setQueue((q) => q.map((x) => (x.name === name ? { ...x, ...patchObj } : x)));

  const onFiles = async (files) => {
    setError(null);
    const list = [...files];
    const tooBig = list.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) setError(`${tooBig.map((f) => f.name).join(', ')}: over 100 MB. Trim it, or copy it to the laptop by cable or AirDrop.`);
    const ok = list.filter((f) => f.size <= MAX_BYTES);
    setQueue((q) => [...q, ...ok.map((f) => ({ name: f.name, progress: 0 }))]);
    setTab('footage');
    for (const f of ok) {
      try {
        const [auth, durationSec] = await Promise.all([get('/videos/upload-auth'), durationOf(f)]);
        const up = await uploadToImageKit(f, auth, (p) => setItem(f.name, { progress: p }));
        await post('/videos', { fileId: up.fileId, filePath: up.filePath, url: up.url, title: f.name.replace(/\.[^.]+$/, ''), size: up.size ?? f.size, ...(durationSec != null && { durationSec }) });
        setQueue((q) => q.filter((x) => x.name !== f.name));
        qc.invalidateQueries({ queryKey: ['videos'] });
      } catch (e) {
        setItem(f.name, { error: e.message });
      }
    }
  };

  const rename = async (v) => {
    const title = window.prompt('Name this clip', v.title ?? '');
    if (title == null) return;
    await patch(`/videos/${v._id}`, { title }).catch((e) => setError(e.message));
    qc.invalidateQueries({ queryKey: ['videos'] });
  };
  const remove = async (v) => {
    if (!window.confirm(`Delete "${v.title || 'this video'}" for good?`)) return;
    await del(`/videos/${v._id}`).catch((e) => setError(e.message));
    qc.invalidateQueries({ queryKey: ['videos'] });
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="display flex items-center gap-2 text-2xl font-semibold"><Film className="size-6 text-brand" />Videos</h2>
        <div className="flex gap-1 rounded-xl bg-paper p-1 text-sm">
          {[['footage', 'Demo footage'], ['carton', 'Carton scans']].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={clsx('rounded-lg px-3 py-1.5 font-medium', tab === k ? 'bg-card shadow-sm' : 'text-ink-3')}>{label} ({count(k)})</button>
          ))}
        </div>
      </div>

      {tab === 'footage' && (
        <div className="mt-4">
          <p className="text-sm text-ink-3">Clips you filmed for the demo video. Upload from your phone, watch or download on the laptop. Private. Kept at least 72 hours; links last 72 hours. Up to 100 MB per clip.</p>
          <input ref={input} type="file" accept="video/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
          <Button size="md" className="mt-3" onClick={() => input.current?.click()}><Upload className="size-4" />Upload clips</Button>
        </div>
      )}
      {tab === 'carton' && <p className="mt-4 text-sm text-ink-3">Every carton video received at Gate 1, saved as the H.264 copy SAM 3.1 tracked, with the result.</p>}

      {queue.length > 0 && (
        <ul className="mt-3 space-y-2">
          {queue.map((q) => (
            <li key={q.name} className="rounded-xl bg-paper p-3 text-sm">
              <div className="flex justify-between gap-2"><span className="truncate">{q.name}</span><span className="text-ink-3">{q.error ? 'Failed' : `${Math.round(q.progress * 100)}%`}</span></div>
              {q.error ? <p className="mt-1 text-bad">{q.error}</p> : <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand transition-all" style={{ width: `${q.progress * 100}%` }} /></div>}
            </li>
          ))}
        </ul>
      )}
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      {loadError && <div className="mt-3"><ErrorNote onRetry={refetch}>{loadError.message}</ErrorNote></div>}

      {isLoading ? <p className="mt-4 text-sm text-ink-3">Loading videos…</p> : shown.length === 0 ? (
        <p className="mt-4 rounded-xl bg-paper p-4 text-sm text-ink-3">{tab === 'footage' ? 'No clips yet.' : 'No carton scans saved yet. They appear here after the next carton video at Receive stock.'}</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((v) => (
            <li key={v._id} className="overflow-hidden rounded-2xl border border-line bg-paper">
              {v.url ? <video src={v.url} poster={v.poster ?? undefined} controls playsInline preload="metadata" className="aspect-video w-full bg-black" /> : <div className="grid aspect-video place-items-center bg-black text-sm text-white/70">Link unavailable</div>}
              <div className="p-3">
                <p className="truncate font-semibold">{v.title || 'Untitled clip'}</p>
                <p className="text-xs text-ink-3">{[when(v.createdAt), secs(v.durationSec), mb(v.size)].filter(Boolean).join(' · ')}</p>
                {v.summary && <p className="mt-1 text-xs"><span className="text-ok">{v.summary.accepted} accepted</span> · <span className="text-warn">{v.summary.review} review</span> · <span className="text-bad">{v.summary.rejected} rejected</span></p>}
                <div className="mt-2 flex gap-3 text-sm">
                  {v.url && <a href={v.url} download target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand"><Download className="size-4" />Download</a>}
                  {v.kind === 'footage' && <button onClick={() => rename(v)} className="inline-flex items-center gap-1 text-ink-2"><Pencil className="size-4" />Rename</button>}
                  {new Date(v.deletableAt) > new Date()
                    ? <span className="ml-auto text-xs text-ink-3">Kept until {when(v.deletableAt)}</span>
                    : <button onClick={() => remove(v)} className="ml-auto inline-flex items-center gap-1 text-bad"><Trash2 className="size-4" />Delete</button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
