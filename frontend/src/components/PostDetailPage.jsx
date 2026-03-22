import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from "../config";
import './PostDetailPage.css';

const POPULAR_COMMENT_THRESHOLD = 5;
const POPULAR_COMMENT_LIMIT = 3;

// --- 커스텀 SVG 아이콘 컴포넌트 (회색조, 자연스러운 화살표) ---
const SortDownIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="grey-icon">
        <path d="M12 5v14M19 12l-7 7-7-7"/>
    </svg>
);

const SortUpIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="grey-icon">
        <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
);
// --------------------------------------------------------

export function PostDetailPage() {
    const { postId } = useParams();
    const navigate = useNavigate();

    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]); // 계층형 구조
    const [newComment, setNewComment] = useState("");
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // 정렬 관련 상태
    const [sortType, setSortType] = useState('latest'); // latest(최신순), popular(인기순)
    const [sortOrder, setSortOrder] = useState('desc'); // desc(내림차순), asc(오름차순)

    const fetchPostAndComments = useCallback(async (abortSignal) => {
        try {
            setIsLoading(true);

            // 1. 게시글 상세 조회 API 호출
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
                    is_liked: p.is_liked || false,
                });
            }

            // 2. 댓글 목록 조회 API 호출 (계층 구조 데이터 수신)
            const commentsRes = await axios.get(`${API_BASE_URL}/posts/${postId}/comments`, {
                withCredentials: true,
                signal: abortSignal
            });

            if (commentsRes.data && commentsRes.data.data) {
                // 백엔드에서 준 계층 구조를 그대로 사용 (익명 번호 매핑 로직 제거)
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

    // 베스트 댓글 추출 로직 (좋아요 수 기준 최상위 N개)
    // processedComments와 별개로, 항상 '원래 시간순' 데이터 기반으로 추출하는 것이 일반적
    const topPopularComments = useMemo(() => {
        // 모든 댓글/대댓글을 평탄화하여 좋아요 순으로 정렬 후 추출
        const allCommentsFlattened = [];
        const flatten = (items) => {
            items.forEach(item => {
                allCommentsFlattened.push(item);
                if (item.replies && item.replies.length > 0) {
                    flatten(item.replies);
                }
            });
        };
        flatten(comments);

        return allCommentsFlattened
            .filter(c => (c.likes_count || 0) >= POPULAR_COMMENT_THRESHOLD)
            .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0)) // 좋아요 내림차순
            .slice(0, POPULAR_COMMENT_LIMIT);
    }, [comments]);

    // 정렬 및 차순 적용된 최상위 댓글 목록 계산
    const processedComments = useMemo(() => {
        let result = [...comments]; // 최상위 댓글만 복사

        // 정렬 로직 (최상위 댓글에만 적용)
        result.sort((a, b) => {
            if (sortType === 'latest') {
                const dateA = new Date(a.created_at).getTime();
                const dateB = new Date(b.created_at).getTime();
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
            } else if (sortType === 'popular') {
                const likesA = a.likes_count || 0;
                const likesB = b.likes_count || 0;
                return sortOrder === 'desc' ? likesB - likesA : likesA - likesB;
            }
            return 0;
        });

        return result;
    }, [comments, sortType, sortOrder]);

    const handlePostLike = async () => {
        if (!post) return;
        try {
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
                is_anonymous: isAnonymous // 익명 체크 상태 전송
            }, { withCredentials: true });

            setNewComment("");
            alert("댓글이 작성되었습니다.");
            fetchPostAndComments(); // 목록 새로고침
        } catch (err) {
            if (err.response?.status === 401) alert("로그인이 필요합니다.");
            else alert(err.response?.data?.message || "댓글 작성에 실패했습니다.");
        }
    };

    const handleCommentLike = async (commentId) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/comments/${commentId}/like`, {}, { withCredentials: true });
            if (res.data.status === 'success') {
                // 데이터를 다시 불러와 화면 갱신 (성능 최적화 필요 시 부분 업데이트 구현 가능)
                fetchPostAndComments();
            }
        } catch (err) {
            if (err.response?.status === 401) alert("로그인이 필요합니다.");
            else alert("좋아요 처리에 실패했습니다.");
        }
    };

    // 단일 댓글 아이템 렌더링 함수
    const renderCommentItem = (comment, isPopularBadge = false) => {
        // 이름 표시 로직: 백엔드에서 준 author_name을 그대로 쓰되, is_anonymous면 '익명'으로 고정
        const displayName = comment.is_anonymous ? "익명" : comment.author_name;

        return (
            <div key={`comment-${comment.comment_id}`} className={`comment-item ${isPopularBadge ? 'popular-highlight' : ''}`}>
                <div className="comment-header">
                    <div>
                        {isPopularBadge && <span className="best-badge">🔥 베스트</span>}
                        <span className="comment-author">{displayName}</span>
                        <span className="comment-date">{comment.created_at}</span>
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
            <div className="toolbar">
                <button onClick={() => navigate(-1)} className="back-button">← 목록으로</button>
            </div>

            {error ? (
                <div className="error-message">{error}</div>
            ) : post ? (
                <>
                    {/* 게시글 영역 */}
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
                            <button
                                onClick={handlePostLike}
                                className={`post-like-btn ${post.is_liked ? 'liked' : ''}`}
                            >
                                {post.is_liked ? '❤️' : '🤍'} 공감 {post.likes}
                            </button>
                        </div>
                    </div>

                    {/* 댓글 영역 */}
                    <div className="comments-section">
                        {/* 베스트 댓글 영역 */}
                        {topPopularComments.length > 0 && (
                            <div className="popular-comments-container">
                                <h3 className="popular-title">🔥 실시간 인기 댓글</h3>
                                {topPopularComments.map(comment => renderCommentItem(comment, true))}
                            </div>
                        )}

                        {/* 댓글 헤더 (개수 및 정렬) */}
                        <div className="comments-header-row">
                            <h3 className="comments-title">전체 댓글 ({comments.length})</h3>

                            {/* 정렬 컨트롤 영역 */}
                            <div className="sort-controls">
                                {/* 원터치 차순 변경 버튼 (이모지 -> SVG 아이콘) */}
                                <button
                                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                    className="sort-order-btn"
                                    title={sortOrder === 'desc' ? '내림차순' : '오름차순'}
                                >
                                    {sortOrder === 'desc' ? <SortDownIcon /> : <SortUpIcon />}
                                </button>
                                {/* 정렬 기준 선택 */}
                                <select
                                    value={sortType}
                                    onChange={(e) => setSortType(e.target.value)}
                                    className="sort-select"
                                >
                                    <option value="latest">최신순</option>
                                    <option value="popular">인기순</option>
                                </select>
                            </div>
                        </div>

                        {/* 댓글 목록 */}
                        <div className="comments-list">
                            {processedComments.length > 0 ? (
                                processedComments.map(comment => (
                                    <div key={comment.comment_id} className="comment-thread">
                                        {/* 원댓글 */}
                                        {renderCommentItem(comment)}

                                        {/* 대댓글 목록 */}
                                        {comment.replies && comment.replies.length > 0 && (
                                            <div className="replies-list">
                                                {comment.replies.map(reply => renderCommentItem(reply))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="empty-comments">댓글이 없습니다.</div>
                            )}
                        </div>

                        {/* 댓글 입력 폼 (디자인 수정) */}
                        <form onSubmit={handleCommentSubmit} className="comment-form">
                            <div className="comment-input-wrapper">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="댓글을 입력하세요"
                                    className="comment-input"
                                />
                                <div className="comment-options">
                                    {/* 커스텀 디자인된 익명 체크박스 */}
                                    <label className="anonymous-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={isAnonymous}
                                            onChange={(e) => setIsAnonymous(e.target.checked)}
                                            className="hidden-checkbox"
                                        />
                                        <span className="custom-checkbox"></span>
                                        익명
                                    </label>
                                    <button type="submit" className="comment-submit">등록</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </>
            ) : (
                <div className="error-message">게시글이 존재하지 않습니다.</div>
            )}
        </div>
    );
}