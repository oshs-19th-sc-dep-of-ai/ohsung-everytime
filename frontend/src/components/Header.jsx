import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Header.css';

export function Header() {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        alert("로그아웃 되었습니다.");
        localStorage.clear();
        // replace: true 옵션을 주어 이전 페이지 기록을 지우고 로그인 화면으로 완벽히 강제 이동
        navigate("/login", { replace: true });
    };

    // 현재 경로가 로그인 페이지일 경우 상단바를 숨김 처리
    if (location.pathname === '/login') {
        return null;
    }

    return (
        <header className="top-bar">
            <div className="top-bar-content">
                {/* 로고 클릭 시 메인 페이지로 이동하는 편의성 추가 */}
                <h1 className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>오성에타</h1>
                <button className="logout-button" type="button" onClick={handleLogout}>
                    로그아웃
                </button>
            </div>
        </header>
    );
}