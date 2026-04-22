import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "./config";
import { messaging, onMessage } from "./firebase";
import { MainPage } from "./components/MainPage";
import { Header } from "./components/Header.jsx";
import { PostListPage } from "./components/PostListPage.jsx";
import { PostDetailPage } from "./components/PostDetailPage";
import MealPage from "./components/meal.jsx";
import { PostWritePage } from "./components/PostWritePage.jsx";
import { Login } from "./components/login.jsx";
import AdminPage from "./components/admin.jsx";
import { Toast } from "./components/Toast.jsx";
import { BottomNav } from "./components/BottomNav.jsx";

// ==========================================
// 로그인 여부 확인 및 라우트 가드 설정
// ==========================================
const isLoggedIn = () => {
  return localStorage.getItem("login") === "true";
};

function ProtectedRoute({ children }) {
  // AnimatePresence의 exit 애니메이션 중 localStorage가 변경되어 
  // <Navigate>가 렌더링되면서 라우팅이 꼬이는(프리징) 현상을 방지하기 위해 마운트 시점의 상태를 고정
  const [isAuth] = useState(() => isLoggedIn());

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const [isAuth] = useState(() => isLoggedIn());

  if (isAuth) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// 탭 순서를 정의하여 전환 방향(왼쪽/오른쪽) 결정
const TAB_ORDER = ['/', '/board', '/postWrite', '/meal', '/admin'];

const getTabIndex = (pathname) => {
  if (pathname === '/') return 0;
  if (pathname.startsWith('/board') || pathname.startsWith('/post/')) return 1;
  if (pathname.startsWith('/postWrite')) return 2;
  if (pathname.startsWith('/meal')) return 3;
  if (pathname.startsWith('/admin')) return 4;
  return -1;
};

const pageVariants = {
  initial: (direction) => ({
    x: direction > 0 ? 30 : direction < 0 ? -30 : 0,
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction > 0 ? -30 : direction < 0 ? 30 : 0,
    opacity: 0,
  }),
};

// 페이지 전환 애니메이션용 Wrapper 컴포넌트
function PageWrapper({ children, direction }) {
  return (
    <motion.div
      custom={direction}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const prevIndexRef = useRef(getTabIndex(location.pathname));

  const currentIdx = getTabIndex(location.pathname);
  let direction = 0;
  if (currentIdx !== -1 && prevIndexRef.current !== -1 && currentIdx !== prevIndexRef.current) {
    direction = currentIdx > prevIndexRef.current ? 1 : -1;
  }

  useEffect(() => {
    prevIndexRef.current = currentIdx;
  }, [currentIdx]);

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <PageWrapper direction={direction}><Login /></PageWrapper>
            </PublicRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <PageWrapper direction={direction}><MainPage /></PageWrapper>
            </ProtectedRoute>
          }
        />

        <Route
          path="/board"
          element={
            <ProtectedRoute>
              <PageWrapper direction={direction}><PostListPage /></PageWrapper>
            </ProtectedRoute>
          }
        />

        <Route
          path="/post/:postId"
          element={
            <ProtectedRoute>
              <PageWrapper direction={direction}><PostDetailPage /></PageWrapper>
            </ProtectedRoute>
          }
        />

        <Route
          path="/meal"
          element={
            <ProtectedRoute>
              <PageWrapper direction={direction}><MealPage /></PageWrapper>
            </ProtectedRoute>
          }
        />

        <Route
          path="/postWrite"
          element={
            <ProtectedRoute>
              <PageWrapper direction={direction}><PostWritePage /></PageWrapper>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <PageWrapper direction={direction}><AdminPage /></PageWrapper>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const [toastMessage, setToastMessage] = useState(null);

  const handleToastClose = useCallback(() => {
    setToastMessage(null);
  }, []);

  useEffect(() => {
    if (isLoggedIn()) {
      axios
        .get(`${API_BASE_URL}/check_session`, { withCredentials: true })
        .then((res) => {
          if (res.data.status === "unauthorized") {
            // 서버 세션과 로컬 스토리지 상태 불일치 (세션 만료)
            localStorage.clear();
            window.location.href = "/login";
          }
        })
        .catch((err) => {
          console.error("세션 확인 실패:", err);
        });
    }
  }, []);

  // 포그라운드 푸시 알림 수신 처리 — 인앱 토스트로 표시
  useEffect(() => {
    if (!messaging) return; // FCM 미지원 브라우저에서는 건너뜀
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[Foreground] 메시지 수신:', payload);
      const title = payload.notification?.title || payload.data?.title || '새 알림';
      const body = payload.notification?.body || payload.data?.body || '';
      const link = payload.fcmOptions?.link || payload.data?.link || null;
      setToastMessage({ title, body, link });
    });
    return () => unsubscribe();
  }, []);

  return (
    <>
      <Toast message={toastMessage} onClose={handleToastClose} />
      <BrowserRouter>
        <Header />
        <div style={{ overflowX: 'hidden', width: '100%', minHeight: '100vh', paddingBottom: '90px' }}>
          <AnimatedRoutes />
        </div>
        <BottomNav />
      </BrowserRouter>
    </>
  );
}

export default App;
