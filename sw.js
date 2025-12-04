// 版本控制：當你更新程式碼時，請修改這裡的版本號 (例如 v1 -> v2)
// 這會強迫使用者的瀏覽器重新下載最新的檔案
const CACHE_NAME = 'webp-converter-v1';

// 定義需要被「永久快取」的檔案清單
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/assets/js/app.js',
  '/assets/js/i18n.js',
  'https://cdn.tailwindcss.com', // 外部 CDN 資源也要快取
  '/assets/images/icons/icon-192.png',
  '/assets/images/icons/icon-512.png'
];

// 1. 安裝事件 (Install)：下載並快取所有檔案
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // 強制讓新的 SW 立刻接管頁面，不用等下次重整
  self.skipWaiting();
});

// 2. 啟用事件 (Activate)：清除舊版本的快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // 讓 SW 立刻控制所有開啟的分頁
  self.clients.claim();
});

// 3. 攔截請求 (Fetch)：決定要從快取拿資料，還是去網路下載
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 策略：Cache First (有快取就用快取，沒有才上網)
      // 這能確保離線時 100% 可用，且載入速度極快
      return cachedResponse || fetch(event.request).catch(() => {
          // 如果斷網且沒有快取，通常這裡可以回傳一個自定義的「離線頁面」
          // 但因為我們是單頁應用 (SPA)，通常首頁已經被快取了，所以不用擔心
      });
    })
  );
});