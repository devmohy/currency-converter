//service worker 
var staticCacheName = 'currency-static-v1';

var allCaches = [
  staticCacheName
];

var staticFilesToCache = [
  '/',
  '/index.html',
  '/src/images/',
  '/src/js/jquery.min.js',
  '/src/js/app.js',
  '/src/js/localforage.js',
  '/src/css/materialize.min.css',
  '/src/js/materialize.min.js',
  '/favicon.ico',
];
//
self.addEventListener('install', function(e) {
  console.log('[ServiceWorker] Install');
  e.waitUntil(
    caches.open(staticCacheName).then(function(cache) {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(staticFilesToCache);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          console.log('[ServiceWorker] Removing old cache', cacheName);
          return cacheName.startsWith('currency-') &&
                 !allCaches.includes(cacheName);
        }).map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
});


self.addEventListener('fetch', function(event) {
  const responseUrl = new URL(event.request.url);

  if(responseUrl.origin != location.origin){
    console.log(responseUrl);
    if(responseUrl.pathname.endsWith('currencies')){
      const storageUrl = event.request.url.slice(8).split('/')[3]; //currencies?
      event.respondWith(
        caches.open('currencyList').then(function(cache) {
          return cache.match(storageUrl).then(function (response) {
            return response || fetch(event.request).then(function(response) {
              cache.put(storageUrl, response.clone());
              return response;
            });
          });
        })

      );
      return
    }
  }

  event.respondWith(
    caches.match(event.request).then(function(response) {
      if (response) return response;
      return fetch(event.request).then(function(response) {
        // console.log('[ServiceWorker] Response', response);
        return response
      });
    })
  );

});

self.addEventListener('message', function(event) {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});