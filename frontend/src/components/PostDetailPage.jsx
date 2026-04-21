import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from "../config";
import './PostDetailPage.css';

const POPULAR_COMMENT_THRESHOLD = 5;
const POPULAR_COMMENT_LIMIT = 3;

// --- 퍼블릭 폴더의 이미지를 사용하는 아이콘 컴포넌트 ---

const SortDownIcon = () => (
    <img
        src="/descending.png"
        alt="내림차순"
        width="16"
        height="16"
        className="sort-icon-img"
    />
);

const SortUpIcon = () => (
    <img
        src="/ascending.png"
        alt="오름차순"
        width="16"
        height="16"
        className="sort-icon-img"
    />
);

// --------------------------------------------------------

export function PostDetailPage() {
    const { postId } = useParams();
    const navigate = useNavigate();

    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [isAnonymous, setIsAnonymous] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);


    const [replyingTo, setReplyingTo] = useState(null);

    // [관리자 전용] 익명 게시글/댓글 작성자 추적 내역 상태 관리
    const [tracedPostAuthor, setTracedPostAuthor] = useState(null);
    const [tracedAuthors, setTracedAuthors] = useState({});

    // 정렬 관련 상태
    const [sortType, setSortType] = useState('latest');
    const [sortOrder, setSortOrder] = useState('desc');

    // 로그인 정보를 기반으로 관리자 여부 확인
    const isAdmin = localStorage.getItem("status") === "admin";


    const fetchPostAndComments = useCallback(async (abortSignal, showLoading = true) => {
        try {
            if (showLoading) setIsLoading(true);

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
                    is_anonymous: p.is_anonymous,
                });
            }

            // 2. 댓글 목록 조회 API 호출
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
            if (showLoading && (!abortSignal || !abortSignal.aborted)) {
                setIsLoading(false);
            }
        }
    }, [postId]);

    useEffect(() => {
        const controller = new AbortController();
        fetchPostAndComments(controller.signal, true);
        return () => controller.abort();
    }, [fetchPostAndComments]);

    const topPopularComments = useMemo(() => {
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
            .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
            .slice(0, POPULAR_COMMENT_LIMIT);
    }, [comments]);

    const processedComments = useMemo(() => {
        let result = [...comments];

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

    const handleAdminPostDelete = async () => {
        const confirmDelete = window.confirm("관리자 권한으로 이 게시글을 정말로 '강제 삭제'하시겠습니까?");
        if (!confirmDelete) return;

        try {
            await axios.delete(`${API_BASE_URL}/admin/posts/${postId}`, { withCredentials: true });
            alert("게시글이 강제 삭제되었습니다.");
            navigate(-1);
        } catch (err) {
            alert(err.response?.data?.message || "게시글 삭제에 실패했습니다.");
        }
    };

    const handleTracePostAuthor = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/trace/posts/${postId}`, { withCredentials: true });
            if (res.data.status === 'success') {
                const { student_name, author_id } = res.data.data;
                setTracedPostAuthor(`${student_name} (${author_id})`);
            }
        } catch (err) {
            alert(err.response?.data?.message || "게시글 작성자 조회에 실패했습니다.");
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            await axios.post(`${API_BASE_URL}/posts/${postId}/comments`, {
                content: newComment,
                is_anonymous: isAnonymous,
                parent_id: replyingTo
            }, { withCredentials: true });

            setNewComment("");
            setReplyingTo(null); // 전송 후 상태 초기화
            alert("댓글이 작성되었습니다.");

            fetchPostAndComments(null, false);
        } catch (err) {
            if (err.response?.status === 401) alert("로그인이 필요합니다.");
            else alert(err.response?.data?.message || "댓글 작성에 실패했습니다.");
        }
    };

    const handleCommentLike = async (commentId) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/comments/${commentId}/like`, {}, { withCredentials: true });
            if (res.data.status === 'success') {

                fetchPostAndComments(null, false);
            }
        } catch (err) {
            if (err.response?.status === 401) alert("로그인이 필요합니다.");
            else alert("좋아요 처리에 실패했습니다.");
        }
    };

    const handleAdminCommentDelete = async (commentId) => {
        const confirmDelete = window.confirm("⚠️ 관리자 권한으로 이 댓글을 강제 삭제하시겠습니까?");
        if (!confirmDelete) return;

        try {
            await axios.delete(`${API_BASE_URL}/admin/comments/${commentId}`, { withCredentials: true });
            alert("댓글이 강제 삭제되었습니다.");
            fetchPostAndComments(null, false);
        } catch (err) {
            alert(err.response?.data?.message || "댓글 삭제에 실패했습니다.");
        }
    };

    const handleTraceCommentAuthor = async (commentId) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/trace/comments/${commentId}`, { withCredentials: true });
            if (res.data.status === 'success') {
                const { student_name, author_id } = res.data.data;
                setTracedAuthors(prev => ({
                    ...prev,
                    [commentId]: `${student_name} (${author_id})`
                }));
            }
        } catch (err) {
            alert(err.response?.data?.message || "작성자 조회에 실패했습니다.");
        }
    };

    const renderCommentItem = (comment, isPopularBadge = false) => {
        return (
            <div key={`comment-${comment.comment_id}`} className={`comment-item ${isPopularBadge ? 'popular-highlight' : ''}`}>
                <div className="comment-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                        {isPopularBadge && <span className="best-badge">🔥 베스트</span>}
                        <span className="comment-author">
                            {comment.author_name}
                            {isAdmin && comment.is_anonymous && (
                                <span style={{ marginLeft: '6px', fontSize: '12px', color: '#ff4d4f' }}>
                                    {tracedAuthors[comment.comment_id] ? (
                                        `[이름(ID): ${tracedAuthors[comment.comment_id]}]`
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleTraceCommentAuthor(comment.comment_id)}
                                            style={{ background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer', padding: '2px 5px', fontSize: '11px' }}
                                        >
                                            작성자 조회
                                        </button>
                                    )}
                                </span>
                            )}
                        </span>
                        <span className="comment-date">{comment.created_at}</span>
                    </div>

                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => handleAdminCommentDelete(comment.comment_id)}
                            style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '12px' }}
                        >
                            강제 삭제
                        </button>
                    )}
                </div>

                <div className="comment-body">
                    {comment.content}
                </div>


                <div className="comment-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                    <button
                        type="button"
                        className={`comment-like ${comment.is_liked ? 'liked' : ''}`}
                        onClick={() => handleCommentLike(comment.comment_id)}
                    >
                        ❤️ {comment.likes_count || 0}
                    </button>

                    {/* 원댓글인 경우에만 답글 버튼 표시 (대댓글의 대댓글 제한) */}
                    {!comment.parent_id && !isPopularBadge && (
                        <button
                            type="button"
                            onClick={() => setReplyingTo(comment.comment_id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#666', padding: '0' }}
                        >
                            ↳ 답글 달기
                        </button>
                    )}
                </div>
            </div>
        );
    };

    if (isLoading) return <div className="loading">게시글 로딩 중...</div>;

    return (
        <div className="post-detail-container">
            <div className="toolbar">
                <button type="button" onClick={() => navigate(-1)} className="back-button">← 목록으로</button>
            </div>

            {error ? (
                <div className="error-message">{error}</div>
            ) : post ? (
                <>
                    {/* 게시글 영역 */}
                    <div className="post-card">
                        <h2 className="post-title">{post.title}</h2>
                        <div className="post-meta">
                            <span className="author">
                                {post.author}
                                {isAdmin && post.is_anonymous && (
                                    <span style={{ marginLeft: '8px', color: '#ff4d4f', fontSize: '13px' }}>
                                        {tracedPostAuthor ? (
                                            `[이름(ID): ${tracedPostAuthor}]`
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleTracePostAuthor}
                                                style={{ background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer', padding: '2px 5px' }}
                                            >
                                                작성자 조회
                                            </button>
                                        )}
                                    </span>
                                )}
                            </span>
                            <span className="date">{post.createdAt}</span>
                        </div>
                        <hr className="divider" />

                        <div className="post-content">
                            {post.content.split('\n').map((line, i) => (
                                <React.Fragment key={i}>{line}<br /></React.Fragment>
                            ))}
                        </div>

                        <div className="post-actions" style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={handlePostLike}
                                className={`post-like-btn ${post.is_liked ? 'liked' : ''}`}
                            >
                                {post.is_liked ? '❤️' : '🤍'} 공감 {post.likes}
                            </button>

                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={handleAdminPostDelete}
                                    style={{ background: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', padding: '0 12px', cursor: 'pointer', fontSize: '14px' }}
                                >
                                    🗑️ 강제 삭제
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 댓글 영역 */}
                    <div className="comments-section">
                        {topPopularComments.length > 0 && (
                            <div className="popular-comments-container">
                                <h3 className="popular-title">🔥 실시간 인기 댓글</h3>
                                {topPopularComments.map(comment => renderCommentItem(comment, true))}
                            </div>
                        )}

                        <div className="comments-header-row">
                            <h3 className="comments-title">전체 댓글 ({comments.length})</h3>

                            <div className="sort-controls">
                                <button
                                    type="button"
                                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                    className="sort-order-btn"
                                    title={sortOrder === 'desc' ? '내림차순' : '오름차순'}
                                >
                                    {sortOrder === 'desc' ? <SortDownIcon /> : <SortUpIcon />}
                                </button>
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

                        <div className="comments-list">
                            {processedComments.length > 0 ? (
                                processedComments.map(comment => (
                                    <div key={comment.comment_id} className="comment-thread">
                                        {renderCommentItem(comment)}
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

                        <form onSubmit={handleCommentSubmit} className="comment-form">

                            {replyingTo && (
                                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#0056b3', display: 'flex', alignItems: 'center' }}>
                                    <span>원댓글에 답글을 작성 중입니다.</span>
                                    <button
                                        type="button"
                                        onClick={() => setReplyingTo(null)}
                                        style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        ✕ 취소
                                    </button>
                                </div>
                            )}
                            <div className="comment-input-wrapper">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder={replyingTo ? "대댓글을 입력하세요" : "댓글을 입력하세요"}
                                    className="comment-input"
                                />
                                <div className="comment-options">
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