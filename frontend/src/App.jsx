import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
