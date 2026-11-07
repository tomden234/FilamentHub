// Hub: Kamerafotos am Druckende und für Push-Meldungen (1.231 aus hub.ts herausgelöst).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPrinterFrame } from '../printerCameraStream.js';
import { haCameraJpeg } from './ha.js';
import { publishImage } from './esphome.js';
import { writeFileAtomic } from '../jsonConfig.js';
import { getHubConfig, photoDir, port } from './core.js';

const photoFile = (id: string) => path.join(photoDir(), crypto.createHash('sha1').update(id).digest('hex').slice(0, 24) + '.jpg');

export function readPhoto(id: string): Buffer | null {
  try {
    return fs.readFileSync(photoFile(id));
  } catch {
    return null;
  }
}

export let lastJpeg: Buffer | null = null;

/** Aktuelles Kamerabild für eine Push-Meldung (/local/… über Home Assistant) */
export async function snapshotForPush(): Promise<string | undefined> {
  let jpeg: Buffer | null = null;
  const lan = port?.getLanAccess();
  if (lan) {
    try {
      const r = await getPrinterFrame(lan.ip, lan.code);
      if (r.ok) jpeg = r.jpeg;
    } catch {
      /* dann HA */
    }
  }
  if (!jpeg && getHubConfig().cameraEntity) jpeg = await haCameraJpeg(getHubConfig().cameraEntity);
  if (!jpeg) return undefined;
  return publishImage(jpeg, `${crypto.randomBytes(8).toString('hex')}.jpg`) || undefined;
}

export async function takePhoto(id: string): Promise<boolean> {
  let jpeg: Buffer | null = null;
  const lan = port?.getLanAccess();
  if (lan) {
    try {
      const r = await getPrinterFrame(lan.ip, lan.code);
      if (r.ok) jpeg = r.jpeg;
    } catch {
      /* dann Home Assistant */
    }
  }
  const cam = getHubConfig().cameraEntity;
  if (!jpeg && cam) jpeg = await haCameraJpeg(cam);
  if (!jpeg) return false;
  lastJpeg = jpeg;
  try {
    fs.mkdirSync(photoDir(), { recursive: true });
    writeFileAtomic(photoFile(id), jpeg);
    // Höchstens 200 Fotos behalten
    const files = fs.readdirSync(photoDir()).map(f => ({ f, t: fs.statSync(path.join(photoDir(), f)).mtimeMs })).sort((a, b) => b.t - a.t);
    for (const x of files.slice(200)) fs.unlinkSync(path.join(photoDir(), x.f));
    return true;
  } catch {
    return false;
  }
}
