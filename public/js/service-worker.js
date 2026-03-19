const CACHE_NAME = 'bingo-pwa-v1';
const DYNAMIC_CACHE = 'bingo-dynamic-v1';
const API_CACHE = 'bingo-api-v1';

// Archivos para cachear durante la instalación
const urlsToCache = [
  '/',
  '/manifest.json',
  '/js/service-worker.js',
  '/j-192.png',
  '/j-512.png'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('🔄 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache abierto, agregando archivos...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Archivos cacheados correctamente');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Error cacheando archivos:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker: Activando...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Eliminar caches antiguos
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE && cacheName !== API_CACHE) {
            console.log('🗑️ Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activado y controlando clients');
      return self.clients.claim();
    })
  );
});

// Estrategia de cache: Stale-While-Revalidate para la mayoría de recursos
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Estrategia para archivos estáticos (CSS, JS, imágenes)
  if (event.request.url.includes('/js/')) {
    
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        // Devolver cacheado y actualizar en segundo plano
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
            return networkResponse;
          })
          .catch(error => {
            console.log('Error fetching, usando cache:', error);
            return cachedResponse;
          });
        
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
  
  // Estrategia para API calls (Network First)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cachear respuestas exitosas de API
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback a cache si hay error de red
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Si no hay cache, devolver offline page para navegación
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            return new Response('Sin conexión', { status: 503 });
          });
        })
    );
    return;
  }
  
  // Estrategia para navegación (Network First con offline fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('/offline.html');
          });
        })
    );
    return;
  }
  
  // Default: Network First
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cachear respuestas exitosas
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Sincronización en segundo plano para marcados pendientes
self.addEventListener('sync', event => {
  console.log('🔄 Sync event:', event.tag);
  
  if (event.tag === 'sync-marcados') {
    event.waitUntil(syncMarcadosPendientes());
  }
});

// Push notifications (opcional)
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: '/j-192.png',
    badge: '/j-192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver juego',
        icon: '/j-192.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/j-192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Bingo Amigos', options)
  );
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Función para sincronizar marcados pendientes
async function syncMarcadosPendientes() {
  try {
    const cache = await caches.open('pending-marcados');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
          console.log('✅ Marcado sincronizado:', request.url);
        }
      } catch (error) {
        console.log('❌ Error sincronizando marcado:', error);
      }
    }
  } catch (error) {
    console.log('Error en syncMarcadosPendientes:', error);
  }
}