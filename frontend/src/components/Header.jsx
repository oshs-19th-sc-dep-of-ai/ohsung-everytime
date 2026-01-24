import React from 'react';
import './Header.css'; // CSS 스타일 유지를 위해 임포트 (또는 별도 Header.css 생성)

export function Header() {
    const handleLogout = () => {
        alert("로그아웃");
        //로그아웃 처리 로직
    };

    return (
        <header className="top-bar">
            <div className="top-bar-content">
                <h1 className="logo">오성에타</h1>
                <button className="login-button" type="button" onClick={handleLogout}>
                    로그아웃
                </button>
            </div>
        </header>
    );
}