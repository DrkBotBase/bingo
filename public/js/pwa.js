let deferredPrompt;
let installButton = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/js/service-worker.js');
      
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateNotification();
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error registrando Service Worker:', error);
    }
  });
}

function showUpdateNotification() {
  const updateDiv = document.createElement('div');
  updateDiv.className = 'update-notification';
  updateDiv.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      cursor: pointer;
      animation: slideIn 0.3s;
    ">
      🔄 Nueva versión disponible
      <button onclick="location.reload()" style="
        background: white;
        color: #10b981;
        border: none;
        padding: 4px 12px;
        border-radius: 5px;
        margin-left: 10px;
        cursor: pointer;
        font-weight: bold;
      ">Actualizar</button>
    </div>
  `;
  document.body.appendChild(updateDiv);
  
  setTimeout(() => {
    updateDiv.remove();
  }, 10000);
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  if (!installButton) {
    createInstallButton();
  }
});

function createInstallButton() {
  installButton = document.createElement('button');
  installButton.id = 'install-pwa';
  installButton.innerHTML = 'Instalar App';
  installButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: #5cd766;
    color: white;
    border: none;
    border-radius: 50px;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 9999;
    transition: transform 0.3s;
  `;
  
  installButton.addEventListener('click', installPWA);
  installButton.addEventListener('mouseover', () => {
    installButton.style.transform = 'scale(1.05)';
  });
  installButton.addEventListener('mouseout', () => {
    installButton.style.transform = 'scale(1)';
  });
  
  document.body.appendChild(installButton);
  
  setTimeout(() => {
    installButton.style.opacity = '1';
  }, 100);
}

async function installPWA() {
  if (!deferredPrompt) {
    alert('Esta app ya está instalada o no es instalable en este dispositivo');
    return;
  }
  
  deferredPrompt.prompt();
  
  const { outcome } = await deferredPrompt.userChoice;
  
  deferredPrompt = null;
  
  if (installButton) {
    installButton.remove();
    installButton = null;
  }
}

window.addEventListener('appinstalled', (e) => {
  if (installButton) {
    installButton.remove();
    installButton = null;
  }
  
  if (typeof gtag !== 'undefined') {
    gtag('event', 'pwa_installed');
  }
});

window.addEventListener('online', () => {
  showConnectionStatus('online', '🟢 Conexión restaurada');
  syncPendingData();
});

window.addEventListener('offline', () => {
  showConnectionStatus('offline', '🔴 Sin conexión - Modo offline');
});

function showConnectionStatus(type, message) {
  const statusDiv = document.createElement('div');
  statusDiv.className = `connection-status ${type}`;
  statusDiv.textContent = message;
  statusDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'online' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: bold;
    z-index: 10000;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    animation: slideDown 0.3s;
  `;
  
  document.body.appendChild(statusDiv);
  
  setTimeout(() => {
    statusDiv.remove();
  }, 3000);
}

function syncPendingData() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.sync.register('sync-marcados').catch(err => {
        console.log('Background sync no soportado:', err);
      });
    });
  }
}

function isRunningAsPWA() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true;
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  #install-pwa {
    animation: fadeIn 0.5s;
  }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
  if (isRunningAsPWA()) {
    document.body.classList.add('pwa-mode');
  }
});

async function cacheGameData() {
  if ('caches' in window) {
    try {
      const cache = await caches.open('game-data');
      
      const response = await fetch('/api/juego/estado');
      const data = await response.json();
      
      await cache.put('/api/juego/estado', new Response(JSON.stringify(data)));
    } catch (error) {
      console.log('❌ Error cacheando datos:', error);
    }
  }
}

setInterval(cacheGameData, 300000);