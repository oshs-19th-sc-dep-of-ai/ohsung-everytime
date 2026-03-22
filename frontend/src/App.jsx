import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainPage } from './components/MainPage';
import { Header } from "./components/Header.jsx";
import { PostListPage } from "./components/PostListPage.jsx";
import { PostDetailPage } from './components/PostDetailPage';
import MealPage from './components/meal.jsx';
import { PostWritePage } from './components/PostWritePage.jsx';
import { Login } from './components/login.jsx';

// ==========================================
// 로그인 여부 확인 및 라우트 가드 설정
// ==========================================
const isLoggedIn = () => {
    return localStorage.getItem("login") === "true";
};

// 로그인이 필요한 페이지 접근 제어
function ProtectedRoute({ children }) {
    if (!isLoggedIn()) {
        return <Navigate to="/login" replace />;
    }
    return children;
}

// 이미 로그인한 사용자가 /login 페이지 접근 시 메인으로 돌려보냄
function PublicRoute({ children }) {
    if (isLoggedIn()) {
        return <Navigate to="/" replace />;
    }
    return children;
}
// ==========================================

function App() {
    return (
        <BrowserRouter>
            {/* 상단바 (Header 내부에서 /login 경로일 때 자동 숨김 처리됨) */}
            <Header />

            <Routes>
                {/* 1. 로그인 페이지 (비로그인 상태에서만 접근 가능) */}
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <Login />
                        </PublicRoute>
                    }
                />

                {/* 2. 보호되는 페이지 (로그인 상태에서만 접근 가능) */}
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

                {/* 3. 잘못된 경로나 정의되지 않은 주소로 접근 시 메인으로 이동 (권한에 따라 리다이렉트됨) */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;