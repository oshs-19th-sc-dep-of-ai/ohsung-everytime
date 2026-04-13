import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "./config";
import { MainPage } from "./components/MainPage";
import { Header } from "./components/Header.jsx";
import { PostListPage } from "./components/PostListPage.jsx";
import { PostDetailPage } from "./components/PostDetailPage";
import MealPage from "./components/meal.jsx";
import { PostWritePage } from "./components/PostWritePage.jsx";
import { Login } from "./components/login.jsx";
import AdminPage from "./components/admin.jsx";

// ==========================================
// 로그인 여부 확인 및 라우트 가드 설정
// ==========================================
const isLoggedIn = () => {
  return localStorage.getItem("login") === "true";
};

function ProtectedRoute({ children }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  if (isLoggedIn()) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
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

  return (
    <BrowserRouter>
      <Header />

      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/board"
          element={
            <ProtectedRoute>
              <PostListPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/post/:postId"
          element={
            <ProtectedRoute>
              <PostDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/meal"
          element={
            <ProtectedRoute>
              <MealPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/postWrite"
          element={
            <ProtectedRoute>
              <PostWritePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
