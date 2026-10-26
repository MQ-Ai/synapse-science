const CACHE_NAME = "sage-v1";
const STATIC_ASSETS = [
  "/",
  "/psle",
  "/manifest.json",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Network-first for API routes; cache-first for static assets
  if (event.request.url.includes("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Web Push ─────────────────────────────────────────────────────────────────
// Payload shape (set by /api/push/send): { title, body, url, tag }

self.addEventListener("push", (event) => {
  let data = { title: "Sage", body: "You have a new update.", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Malformed payload: show the default message instead of failing silently.
  }

  event.waitUntil(
    self.registration.showNotification(String(data.title), {
      body: String(data.body || ""),
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: data.tag || undefined,
      data: { url: typeof data.url === "string" ? data.url : "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Only open same-origin URLs; anything else goes to the home page.
  const requested = (event.notification.data && event.notification.data.url) || "/";
  let target = new URL("/", self.location.origin).href;
  try {
    const resolved = new URL(requested, self.location.origin);
    if (resolved.origin === self.location.origin) target = resolved.href;
  } catch {
    // Keep the default target.
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
