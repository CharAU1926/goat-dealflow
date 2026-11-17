// Khora Flow service worker (PRD v1.6 §7, SEC-2).
//
// Caching policy — deliberately narrow:
//   * Precached: the offline fallback page and app icons.
//   * Cached on use: hashed static build assets (/_next/static) and icons. These contain no user data.
//   * Cached on use for offline fallback: ONLY the public pages listed in PUBLIC_PAGES.
//   * NEVER cached: any other page, RSC/flight payloads, Server Actions, /auth, /api, cross-origin
//     requests (Supabase), non-GET requests, or any response marked no-store/private or setting cookies.
// Authenticated screens, session tokens and pitch deck data therefore always come from the network.
const VERSION = "v1";
const STATIC_CACHE = `khora-static-${VERSION}`;
const PAGE_CACHE = `khora-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

const PUBLIC_PAGES = [/^\/$/, /^\/legal(\/|$)/];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("khora-") && key !== STATIC_CACHE && key !== PAGE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Lets the app drop cached pages on sign-out: postMessage("clear-caches").
self.addEventListener("message", (event) => {
  if (event.data === "clear-caches") event.waitUntil(caches.delete(PAGE_CACHE));
});

function isCacheableResponse(response) {
  if (!response || response.status !== 200 || response.type !== "basic") return false;
  const cacheControl = (response.headers.get("Cache-Control") || "").toLowerCase();
  if (cacheControl.includes("no-store") || cacheControl.includes("private")) return false;
  if (response.headers.has("Set-Cookie")) return false;
  return true;
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  // RSC / prefetch / Server Action payloads are never touched.
  if (url.searchParams.has("_rsc") || request.headers.has("RSC") || request.headers.has("Next-Action") || request.headers.has("Next-Router-Prefetch")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (isCacheableResponse(response)) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});

async function handleNavigation(request, url) {
  const isPublic = PUBLIC_PAGES.some((pattern) => pattern.test(url.pathname));
  try {
    const response = await fetch(request);
    // Only public pages are stored; redirected responses (e.g. to /login) never are.
    if (isPublic && !response.redirected && isCacheableResponse(response)) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    if (isPublic) {
      const cached = await (await caches.open(PAGE_CACHE)).match(request);
      if (cached) return cached;
    }
    const offline = await (await caches.open(STATIC_CACHE)).match(OFFLINE_URL);
    return offline || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}
