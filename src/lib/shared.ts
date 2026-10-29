import { SHARE_CACHE, SHARED_KEY } from "./shareKeys";

/** Pega (e apaga) o arquivo que o service worker guardou quando o cupom foi compartilhado para o app. */
export async function takeSharedFile(): Promise<File | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(SHARE_CACHE);
  const res = await cache.match(SHARED_KEY);
  if (!res) return null;
  const blob = await res.blob();
  await cache.delete(SHARED_KEY);
  const name = decodeURIComponent(res.headers.get("x-filename") ?? "cupom");
  return new File([blob], name, { type: res.headers.get("content-type") ?? blob.type });
}
