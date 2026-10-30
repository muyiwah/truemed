// Local check of ffmpeg paths: synth a webm, convert to MP4 + keyframes; synth audio → PCM.
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { readFile, rm } from 'node:fs/promises';
import { prepareVideo, toPcm24k, qualityGate, normalizeImage } from '../src/services/media.js';
import { makeDemoLabel } from '../src/services/barcode.js';
ffmpeg.setFfmpegPath(ffmpegPath);
const mk = (args, out) => new Promise((res, rej) => ffmpeg().input(args.input).inputOptions(args.inOpts).outputOptions(args.outOpts).save(out).on('end', res).on('error', rej));
await mk({ input: 'testsrc=size=640x360:rate=25', inOpts: ['-f', 'lavfi', '-t', '3'], outOpts: ['-c:v', 'libvpx-vp9', '-b:v', '300k'] }, '/tmp/truemed-t.webm');
const v = await prepareVideo(await readFile('/tmp/truemed-t.webm'));
console.log('video', { bytes: v.mp4.length, w: v.width, h: v.height, duration: v.duration, frames: v.frames, keyframes: v.keyframes.map(k => k.index) });
await mk({ input: 'sine=frequency=440:duration=2', inOpts: ['-f', 'lavfi'], outOpts: ['-c:a', 'libopus'] }, '/tmp/truemed-a.webm');
const pcm = await toPcm24k(await readFile('/tmp/truemed-a.webm'));
console.log('pcm bytes', pcm.length, 'seconds', pcm.length / 48000);
const label = await makeDemoLabel({ gtin: '00000000000178', expiryYYMMDD: '280531', batch: 'DQ2601', serial: 'X1' });
const n = await normalizeImage(label);
console.log('quality', await qualityGate(n.buffer));
await rm('/tmp/truemed-t.webm'); await rm('/tmp/truemed-a.webm');
