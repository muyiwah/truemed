/**
 * ImageKit storage (D32). Mongo keeps `{ fileId, filePath, url, isPrivate }`.
 *
 * Uploads happen after analysis has the bytes in memory, so storage never sits
 * on the scan's critical path; callers fire `store()` and await it at the end.
 * User media is private and only reachable through signed URLs that expire.
 */
import ImageKit from 'imagekit';
import { config, imagekitEnabled } from '../config.js';
import { log } from '../lib/log.js';

let ik = null;
const client = () => {
  if (!imagekitEnabled) return null;
  ik ??= new ImageKit({ publicKey: config.IMAGEKIT_PUBLIC_KEY, privateKey: config.IMAGEKIT_PRIVATE_KEY, urlEndpoint: config.IMAGEKIT_URL_ENDPOINT });
  return ik;
};

/**
 * @param {Buffer} buffer
 * @param {{ folder: string, name: string, isPrivate?: boolean, kind?: string }} opts
 * @returns {Promise<{fileId:string,filePath:string,url:string,isPrivate:boolean,kind?:string}|null>}
 */
export async function store(buffer, { folder, name, isPrivate = true, kind }) {
  const c = client();
  if (!c) return null;
  try {
    const r = await c.upload({
      file: buffer,
      fileName: name,
      folder: `${config.IMAGEKIT_FOLDER}/${folder}`,
      isPrivateFile: isPrivate,
      useUniqueFileName: true,
    });
    return { fileId: r.fileId, filePath: r.filePath, url: r.url, isPrivate, kind };
  } catch (err) {
    log.warn({ err: err?.message }, 'imagekit upload failed');
    return null;
  }
}

/** A URL the browser can load. Private files get a signed URL valid for `expireSeconds`. */
export function viewUrl(m, { expireSeconds = 3600, transformation } = {}) {
  if (!m) return null;
  const c = client();
  if (!c) return m.url ?? null;
  return c.url({ path: m.filePath, signed: Boolean(m.isPrivate), expireSeconds: m.isPrivate ? expireSeconds : undefined, transformation });
}

export const storageEnabled = () => imagekitEnabled;
