import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from "../config";
import './PostDetailPage.css';

export function PostDetailPage() {
    const { postId } = useParams();
    const navigate = useNavigate();

    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPostAndComments = useCallback(async () => {
        try {
            setIsLoading(true);

            // 🚨 수정된 부분: Promise.all을 제거하고 API를 순차적으로 호출합니다.
            // 1. 게시글 상세 정보 가져오기
            const postRes = await axios.get(`${API_BASE_URL}/posts/${postId}`, { withCredentials: true });

            if (postRes.data && postRes.data.data) {
                const p = postRes.data.data;
                setPost({
                    id: p.post_id,
                    title: p.title,
                    content: p.content || "",
                    author: p.author_name,
                    createdAt: p.created_at,
                    likes: p.likes_count || 0,
                });
            }

            // 2. 게시글 로딩이 완전히 완료된 후 댓글 목록 가져오기 (DB 충돌 우회)
            const commentsRes = await axios.get(`${API_BASE_URL}/posts/${postId}/comments`, { withCredentials: true });

            if (commentsRes.data && commentsRes.data.data) {
                setComments(commentsRes.data.data);
            }

            setError(null);
        } catch (err) {
            console.error("데이터 로딩 오류:", err);
            // 인증 오류(401) 시 에러 메시지 대신 알림창만 띄우고 데이터는 빈 상태로 둡니다.
            if (err.response?.status === 401) {
                setError("로그인이 필요한 페이지입니다. 상단의 테스트 로그인 버튼을 눌러주세요.");
            } else {
                setError("게시글 데이터를 불러오는 데 실패했습니다.");
            }
        } finally {
            setIsLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        fetchPostAndComments();
    }, [fetchPostAndComments]);

    // ==========================================
    // 🚨 테스트용 임시 로그인 핸들러 (프론트 단독 테스트용)
    // ==========================================
    const handleDevLogin = async () => {
        try {
            // 위 SQL에서 생성한 계정 정보로 로그인 요청
            await axios.post(`${API_BASE_URL}/login`, {
                student_id: 'test001',
                password: '1234'
            }, { withCredentials: true });

            alert("테스트 계정(test001)으로 로그인되었습니다! 이제 댓글과 좋아요 테스트가 가능합니다.");
            fetchPostAndComments(); // 로그인 성공 후 데이터 다시 불러오기
        } catch (err) {
            console.error("테스트 로그인 실패:", err);
            alert("로그인 실패. DB에 test001 계정이 생성되었는지 확인해주세요.");
        }
    };
    // ==========================================

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            await axios.post(`${API_BASE_URL}/posts/${postId}/comments`, {
                content: newComment,
                is_anonymous: true
            }, { withCredentials: true });

            setNewComment("");
            alert("댓글이 작성되었습니다.");
            fetchPostAndComments();
        } catch (err) {
            console.error("댓글 작성 중 오류:", err);
            if (err.response?.status === 401) {
                alert("로그인이 필요합니다. 테스트 로그인 버튼을 눌러주세요.");
            } else {
                alert(err.response?.data?.message || "댓글 작성에 실패했습니다.");
            }
        }
    };

    const handleCommentLike = async (commentId) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/comments/${commentId}/like`, {}, { withCredentials: true });
            if (res.data.status === 'success') {
                fetchPostAndComments();
            }
        } catch (err) {
            if (err.response?.status === 401) {
                alert("로그인이 필요합니다. 테스트 로그인 버튼을 눌러주세요.");
            } else {
                alert("좋아요 처리에 실패했습니다.");
            }
        }
    };

    const handlePostLike = () => {
        alert("게시물 좋아요 기능은 백엔드에 아직 구현되지 않았습니다.");
    };

    if (isLoading) return <div className="loading">게시글 로딩 중...</div>;

    return (
        <div className="post-detail-container">
            {/* 상단 툴바 및 테스트 로그인 버튼 */}
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => navigate(-1)} className="back-button">← 목록으로</button>
                <button
                    onClick={handleDevLogin}
                    style={{ background: '#ff4b4b', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                >
                    🔧 테스트 강제 로그인
                </button>
            </div>

            {error ? (
                <div className="error-message">{error}</div>
            ) : post ? (
                <>
                    <div className="post-card">
                        <h2 className="post-title">{post.title}</h2>
                        <div className="post-meta">
                            <span className="author">{post.author}</span>
                            <span className="date">{post.createdAt}</span>
                        </div>
                        <hr className="divider" />
                        <div className="post-content">
                            {post.content.split('\n').map((line, i) => (
                                <React.Fragment key={i}>{line}<br /></React.Fragment>
                            ))}
                        </div>
                        <div className="post-actions">
                            <button className="like-button" onClick={handlePostLike}>❤️ 공감 {post.likes}</button>
                        </div>
                    </div>

                    <div className="comments-section">
                        <h3 className="comments-title">댓글</h3>
                        <div className="comments-list">
                            {comments.length > 0 ? (
                                comments.map(comment => (
                                    <div key={comment.comment_id} className="comment-thread">
                                        <div className="comment-item">
                                            <div className="comment-header">
                                                <span className="comment-author">{comment.author_name}</span>
                                                <span className="comment-date">{comment.created_at}</span>
                                            </div>
                                            <div className="comment-body">{comment.content}</div>
                                            <button
                                                className={`comment-like ${comment.is_liked ? 'liked' : ''}`}
                                                onClick={() => handleCommentLike(comment.comment_id)}
                                            >
                                                ❤️ {comment.likes_count || 0}
                                            </button>
                                        </div>

                                        {comment.replies && comment.replies.length > 0 && (
                                            <div className="replies-list">
                                                {comment.replies.map(reply => (
                                                    <div key={reply.comment_id} className="comment-item reply-item">
                                                        <div className="comment-header">
                                                            <span className="comment-author">{reply.author_name}</span>
                                                            <span className="comment-date">{reply.created_at}</span>
                                                        </div>
                                                        <div className="comment-body">{reply.content}</div>
                                                        <button
                                                            className={`comment-like ${reply.is_liked ? 'liked' : ''}`}
                                                            onClick={() => handleCommentLike(reply.comment_id)}
                                                        >
                                                            ❤️ {reply.likes_count || 0}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="empty-comments">댓글이 없습니다.</div>
                            )}
                        </div>

                        <form onSubmit={handleCommentSubmit} className="comment-form">
                            <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="댓글을 입력하세요"
                                className="comment-input"
                            />
                            <button type="submit" className="comment-submit">등록</button>
                        </form>
                    </div>
                </>
            ) : (
                <div className="error-message">게시글이 존재하지 않습니다.</div>
            )}
        </div>
    );
}