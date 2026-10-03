/* Service worker: only here to receive push notifications (a new round has dropped) and open the
   site when one is tapped. It caches nothing, so the page always loads fresh from Netlify. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  const title = d.title || "New round";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "A new round just dropped. Tap to play.",
    icon: d.icon || "icons/babies-180.png",
    badge: d.icon || "icons/babies-180.png",
    tag: d.tag || "drop",
    renotify: true,
    data: { url: d.url || self.registration.scope }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const open = list.find(c => "focus" in c);
    if (open) { open.navigate && open.navigate(url); return open.focus(); }
    return self.clients.openWindow(url);
  }));
});
