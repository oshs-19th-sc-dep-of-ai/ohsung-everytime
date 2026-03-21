import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from "../config";
import './PostDetailPage.css';

// ==========================================
// 🔧 댓글 관련 설정 조건 (직접 수정 가능)
// ==========================================
const POPULAR_COMMENT_THRESHOLD = 5; // 인기 댓글로 선정되기 위한 최소 좋아요 수
const POPULAR_COMMENT_LIMIT = 3;     // 최상단에 노출할 인기 댓글 최대 개수
// ==========================================

export function PostDetailPage() {
    const { postId } = useParams();
    const navigate = useNavigate();

    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // 댓글 정렬 관련 상태
    const [commentSortOrder, setCommentSortOrder] = useState('oldest'); // oldest(시간순), latest(최신순), popular(인기순)

    const fetchPostAndComments = useCallback(async (abortSignal) => {
        try {
            setIsLoading(true);

            // 1. 게시글 상세 정보 가져오기
            const postRes = await axios.get(`${API_BASE_URL}/posts/${postId}`, {
                withCredentials: true,
                signal: abortSignal
            });

            if (postRes.data && postRes.data.data) {
                const p = postRes.data.data;
                setPost({
                    id: p.post_id,
                    title: p.title,
                    content: p.content || "",
                    author: p.author_name,
                    createdAt: p.created_at,
                    likes: p.likes_count || 0,
                    is_liked: p.is_liked || false, // 게시글 좋아요 상태 저장
                });
            }

            // 2. 댓글 목록 가져오기
            const commentsRes = await axios.get(`${API_BASE_URL}/posts/${postId}/comments`, {
                withCredentials: true,
                signal: abortSignal
            });

            if (commentsRes.data && commentsRes.data.data) {
                setComments(commentsRes.data.data);
            }

            setError(null);
        } catch (err) {
            if (axios.isCancel(err)) return;
            console.error("데이터 로딩 오류:", err);
            if (err.response?.status === 401) {
                setError("로그인이 필요한 페이지입니다.");
            } else {
                setError("게시글 데이터를 불러오는 데 실패했습니다.");
            }
        } finally {
            if (!abortSignal || !abortSignal.aborted) {
                setIsLoading(false);
            }
        }
    }, [postId]);

    useEffect(() => {
        const controller = new AbortController();
        fetchPostAndComments(controller.signal);
        return () => controller.abort();
    }, [fetchPostAndComments]);

    // ==========================================
    // 🌟 댓글 데이터 처리 (정렬 및 인기 댓글 추출)
    // ==========================================
    const topPopularComments = useMemo(() => {
        return [...comments]
            .filter(c => (c.likes_count || 0) >= POPULAR_COMMENT_THRESHOLD)
            .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
            .slice(0, POPULAR_COMMENT_LIMIT);
    }, [comments]);

    const processedComments = useMemo(() => {
        let result = [...comments];
        if (commentSortOrder === 'latest') {
            result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (commentSortOrder === 'oldest') {
            result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        } else if (commentSortOrder === 'popular') {
            result.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
        }
        return result;
    }, [comments, commentSortOrder]);

    // ==========================================
    // 🌟 이벤트 핸들러
    // ==========================================

    // 게시글 좋아요
    const handlePostLike = async () => {
        if (!post) return;

        try {
            // 주소 끝의 슬래시(/)를 반드시 제거해야 합니다.
            // 백엔드 posts.py의 @posts_bp.route('/posts/<int:post_id>/like', ...)와 일치해야 함
            const res = await axios.post(`${API_BASE_URL}/posts/${postId}/like`, {}, {
                withCredentials: true
            });

            if (res.data.status === 'success') {
                setPost(prev => ({
                    ...prev,
                    likes: res.data.data.likes_count,
                    is_liked: res.data.data.is_liked
                }));
            }
        } catch (err) {
            console.error("좋아요 에러:", err.response);
            if (err.response?.status === 401) alert("로그인이 필요합니다.");
            else alert("게시글 좋아요 처리에 실패했습니다.");
        }
    };

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
            if (err.response?.status === 401) alert("로그인이 필요합니다.");
            else alert(err.response?.data?.message || "댓글 작성에 실패했습니다.");
        }
    };

    const handleCommentLike = async (commentId) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/comments/${commentId}/like`, {}, { withCredentials: true });
            if (res.data.status === 'success') fetchPostAndComments();
        } catch (err) {
            if (err.response?.status === 401) alert("로그인이 필요합니다.");
            else alert("좋아요 처리에 실패했습니다.");
        }
    };

    // 공통 댓글 렌더링 컴포넌트 (일반 댓글 및 인기 댓글에서 재사용)
    const renderCommentItem = (comment, isPopularBadge = false) => {
        return (
            <div key={`comment-${comment.comment_id}`} className={`comment-item ${isPopularBadge ? 'popular-highlight' : ''}`}>
                <div className="comment-header">
                    <div>
                        {isPopularBadge && <span style={{ color: '#ff4b4b', fontWeight: 'bold', marginRight: '5px' }}>🔥 베스트</span>}
                        <span className="comment-author">{comment.author_name}</span>
                        <span className="comment-date" style={{ marginLeft: '10px', fontSize: '0.8em', color: '#888' }}>{comment.created_at}</span>
                    </div>
                </div>

                <div className="comment-body">
                    {comment.content}
                </div>

                <button
                    className={`comment-like ${comment.is_liked ? 'liked' : ''}`}
                    onClick={() => handleCommentLike(comment.comment_id)}
                >
                    ❤️ {comment.likes_count || 0}
                </button>
            </div>
        );
    };

    if (isLoading) return <div className="loading">게시글 로딩 중...</div>;

    return (
        <div className="post-detail-container">
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <button onClick={() => navigate(-1)} className="back-button">← 목록으로</button>
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

                        {/* 게시글 좋아요 버튼 추가 */}
                        <div className="post-actions" style={{ marginTop: '30px', textAlign: 'center' }}>
                            <button
                                onClick={handlePostLike}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '25px',
                                    border: post.is_liked ? '1px solid #ff4b4b' : '1px solid #ccc',
                                    background: post.is_liked ? '#fff0f0' : 'white',
                                    color: post.is_liked ? '#ff4b4b' : '#333',
                                    cursor: 'pointer',
                                    fontSize: '15px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                }}
                            >
                                {post.is_liked ? '❤️' : '🤍'} 공감 {post.likes}
                            </button>
                        </div>
                    </div>

                    <div className="comments-section">
                        {/* 최상단 인기 댓글 섹션 */}
                        {topPopularComments.length > 0 && (
                            <div className="popular-comments-container" style={{ marginBottom: '20px', padding: '15px', background: '#fff0f0', borderRadius: '8px' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: '#d32f2f' }}>🔥 실시간 인기 댓글</h3>
                                {topPopularComments.map(comment => renderCommentItem(comment, true))}
                            </div>
                        )}

                        {/* 전체 댓글 헤더 및 정렬 선택기 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 className="comments-title" style={{ margin: 0 }}>전체 댓글 ({comments.length})</h3>
                            <select
                                value={commentSortOrder}
                                onChange={(e) => setCommentSortOrder(e.target.value)}
                                style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                            >
                                <option value="oldest">시간순</option>
                                <option value="latest">최신순</option>
                                <option value="popular">인기순</option>
                            </select>
                        </div>

                        {/* 전체 댓글 리스트 */}
                        <div className="comments-list">
                            {processedComments.length > 0 ? (
                                processedComments.map(comment => (
                                    <div key={comment.comment_id} className="comment-thread">
                                        {renderCommentItem(comment)}
                                        {/* 대댓글이 있을 경우 렌더링 */}
                                        {comment.replies && comment.replies.length > 0 && (
                                            <div className="replies-list" style={{ marginLeft: '30px', borderLeft: '2px solid #eee', paddingLeft: '10px' }}>
                                                {comment.replies.map(reply => renderCommentItem(reply))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="empty-comments">댓글이 없습니다.</div>
                            )}
                        </div>

                        {/* 새 댓글 작성 폼 */}
                        <form onSubmit={handleCommentSubmit} className="comment-form" style={{ marginTop: '20px' }}>
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