// FCM 백그라운드 메시지 처리용 Service Worker
// 이 파일은 반드시 public/ 폴더에 있어야 합니다

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

    const { title, body } = payload.notification ?? {};
    self.registration.showNotification(title ?? '새 알림', {
        body: body ?? '',
        icon: '/vite.svg',
        badge: '/vite.svg',
    });
});
