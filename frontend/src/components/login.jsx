import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";
import { API_BASE_URL } from "../config";

// 로그인 컴포넌트
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

            // 로그인 성공 시 메인 화면('/')으로 강제 이동
            navigate("/", { replace: true });
        } catch {
            setError("서버와 연결할 수 없습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleLogin();
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
                    onKeyDown={handleKeyDown}
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