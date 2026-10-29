/**
 * Service worker do MeuSuper: guarda o app para abrir rapido e recebe arquivos compartilhados de outros apps
 * (no Android, "Compartilhar > MeuSuper" com o PDF do cupom).
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { SHARE_CACHE, SHARED_KEY } from "./lib/shareKeys";

// o tipo do escopo de service worker conflita com a biblioteca DOM do projeto; so o que e usado aqui:
declare const self: {
  __WB_MANIFEST: { url: string; revision: string | null }[];
  location: Location;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: string, listener: (event: any) => void): void; // eslint-disable-line @typescript-eslint/no-explicit-any
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// leitor de PDF: baixa so quando usado e guarda (os nomes dos arquivos tem hash, entao nunca fica velho)
registerRoute(({ url }) => /\/assets\/pdf[^/]*$/.test(url.pathname), new CacheFirst({ cacheName: "pdfjs" }));
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/api\//] }));

self.addEventListener("install", () => {
  void self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Recebe o POST do "Compartilhar" do Android, guarda o arquivo e abre a tela de importar.
self.addEventListener("fetch", (event) => {
  const req: Request = event.request;
  const url = new URL(req.url);
  if (req.method !== "POST" || url.pathname !== "/share-target") return;
  event.respondWith(
    (async () => {
      try {
        const form = await req.formData();
        const file = form.get("cupom");
        const text = form.get("text");
        const cache = await caches.open(SHARE_CACHE);
        await cache.delete(SHARED_KEY);
        if (file instanceof File) {
          await cache.put(SHARED_KEY, new Response(file, { headers: { "content-type": file.type || "application/octet-stream", "x-filename": encodeURIComponent(file.name) } }));
        } else if (typeof text === "string" && text.trim()) {
          await cache.put(SHARED_KEY, new Response(text, { headers: { "content-type": "text/plain", "x-filename": "texto.txt" } }));
        }
      } catch {
        /* abre a tela mesmo assim; ela avisa que nao chegou nada */
      }
      return Response.redirect(new URL("/import?shared=1", self.location.origin).href, 303);
    })(),
  );
});
