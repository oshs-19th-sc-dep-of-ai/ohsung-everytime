import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { messaging } from '../firebase';
import { getToken } from 'firebase/messaging';
import './MainPage.css';

export function MainPage() {
    const navigate = useNavigate();

    // 로컬 스토리지에서 사용자 이름 가져오기
    const userName = localStorage.getItem("student_name") || "학생";

    // 인기글 데이터를 저장할 상태
    const [top3Posts, setTop3Posts] = useState([]);

    // 푸시 알림 토큰 요청 로직
    // 푸시 알림 토큰 요청 로직
    useEffect(() => {
        const requestPermission = async () => {
            if (localStorage.getItem("login") !== "true") {
                console.log('User not logged in, skipping token registration.');
                return;
            }

            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    const token = await getToken(messaging);
                    if (token) {
                        // 백엔드 알림 토큰 등록 API의 DB 멈춤 버그를 우회하기 위해 API 호출을 차단
                        // 에러남..?
                        /*
                        await fetch(`${API_BASE_URL}/notifications/register-token`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ token }),
                            credentials: 'include',
                        });
                        */
                        console.log("알림 토큰 발급 성공 (백엔드 전송은 서버 오류 방지를 위해 비활성화됨)");
                    }
                }
            } catch (error) {
                console.error('An error occurred while retrieving token:', error);
            }
        };

        requestPermission();
    }, []);

    // API 연동: 인기 게시글 3개 추출
    useEffect(() => {
        const fetchTopPosts = async () => {
            try {
                // 프론트 단에서 정렬하기 위해 게시글을 충분히 가져옵니다.
                const response = await axios.get(`${API_BASE_URL}/posts`, {
                    params: { page: 1, limit: 50 },
                    withCredentials: true
                });

                if (response.data && response.data.data && response.data.data.posts) {
                    const fetchedPosts = response.data.data.posts.map(post => ({
                        id: post.post_id,
                        title: post.title,
                        // 백엔드에 아직 likes 필드가 없다면 0으로 처리
                        likes: post.likes_count || 0,
                        commentCount: post.comment_count || 0,
                    }));

                    // 좋아요 순 정렬 (좋아요가 같으면 댓글 수 기준)
                    const sorted = fetchedPosts.sort((a, b) => {
                        if (b.likes === a.likes) {
                            return b.commentCount - a.commentCount;
                        }
                        return b.likes - a.likes;
                    }).slice(0, 3);

                    setTop3Posts(sorted);
                }
            } catch (error) {
                console.error('인기글을 불러오는 중 오류 발생:', error);
            }
        };

        fetchTopPosts();
    }, []);

    // ==========================================
    // [Navigation Functions]
    // ==========================================

    const goMeal = () => {
        navigate('/meal');
    };

    const goPostList = () => {
        navigate('/board');
    };

    const goPostDetail = (e, id) => {
        e.stopPropagation(); // 부모(goPostList)로 이벤트 전파 방지
        navigate(`/post/${id}`);
    };

    return (
        <div className="app-container">
            <header className="home-header">
                <h1 className="title">
                    안녕하세요,<br />
                    <span className="highlight">{userName}</span>님 👋
                </h1>
                <p className="subtitle">오늘도 즐거운 하루 되세요!</p>
            </header>

            <main className="main-content">
                <section className="menu-card meal-section" onClick={goMeal}>
                    <div className="card-bg-deco">🍚</div>
                    <div className="text-group">
                        <span className="label">오늘 급식 뭐 나오지?</span>
                        <h2>급식 메뉴 확인하기 ➜</h2>
                    </div>
                </section>

                <section className="menu-card board-section" onClick={goPostList}>
                    <div className="board-header">
                        <div className="board-title-group">
                            <h2>자유 게시판</h2>
                        </div>
                        <div className="go-icon">목록 보러가기 ➜</div>
                    </div>

                    <div className="divider"></div>

                    <div className="popular-preview-area">
                        <p className="area-label">🔥 인기글</p>

                        <div className="preview-list">
                            {top3Posts.length > 0 ? (
                                top3Posts.map((post, index) => (
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
                                ))
                            ) : (
                                <p style={{ fontSize: '13px', color: '#888', padding: '10px 0' }}>
                                    아직 등록된 게시글이 없습니다.
                                </p>
                            )}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}