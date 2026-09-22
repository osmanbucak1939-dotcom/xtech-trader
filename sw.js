/* ══════════════════════════════════════════════════════════════════════
   TradeX — Servis Çalışanı (2026-09-19)
   ──────────────────────────────────────────────────────────────────────
   AMAÇ: Uygulamanın telefona KURULABİLİR olması. Android/Chrome bir
   servis çalışanı görmeden "uygulamayı yükle" teklifi sunmuyor; teklif
   çıkmayınca da uygulama tarayıcı sekmesinde, adres çubuğuyla açılıyor ve
   "web sitesi" gibi duruyor.

   ⚠️ BİLİNÇLİ OLARAK MUHAFAZAKÂR:
   Bir işlem terminalinde ESKİ SÜRÜMÜN önbellekten servis edilmesi kabul
   edilemez — müşteri güncellenmemiş bir uygulamayla işlem yapar, düzelttiğimiz
   hatalar geri gelir. Bu yüzden:
     • Strateji ÖNCE AĞ. Önbellek yalnızca ağ tamamen yoksa devreye girer.
     • Fiyat/veri istekleri (Firebase, köprü, WebSocket) HİÇ önbelleğe alınmaz.
     • skipWaiting + clients.claim: yeni sürüm ilk açılışta hemen devralır.
   Yani bu servis çalışanı "çevrimdışı çalışsın" diye değil, "uygulama gibi
   kurulsun" diye var. Çevrimdışı davranış sadece nazik bir yedek.
   ══════════════════════════════════════════════════════════════════════ */

const CACHE = 'tradex-shell-v1';
const SHELL = ['/', '/index.html', '/icon-192.png', '/icon-512.png', '/manifest.json'];

self.addEventListener('install', function (e) {
  self.skipWaiting();                       // yeni sürüm beklemesin
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () { /* biri yoksa kurulum çökmesin */ });
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);   // eski önbellekleri temizle
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Önbelleğe ASLA alınmayacak adresler — canlı veri ve kimlik doğrulama
function isLive(url) {
  return /firestore|firebaseio|googleapis|firebaseapp|identitytoolkit|railway|\/klines|\/quote|\/prices|wss?:/i.test(url);
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;                 // POST vb. dokunma
  if (isLive(req.url)) return;                      // canlı veri: doğrudan ağa
  if (new URL(req.url).origin !== self.location.origin) return;  // dış kaynak

  e.respondWith(
    fetch(req).then(function (res) {
      // Başarılı yanıtı sessizce tazele (çevrimdışı yedek için)
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy).catch(function () {}); });
      }
      return res;
    }).catch(function () {
      // Ağ yok → yedeğe düş
      return caches.match(req).then(function (hit) {
        return hit || caches.match('/index.html');
      });
    })
  );
});
