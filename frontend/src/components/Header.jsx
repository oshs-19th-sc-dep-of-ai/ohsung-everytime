import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext.jsx';
import { API_BASE_URL } from '../config';
import axios from 'axios';
import './Header.css';

export function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const fetchUnreadCount = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/notifications/unread-count`, {
                    withCredentials: true,
                });
                if (response.data && response.data.data) {
                    setUnreadCount(response.data.data.unread_count || 0);
                }
            } catch (error) {
                console.error('읽지 않은 알림 개수 불러오기 실패:', error);
            }
        };

        if (localStorage.getItem('login') === 'true') {
            fetchUnreadCount();
        }
    }, [location.pathname]);

    const handleLogout = () => {
        showToast("로그아웃 되었습니다.");
        localStorage.clear();
        navigate("/login", { replace: true });
    };

    const handleNotificationClick = () => {
        navigate('/notifications');
    };

    if (location.pathname === '/login') {
        return null;
    }

    return (
        <header className="top-bar">
            <div className="top-bar-content">
                <h1 className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>오성광장</h1>
                <div className="header-actions">
                    <button className="notification-button" onClick={handleNotificationClick} aria-label="알림">
                        🔔
                        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                    </button>
                    <button className="logout-button" type="button" onClick={handleLogout}>
                        로그아웃
                    </button>
                </div>
            </div>
        </header>
    );
}
