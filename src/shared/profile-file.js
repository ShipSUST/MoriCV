import { toPortableProfile } from './ordinary-fields.js';

const DATABASE_NAME = "mori-cv-profile-files";
const STORE_NAME = "handles";
const PROFILE_HANDLE_KEY = "profile";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, action) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function rememberProfileHandle(handle) {
  if (!handle) return;
  await withStore("readwrite", (store) => store.put(handle, PROFILE_HANDLE_KEY));
}

export async function getProfileHandle() {
  try {
    return await withStore("readonly", (store) => store.get(PROFILE_HANDLE_KEY));
  } catch (_) {
    return null;
  }
}

export async function forgetProfileHandle() {
  try {
    await withStore("readwrite", (store) => store.delete(PROFILE_HANDLE_KEY));
  } catch (_) {
    // The working copy remains usable even if IndexedDB is unavailable.
  }
}

async function ensureWritePermission(handle) {
  if (!handle?.queryPermission || !handle?.requestPermission) return false;
  const options = { mode: "readwrite" };
  if (await handle.queryPermission(options) === "granted") return true;
  return (await handle.requestPermission(options)) === "granted";
}

export async function fileRevision(file, content) {
  if (!file) return "";
  const bytes = new TextEncoder().encode(content ?? await file.text());
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${Number(file.lastModified) || 0}:${Number(file.size) || 0}:${hash}`;
}

export async function readLinkedProfile() {
  const handle = await getProfileHandle();
  if (!handle) return { linked: false, readable: false, reason: "尚未关联 JSON 资料文件" };
  try {
    if (handle.queryPermission && await handle.queryPermission({ mode: "read" }) !== "granted") {
      return { linked: true, readable: false, name: handle.name, reason: "资料文件读取授权已失效" };
    }
    const file = await handle.getFile();
    const content = await file.text();
    return {
      linked: true,
      readable: true,
      name: file.name || handle.name,
      text: content,
      revision: await fileRevision(file, content),
      lastModified: file.lastModified,
      size: file.size
    };
  } catch (error) {
    return { linked: true, readable: false, name: handle.name, reason: error?.message || "无法读取资料文件" };
  }
}

export async function writeProfileHandle(handle, profile, expectedRevision = "") {
  if (!handle) return { synced: false, reason: "尚未关联 JSON 资料文件" };
  if (!await ensureWritePermission(handle)) {
    return { synced: false, reason: "资料文件授权已失效，请重新选择文件", name: handle.name };
  }
  if (expectedRevision) {
    const current = await handle.getFile();
    if (await fileRevision(current) !== expectedRevision) {
      return { synced: false, conflict: true, reason: "关联 JSON 已被其它程序修改，请重新加载后再保存", name: handle.name };
    }
  }
  const writable = await handle.createWritable();
  await writable.write(`${JSON.stringify(toPortableProfile(profile), null, 2)}\n`);
  await writable.close();
  const written = await handle.getFile();
  return { synced: true, name: handle.name, revision: await fileRevision(written) };
}

export async function saveToLinkedProfile(profile, expectedRevision = "") {
  return writeProfileHandle(await getProfileHandle(), profile, expectedRevision);
}

export async function chooseProfileToOpen() {
  if (typeof window.showOpenFilePicker !== "function") return null;
  const [handle] = await window.showOpenFilePicker({
    id: "mori-cv-profile",
    multiple: false,
    types: [{ description: "Mori CV JSON 资料", accept: { "application/json": [".json"] } }]
  });
  if (!handle) return null;
  return { handle, file: await handle.getFile() };
}

export async function chooseProfileToSave(profile) {
  if (typeof window.showSaveFilePicker !== "function") return null;
  const handle = await window.showSaveFilePicker({
    id: "mori-cv-profile",
    suggestedName: "mori-cv-profile.json",
    types: [{ description: "Mori CV JSON 资料", accept: { "application/json": [".json"] } }]
  });
  if (!handle) return null;
  const result = await writeProfileHandle(handle, profile);
  if (result.synced) await rememberProfileHandle(handle);
  return result;
}

export async function linkedProfileName() {
  return (await getProfileHandle())?.name || "";
}
