import { useState } from 'react';
import './MainPage.css';

export function MainPage() {
    
    // 게시글 미리보기 데이터
    //나중에 api호출해서 최근게시글3개 가져올예정
    const recentPosts = [
        { id: 1, title: "기말 시간표좀", author: "익명", time: "10분 전" },
        { id: 2, title: "작년 수2 족보 있는사람?", author: "익명", time: "1시간 전" },
        { id: 3, title: "선택과목 바꿔줄사람 @smin__j 연락", author: "손민정", time: "2시간 전" },
    ];

    const goMeal = () => {

        alert("급식메뉴 페이지로 이동");
        //이동로직


    };

    const goPostList = () => {

        alert("게시판 페이지로 이동");
        //이동로직

    };

    return (
        <div className="main-container">
            <section className="welcome-header">
                <div className="welcome-text">
                    <h2>안녕하세요, 홍길동님! <span className="wave">👋</span></h2>
                    <p>오늘도 오성고에서 즐거운 하루 보내세요.</p>
                </div>
            </section>

            {/* 2. 대시보드 그리드 */}
            <section className="dashboard-grid">

                {/* 카드 1: 급식 */}
                <article className="dashboard-card meal-card" onClick={goMeal}>
                    <div className="card-bg-icon">🍱</div>
                    <div className="card-content">
                        <div className="card-header">
                            <h3>오늘의 급식</h3>
                            <span className="arrow-btn">➜</span>
                        </div>
                        <div className="meal-preview">
                            <p className="meal-highlight">맛있는 급식 확인하기</p>
                            <span className="check-text">터치해서 메뉴 보기</span>
                        </div>
                    </div>
                </article>

                {/* 카드 2: 게시판 */}
                <article className="dashboard-card board-card" onClick={goPostList}>
                    <div className="card-content">
                        <div className="card-header">
                            <h3>자유 게시판</h3>
                            <span className="arrow-btn">➜</span>
                        </div>

                        {/* 게시글 리스트 위젯 */}
                        <div className="posts-widget">
                            {recentPosts.length > 0 ? (
                                <ul className="post-list">
                                    {recentPosts.map((post) => (
                                        <li key={post.id} className="post-item">
                                            <span className="post-title">{post.title}</span>
                                            {/* 작성자와 시간을 묶어서 표시 */}
                                            <div className="post-meta">
                                                <span className="post-author">{post.author}</span>
                                                <span className="post-divider">|</span>
                                                <span className="post-time">{post.time}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="no-posts">새로운 글이 없습니다.</p>
                            )}
                        </div>
                    </div>
                </article>

            </section>
        </div>
    );
}