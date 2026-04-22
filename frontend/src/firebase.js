import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: "AIzaSyDCsCYFbahGcbZMPG2GSkWDOmof2lroWS8",
    authDomain: "aewfg-notification-test.firebaseapp.com",
    projectId: "aewfg-notification-test",
    storageBucket: "aewfg-notification-test.firebasestorage.app",
    messagingSenderId: "390098786172",
    appId: "1:390098786172:web:9c7cb76784e82c63e8b6f9",
};

const app = initializeApp(firebaseConfig);

// FCM은 서비스 워커를 지원하는 브라우저에서만 동작합니다.
// 미지원 브라우저(구버전 iOS Safari 등)에서 getMessaging()이 에러를 던지면
// 앱 전체가 크래시(흰 화면)되므로 안전하게 감싸줍니다.
let messaging = null;
try {
    if ('serviceWorker' in navigator) {
        messaging = getMessaging(app);
    }
} catch (e) {
    console.warn('[Firebase] 이 브라우저에서 FCM을 사용할 수 없습니다:', e.message);
}

export { messaging, getToken, onMessage };
