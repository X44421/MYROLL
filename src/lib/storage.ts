import { openDB, type IDBPDatabase } from 'idb';
import type { Preset, PresetPack } from './data/filmTypes';

const DB_NAME = 'myroll-photos';
const STORE_NAME = 'photos';
const LIBRARY_STORE_NAME = 'library';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 2, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains(LIBRARY_STORE_NAME)) {
          db.createObjectStore(LIBRARY_STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export interface PhotoRecord {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  name: string;
}

export interface PresetLibrary {
  presets: Record<string, Preset>;
  packs: PresetPack[];
}

export async function savePresetLibrary(library: PresetLibrary): Promise<void> {
  const db = await getDB();
  await db.put(LIBRARY_STORE_NAME, { id: 'primary', ...library });
}

export async function getPresetLibrary(): Promise<PresetLibrary | undefined> {
  const db = await getDB();
  const record = await db.get(LIBRARY_STORE_NAME, 'primary');
  return record ? { presets: record.presets, packs: record.packs } as PresetLibrary : undefined;
}

export async function savePhoto(id: string, blob: Blob, width: number, height: number, name: string): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, { id, blob, width, height, name });
}

export async function getPhoto(id: string): Promise<PhotoRecord | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

export async function deletePhotoRecord(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all([
    tx.store.delete(id),
    tx.store.delete(`processed_${id}`),
  ]);
  await tx.done;
}

export async function getAllPhotos(): Promise<PhotoRecord[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function saveProcessedBlob(photoId: string, blob: Blob): Promise<string> {
  const db = await getDB();
  await db.put(STORE_NAME, { id: `processed_${photoId}`, blob, width: 0, height: 0, name: '' });
  return URL.createObjectURL(blob);
}

export async function getProcessedBlobUrl(photoId: string): Promise<string | null> {
  const db = await getDB();
  const rec = await db.get(STORE_NAME, `processed_${photoId}`);
  return rec ? URL.createObjectURL(rec.blob) : null;
}
