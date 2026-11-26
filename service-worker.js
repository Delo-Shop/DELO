// ============================================================
// === SERVICE WORKER — DELO ===
// ============================================================
// Версия кэша. МЕНЯЙТЕ при каждом обновлении приложения!
// Пример: 'delo-v1.0.1', 'delo-v1.0.2' и т.д.
const CACHE_VERSION = 'delo-v1.0.3';
const CACHE_NAME = CACHE_VERSION;

// Файлы, которые кэшируются сразу при установке
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// ============================================================
// УСТАНОВКА: кэшируем файлы
// ============================================================
self.addEventListener('install', event => {
  console.log('[SW] Установка', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Кэширую файлы:', PRECACHE_URLS.length);
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Ошибка кэширования:', err))
  );
});

// ============================================================
// АКТИВАЦИЯ: удаляем старые кэши
// ============================================================
self.addEventListener('activate', event => {
  console.log('[SW] Активация', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Удаляю старый кэш:', key);
              return caches.delete(key);
            })
      ))
      .then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH: стратегия кэширования
// ============================================================
self.addEventListener('fetch', event => {
  const req = event.request;

  // Только GET-запросы
  if (req.method !== 'GET') return;

  // Только свой домен (не трогаем внешние запросы)
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Навигационные запросы (открытие страницы) — сеть, при офлайне — кэш
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Обновляем кэш свежей версией
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Остальное — кэш-первый, при промахе — сеть
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(res => {
        // Кэшируем только успешные ответы
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        // Если нет ни в кэше, ни в сети — возвращаем заглушку
        return new Response('Офлайн-режим: файл недоступен', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});

// ============================================================
// СООБЩЕНИЯ ОТ СТРАНИЦЫ: принудительное обновление
// ============================================================
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    console.log('[SW] Получено SKIP_WAITING');
    self.skipWaiting();
  }
});
