import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useState } from "react";
import "./login.css";
import MealPage from "./meal";

import { API_BASE_URL } from "../config";

const isLoggedIn = () => {
  return localStorage.getItem("login") === "true";
};

//로그인 컴포넌트
export function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ student_id: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    if (!form.student_id || !form.password) {
      setError("아이디와 비밀번호를 입력하세요.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          student_id: form.student_id.trim(),
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "잘못된 아이디 또는 비밀번호입니다.");
        return;
      }

      localStorage.setItem("login", "true");
      localStorage.setItem("student_name", data.student_name);
      localStorage.setItem("status", data.status);
      localStorage.setItem("student_id", data.student_id);

      navigate("/");
    } catch {
      setError("서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">오성에타</h1>
        <input
          className="login-input"
          name="student_id"
          placeholder="학번"
          value={form.student_id}
          onChange={handleChange}
        />
        <input
          className="login-input"
          type="password"
          name="password"
          placeholder="비밀번호"
          value={form.password}
          onChange={handleChange}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        {error && (
          <p className="login-error" style={{ color: "red" }}>
            {error}
          </p>
        )}
        <button
          className="login-button"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </div>
    </div>
  );
}

//메인 페이지 (임시)
function Main() {
  const navigate = useNavigate();
  const name = localStorage.getItem("student_name");
  const status = localStorage.getItem("status");

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      localStorage.clear();
      navigate("/login");
    }
  };

  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>메인 페이지</h1>
      <div
        style={{
          margin: "20px auto",
          padding: "20px",
          maxWidth: "400px",
          border: "1px solid #ddd",
        }}
      >
        <p>
          <strong>{name}</strong> 님 환영합니다
        </p>
        {status === "admin" ? (
          <p style={{ color: "blue", fontWeight: "bold" }}>🛡 관리자 계정</p>
        ) : (
          <p style={{ color: "green" }}>🎓 학생 계정</p>
        )}
      </div>
      <button onClick={() => navigate("/meal")} style={{ marginRight: "10px" }}>
        급식 보기
      </button>
      <button onClick={logout}>로그아웃</button>
    </div>
  );
}

//라우트 가드
function ProtectedRoute({ children }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  if (isLoggedIn()) {
    return <Navigate to="/main" replace />;
  }
  return children;
}

//라우터 설정
export default function App() {
  return (
    <BrowserRouter>
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
          path="/main"
          element={
            <ProtectedRoute>
              <Main />
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
        <Route path="/" element={<Navigate to="/main" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
