import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// FCM 백그라운드 메시지 처리용 Service Worker 및 오프라인 캐싱
// 이 파일은 Vite PWA의 injectManifest에 의해 번들링되어 최종적으로 dist/ 에 배치됩니다.

precacheAndRoute(self.__WB_MANIFEST);

// ── 1) API 응답 런타임 캐싱 (GET 요청만) ──
// 게시글 목록, 상세, 댓글, 급식 → NetworkFirst (온라인이면 새 데이터, 오프라인이면 캐시)
registerRoute(
  ({ url }) => url.pathname.startsWith('/posts') || url.pathname.startsWith('/meal'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 }), // 24h
    ],
  }),
  'GET'
);

// ── 2) 정적 에셋(이미지, 폰트) → CacheFirst ──
registerRoute(
  ({ request }) => request.destination === 'image' || request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30일
    ],
  })
);

// ── 3) CDN (Firebase SDK 등) → StaleWhileRevalidate ──
registerRoute(
  ({ url }) => url.origin === 'https://www.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'cdn-cache' })
);

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
            icon: '/icon_notification.svg',
            badge: '/icon_notification.svg',
            data: {
                link: payload.fcmOptions?.link || payload.data?.link || '/meal'
            }
        });
    }
});

// 알림 클릭 시 이동 처리
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    // 링크 정보 추출 (FCM fcm_options.link, data.link 등)
    let targetUrl = '/meal';
    if (event.notification.data && event.notification.data.link) {
        targetUrl = event.notification.data.link;
    } else if (event.notification.data && event.notification.data.FCM_MSG && event.notification.data.FCM_MSG.fcmOptions && event.notification.data.FCM_MSG.fcmOptions.link) {
        targetUrl = event.notification.data.FCM_MSG.fcmOptions.link;
    }
    
    // 이미 열려있는 창이 있는지 확인
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // targetUrl에서 pathname 추출 (전체 URL이면 파싱, 상대 경로면 그대로 사용)
            let targetPath;
            try {
                targetPath = new URL(targetUrl).pathname;
            } catch (e) {
                targetPath = targetUrl; // 상대 경로
            }

            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                const clientPath = new URL(client.url).pathname;
                if (clientPath === targetPath && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
