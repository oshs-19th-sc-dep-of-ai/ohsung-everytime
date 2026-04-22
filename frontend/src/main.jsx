import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'

// PWA 설치 프롬프트 이벤트를 저장하여 커스텀 버튼에서 사용
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
  // 커스텀 이벤트로 컴포넌트에 알림
  window.dispatchEvent(new Event('pwaInstallReady'));
});

// 설치 완료 시 이벤트 정리
window.addEventListener('appinstalled', () => {
  window.deferredPrompt = null;
  window.dispatchEvent(new Event('pwaInstalled'));
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
)
