// Service worker — «помощник» в фоне, который сохраняет файлы приложения,
// чтобы трекер открывался даже без интернета.
// Если поменял файлы и хочешь, чтобы телефон точно их подхватил — увеличь версию.
const CACHE = 'ml-tracker-v2';

const FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/core.js',
  './js/habits.js',
  './js/tasks.js',
  './js/clients.js',
  './js/money.js',
  './js/level.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Установка: кладём файлы в кэш
self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); }));
  self.skipWaiting();
});

// Активация: удаляем старые версии кэша
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE; })
        .map(function (key) { return caches.delete(key); }));
    })
  );
  self.clients.claim();
});

// Запросы: сначала пробуем интернет (свежая версия), нет сети — берём из кэша
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        const copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        return response;
      })
      .catch(function () {
        return caches.match(event.request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});
