import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

// ==========================================
// SVG 아이콘 컴포넌트 (외부 라이브러리 불필요)
// ==========================================
const HomeIcon = () => (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9.55228 21 10 20.5523 10 20V16C10 15.4477 10.4477 15 11 15H13C13.5523 15 14 15.4477 14 16V20C14 20.5523 14.4477 21 15 21M9 21H15" />
    </svg>
);

const BoardIcon = () => (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 8H17M7 12H17M7 16H13" />
    </svg>
);

const WriteIcon = () => (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5V19M5 12H19" />
    </svg>
);

const MealIcon = () => (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8H19C20.1046 8 21 8.89543 21 10V10C21 11.1046 20.1046 12 19 12H18" />
        <path d="M3 8H18V13C18 16.3137 15.3137 19 12 19H9C5.68629 19 3 16.3137 3 13V8Z" />
        <path d="M6 1V4M10.5 1V4M15 1V4" />
    </svg>
);

const SettingsIcon = () => (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
);

// ==========================================
// 네비게이션 탭 정의
// ==========================================
const NAV_ITEMS = [
    { id: 'home',  label: '홈',    path: '/',         icon: HomeIcon,     isWrite: false },
    { id: 'board', label: '게시판', path: '/board',    icon: BoardIcon,    isWrite: false },
    { id: 'write', label: '글쓰기', path: '/postWrite', icon: WriteIcon, isWrite: true  },
    { id: 'meal',  label: '급식',   path: '/meal',     icon: MealIcon,     isWrite: false },
    { id: 'admin', label: '설정',   path: '/admin',    icon: SettingsIcon, isWrite: false },
];

// ==========================================
// BottomNav 컴포넌트
// ==========================================
export function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    /**
     * 현재 경로가 해당 탭에 해당하는지 판단.
     * - '/' 홈은 정확 매치
     * - '/post/:id' 상세 페이지는 게시판 탭에 매핑
     */
    const isActive = (item) => {
        if (item.path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(item.path);
    };

    // 게시글 상세 페이지도 board 탭으로 활성화
    const resolveActive = (item) => {
        if (item.id === 'board' && location.pathname.startsWith('/post/')) {
            return true;
        }
        return isActive(item);
    };

    // 전역 스와이프 제스처 핸들러 추가
    useEffect(() => {
        let touchStartX = 0;
        let touchStartY = 0;
        const SWIPE_THRESHOLD = 50;

        const handleTouchStart = (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        };

        const handleTouchEnd = (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            
            // 화면 가장자리에서 시작된 스와이프는 브라우저 뒤로가기/앞으로가기 제스처일 수 있으므로 무시
            if (touchStartX < 20 || touchStartX > window.innerWidth - 20) {
                return;
            }

            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;

            // X축 이동이 Y축 이동보다 크고, 임계값 이상인 경우 스와이프로 인식
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
                const currentIndex = NAV_ITEMS.findIndex(item => resolveActive(item));
                if (currentIndex === -1) return; // 활성 탭을 찾을 수 없는 경우 무시

                if (deltaX > 0) {
                    // 오른쪽으로 스와이프: 이전 탭으로 이동
                    if (currentIndex > 0) {
                        navigate(NAV_ITEMS[currentIndex - 1].path);
                    }
                } else {
                    // 왼쪽으로 스와이프: 다음 탭으로 이동
                    if (currentIndex < NAV_ITEMS.length - 1) {
                        navigate(NAV_ITEMS[currentIndex + 1].path);
                    }
                }
            }
        };

        document.addEventListener('touchstart', handleTouchStart);
        document.addEventListener('touchend', handleTouchEnd);

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [location.pathname, navigate]);

    // 로그인 화면에서는 하단 네비를 숨긴다
    if (location.pathname === '/login') {
        return null;
    }

    return (
        <nav className="bottom-nav" id="bottom-navigation">
            <div className="bottom-nav-inner">
                {NAV_ITEMS.map((item) => {
                    const active = resolveActive(item);
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.id}
                            id={`nav-${item.id}`}
                            className={`bottom-nav-item${active ? ' active' : ''}${item.isWrite ? ' write-btn' : ''}`}
                            onClick={() => navigate(item.path)}
                            aria-label={item.label}
                            aria-current={active ? 'page' : undefined}
                        >
                            <span className="nav-active-dot" />
                            <span className="nav-icon-wrapper">
                                <Icon />
                            </span>
                            <span className="nav-label">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
