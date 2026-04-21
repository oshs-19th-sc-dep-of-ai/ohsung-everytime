import { precacheAndRoute } from 'workbox-precaching';

// FCM 백그라운드 메시지 처리용 Service Worker
// 이 파일은 Vite PWA의 injectManifest에 의해 번들링되어 최종적으로 dist/ 에 배치됩니다.

precacheAndRoute(self.__WB_MANIFEST);

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDCsCYFbahGcbZMPG2GSkWDOmof2lroWS8",
    authDomain: "aewfg-notification-test.firebaseapp.com",
    projectId: "aewfg-notification-test",
    storageBucket: "aewfg-notification-test.firebasestorage.app",
    messagingSenderId: "390098786172",
    appId: "1:390098786172:web:9c7cb76784e82c63e8b6f9",
});

const messaging = firebase.messaging();

// 백그라운드(앱이 닫혀있을 때) 메시지 수신
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 백그라운드 메시지 수신:', payload);

    // FCM SDK가 notification 페이로드가 있으면 자동으로 알림을 표시합니다.
    // 여기서 showNotification을 또 호출하면 알림이 두 번 울리게 됩니다 (중복 알림 발생).
    // 따라서 notification 객체가 없을 때(data 페이로드만 있을 때)만 수동으로 알림을 띄웁니다.
    if (!payload.notification) {
        const title = payload.data?.title ?? '새 알림';
        const body = payload.data?.body ?? '';
        self.registration.showNotification(title, {
            body: body,
            icon: '/vite.svg',
            badge: '/vite.svg',
        });
    }
});
