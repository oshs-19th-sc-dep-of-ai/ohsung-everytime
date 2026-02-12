import React, { useState, useMemo } from 'react';
import './MainPage.css';

export function MainPage() {

    // [Data] 게시글 데이터 (테스트용)
    const [posts] = useState([
        { id: 1, title: "오늘 급식 미역국 맛 실화냐?", author: "미식가", likes: 35, commentCount: 12 },
        { id: 2, title: "체육대회 반티 시안 투표 좀", author: "반장", likes: 28, commentCount: 8 },
        { id: 3, title: "매점 신상 빵 먹어본 사람?", author: "빵순이", likes: 15, commentCount: 5 },
        { id: 4, title: "지우개 빌려주실 분...", author: "깜빡이", likes: 2, commentCount: 0 },
        { id: 5, title: "수학 수행평가 범위 어디까지임?", author: "수포자", likes: 5, commentCount: 3 },
    ]);

    // [Logic] 인기글 3개 추출 (좋아요 순)
    const top3Posts = useMemo(() => {
        return [...posts]
            .sort((a, b) => b.likes - a.likes)
            .slice(0, 3);
    }, [posts]);

    // ==========================================
    // [Navigation Functions]
    // ==========================================

    // 1. 급식 페이지로 이동
    const goMeal = () => {
        console.log("Nav -> Meal Page");
        alert("🍱 오늘의 급식 페이지로 이동합니다!");
    };

    // 2. 게시글 '전체 목록'으로 이동 (게시판 메인)
    const goPostList = () => {
        console.log("Nav -> Full Post List");
        alert("📋 게시글 전체 목록으로 이동합니다.");
    };

    // 3. 특정 '게시글 상세'로 이동 (인기글 클릭 시)
    const goPostDetail = (e, id) => {
        // 부모(goPostList)로 클릭 이벤트가 전파되는 것을 막음
        e.stopPropagation();
        console.log(`Nav -> Post Detail ID: ${id}`);
        alert(`🔥 인기글 [${id}번] 상세 페이지로 바로 이동합니다!`);
    };

    return (
        <div className="app-container">

            {/* Header: 심플한 인사말 */}
            <header className="home-header">
                <h1 className="title">
                    안녕하세요,<br />
                    <span className="highlight">홍길동</span>님 👋
                </h1>
                <p className="subtitle">오늘도 즐거운 하루 되세요!</p>
            </header>

            <main className="main-content">

                {/* MENU 1: 급식 확인 카드
                   - 단순하고 명확한 하나의 큰 버튼 역할
                */}
                <section className="menu-card meal-section" onClick={goMeal}>
                    <div className="card-bg-deco">🍚</div>
                    <div className="text-group">
                        <span className="label">오늘 뭐 나오지?</span>
                        <h2>급식 메뉴 확인하기 ➜</h2>
                    </div>
                </section>


                {/* MENU 2: 게시판 카드 (인기글 포함)
                   - 전체 영역 클릭 시: 목록 이동
                   - 내부 인기글 클릭 시: 상세 이동
                */}
                <section className="menu-card board-section" onClick={goPostList}>

                    {/* 카드 헤더: 게시판 이름 + 더보기 화살표 */}
                    <div className="board-header">
                        <div className="board-title-group">
                            <h2>자유 게시판</h2>
                            <span className="post-count-badge">New 5</span>
                        </div>
                        <div className="go-icon">목록 보러가기 ➜</div>
                    </div>

                    <div className="divider"></div>

                    {/* 인기글 프리뷰 영역 */}
                    <div className="popular-preview-area">
                        <p className="area-label">🔥 지금 핫한 이야기</p>

                        <div className="preview-list">
                            {top3Posts.map((post, index) => (
                                <div
                                    key={post.id}
                                    className="preview-item"
                                    onClick={(e) => goPostDetail(e, post.id)}
                                >
                                    <span className="rank">{index + 1}</span>
                                    <div className="info">
                                        <p className="p-title">{post.title}</p>
                                        <span className="p-meta">
                                            ❤️ {post.likes} · 댓글 {post.commentCount}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </section>

            </main>
        </div>
    );
}