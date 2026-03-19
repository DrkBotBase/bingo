// pwa.js - Manejo de la instalación y eventos PWA

let deferredPrompt;
let installButton = null;

// Detectar cuando la app es instalable
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('📱 Evento beforeinstallprompt disparado');
  e.preventDefault();
  deferredPrompt = e;
  
  // Crear botón de instalación si no existe
  if (!installButton) {
    createInstallButton();
  }
});

// Crear botón de instalación flotante
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
  
  // Mostrar con animación
  setTimeout(() => {
    installButton.style.opacity = '1';
  }, 100);
}

// Función para instalar la PWA
async function installPWA() {
  if (!deferredPrompt) {
    alert('Esta app ya está instalada o no es instalable en este dispositivo');
    return;
  }
  
  deferredPrompt.prompt();
  
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`📱 Resultado de instalación: ${outcome}`);
  
  deferredPrompt = null;
  
  if (installButton) {
    installButton.remove();
    installButton = null;
  }
}

// Detectar cuando la app fue instalada
window.addEventListener('appinstalled', (e) => {
  console.log('✅ PWA instalada correctamente');
  
  if (installButton) {
    installButton.remove();
    installButton = null;
  }
  
  // Enviar evento de analytics si existe
  if (typeof gtag !== 'undefined') {
    gtag('event', 'pwa_installed');
  }
});

// Detectar modo offline/online
window.addEventListener('online', () => {
  console.log('📶 Conexión restaurada');
  showConnectionStatus('online', '🟢 Conexión restaurada');
  syncPendingData();
});

window.addEventListener('offline', () => {
  console.log('📶 Sin conexión');
  showConnectionStatus('offline', '🔴 Sin conexión - Modo offline');
});

// Mostrar estado de conexión
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

// Sincronizar datos pendientes
function syncPendingData() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.sync.register('sync-marcados');
    });
  }
}

// Verificar si la app se ejecuta como PWA
function isRunningAsPWA() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true;
}

// Agregar estilos para animaciones
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
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  #install-pwa {
    animation: fadeIn 0.5s;
  }
`;
document.head.appendChild(style);

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  console.log('📱 PWA inicializada');
  
  if (isRunningAsPWA()) {
    console.log('📱 Ejecutando como PWA instalada');
    document.body.classList.add('pwa-mode');
  }
});

// Cachear datos del juego para offline
async function cacheGameData() {
  if ('caches' in window) {
    try {
      const cache = await caches.open('game-data');
      
      // Cachear datos actuales del juego
      const response = await fetch('/api/juego/estado');
      const data = await response.json();
      
      await cache.put('/api/juego/estado', new Response(JSON.stringify(data)));
      console.log('✅ Datos del juego cacheados para offline');
      
    } catch (error) {
      console.log('❌ Error cacheando datos:', error);
    }
  }
}

// Ejecutar cada 5 minutos
setInterval(cacheGameData, 300000);