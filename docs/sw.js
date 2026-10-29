// Budget Sync service worker — caches the app shell and Firebase SDK so the app opens offline.
// Firestore data itself is cached by Firebase (IndexedDB), not here.
// Bump VERSION whenever you change index.html so devices pick up the new copy.
const VERSION = "budget-v25";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./demo-firebase.js",
  "./icon-192.png",
  "./icon-512.png",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Never intercept Firebase API / auth traffic — Firebase handles its own offline logic.
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("firebaseapp.com")) return;

  // Pages: network first so updates arrive, fall back to cache offline.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => { caches.open(VERSION).then((c) => c.put("./index.html", res.clone())); return res; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Everything else in the shell: cache first.
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && (url.origin === location.origin || url.hostname === "www.gstatic.com" || url.hostname === "cdnjs.cloudflare.com")) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }))
  );
});

// ---------- Push alerts (sent by the OptiPlex notifier) ----------
// Fires even when the app is closed. Payload: { title, body, tag, url }
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(data.title || "Budget Sync", {
    body: data.body || "",
    tag: data.tag || "budget",
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { url: data.url || "./#subs" }
  }));
});

// Tapping the alert focuses an open app window, or opens one on the Subs tab.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL(e.notification.data.url, self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.registration.scope)) return c.focus();
    return clients.openWindow(target);
  }));
});
