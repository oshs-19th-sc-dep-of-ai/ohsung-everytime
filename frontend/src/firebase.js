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
const messaging = getMessaging(app);

export { messaging, getToken, onMessage };
