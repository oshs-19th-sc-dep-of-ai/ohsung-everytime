import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./login.css";
import { API_BASE_URL } from "../config";
import { useToast } from "../contexts/ToastContext.jsx";

export function Login() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ student_id: "", password: "" });
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleLogin = async () => {
        if (!form.student_id || !form.password) {
            showToast("아이디와 비밀번호를 입력하세요.");
            return;
        }

        try {
            setLoading(true);

            // timeout 옵션을 추가하여 5초 이상 무한 대기하는 현상을 방지합니다.
            const res = await axios.post(`${API_BASE_URL}/login`, {
                student_id: form.student_id.trim(),
                password: form.password,
            }, {
                withCredentials: true,
                timeout: 5000
            });

            const data = res.data;

            localStorage.setItem("login", "true");
            localStorage.setItem("student_name", data.student_name);
            localStorage.setItem("status", data.status);
            localStorage.setItem("student_id", data.student_id);

            showToast("로그인 성공! 메인 화면으로 이동합니다.");
            navigate("/", { replace: true });

        } catch (err) {
            console.error("로그인 에러 로그:", err);

            if (err.response) {
                showToast(`로그인 실패: ${err.response.data?.message || '아이디나 비밀번호가 틀렸습니다.'}`);
            } else if (err.code === 'ECONNABORTED') {
                // timeout으로 인해 통신이 강제로 끊겼을 때 발생하는 에러입니다.
                showToast("서버 응답 시간 초과 (5초): 백엔드 서버(app.py)가 켜져 있는지 확인하십시오.");
            } else if (err.request) {
                showToast(`서버 통신 실패: 백엔드 서버가 켜져 있는지, API 주소(${API_BASE_URL})가 맞는지 확인하세요.`);
            } else {
                showToast(`오류 발생: ${err.message}`);
            }
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
                <h1 className="login-title">오성광장</h1>
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
                <button
                    className="login-button"
                    onClick={handleLogin}
                    disabled={loading}
                    style={{ marginTop: "15px" }}
                >
                    {loading ? "로그인 중..." : "로그인"}
                </button>
            </div>
        </div>
    );
}
