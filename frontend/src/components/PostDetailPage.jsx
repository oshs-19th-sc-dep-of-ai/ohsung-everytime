import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from "../config";
import { useToast } from '../contexts/ToastContext.jsx';
import { useNetwork } from '../contexts/NetworkContext.jsx';
import { offlineQueue } from '../utils/offlineQueue.js';
import { useOfflineData } from '../hooks/useOfflineData.js';
import { GifPicker } from './GifPicker.jsx';
import { renderContentWithGifs } from '../utils/renderContentWithGifs.jsx';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [showCommentGifPicker, setShowCommentGifPicker] = useState(false);
    const quillRef = useRef(null);
    const hoveredImgRef = useRef(null);
    const [hoveredImgState, setHoveredImgState] = useState(null);

    const [replyingTo, setReplyingTo] = useState(null);

    // [관리자 전용] 익명 게시글/댓글 작성자 추적 내역 상태 관리
    const [tracedPostAuthor, setTracedPostAuthor] = useState(null);
    const [tracedAuthors, setTracedAuthors] = useState({});

    // 정렬 관련 상태
    const [sortType, setSortType] = useState('latest');
    const [sortOrder, setSortOrder] = useState('desc');

    const { showToast } = useToast();
    const { isOnline } = useNetwork();

    // 관리자(모더레이터) 여부 확인 (이제 eta_admin이 true인 경우만 관리자 기능을 사용할 수 있음)
    const isAdmin = localStorage.getItem("eta_admin") === "true";

    // 관리자 삭제된 항목 보기 토글
    const [showDeleted, setShowDeleted] = useState(() => {
        return localStorage.getItem("show_deleted") === "true";
    });

    const fetchPostDetails = async () => {
        const params = {};
        if (isAdmin && showDeleted) params.include_deleted = 'true';
        const queryStr = new URLSearchParams(params).toString();
        const suffix = queryStr ? `?${queryStr}` : '';

        const [postRes, commentsRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/posts/${postId}${suffix}`, { withCredentials: true }),
            axios.get(`${API_BASE_URL}/posts/${postId}/comments${suffix}`, { withCredentials: true })
        ]);
        
        let pData = null;
        let cData = [];
        
        if (postRes.data && postRes.data.data) {
            const p = postRes.data.data;
            pData = {
                id: p.post_id,
                title: p.title,
                content: p.content || "",
                author: p.author_name,
                createdAt: p.created_at,
                likes: p.likes_count || 0,
                is_liked: p.is_liked || false,
                is_anonymous: p.is_anonymous,
                is_mine: p.is_mine || false,
                is_deleted: p.is_deleted || false,
            };
        }
        
        if (commentsRes.data && commentsRes.data.data) {
            cData = commentsRes.data.data;
        }
        
        return { post: pData, comments: cData };
    };

    const { data: cachedDetails, isStale, loading: isCachedLoading, error: cachedError, refetch } = useOfflineData(`post_${postId}_${showDeleted}`, fetchPostDetails, { store: 'postDetails' });

    useEffect(() => {
        if (cachedDetails) {
            setPost(cachedDetails.post);
            setComments(cachedDetails.comments);
        }
    }, [cachedDetails]);

    useEffect(() => {
        if (cachedError) {
            if (cachedError.response?.status === 401) {
                setError("로그인이 필요한 페이지입니다.");
            } else {
                setError("게시글 데이터를 불러오는 데 실패했습니다. 오프라인 상태일 수 있습니다.");
            }
        } else {
            setError(null);
        }
    }, [cachedError]);

    useEffect(() => {
        setIsLoading(isCachedLoading && !cachedDetails);
    }, [isCachedLoading, cachedDetails]);

    useEffect(() => {
        const handleMouseOver = (e) => {
            if (e.target.tagName === 'IMG' && e.target.closest('.ql-editor')) {
                const rect = e.target.getBoundingClientRect();
                const newData = {
                    element: e.target,
                    top: rect.top + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width
                };
                hoveredImgRef.current = newData;
                setHoveredImgState(newData);
            }
        };
        const handleMouseMove = (e) => {
            if (hoveredImgRef.current) {
                const isOverImg = e.target === hoveredImgRef.current.element;
                const isOverBtn = e.target.closest('.gif-delete-btn');
                if (!isOverImg && !isOverBtn) {
                    hoveredImgRef.current = null;
                    setHoveredImgState(null);
                }
            }
        };

        document.addEventListener('mouseover', handleMouseOver);
        document.addEventListener('mousemove', handleMouseMove);
        return () => {
            document.removeEventListener('mouseover', handleMouseOver);
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    const handleDeleteImage = (e, targetQuillRef, setter) => {
        if (!hoveredImgState || !targetQuillRef.current) return;
        const editor = targetQuillRef.current.getEditor();
        
        const QuillObj = ReactQuill.Quill || window.Quill;
        if (QuillObj) {
            const blot = QuillObj.find(hoveredImgState.element);
            if (blot) {
                const offset = editor.getIndex(blot);
                editor.deleteText(offset, 1);
            }
        } else {
            hoveredImgState.element.remove();
            setter(editor.root.innerHTML);
        }
        
        setHoveredImgState(null);
        hoveredImgRef.current = null;
    };

    useEffect(() => {
        // 즉시 맨 위로 스크롤
        window.scrollTo(0, 0); 
        
        // 애니메이션(0.3s)이 완료된 후 혹시나 스크롤이 유지되는 경우를 대비해 한번 더 시도
        const timer = setTimeout(() => {
            window.scrollTo(0, 0);
        }, 350);

        return () => {
            clearTimeout(timer);
        };
    }, []);

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

        if (!isOnline) {
            await offlineQueue.enqueue({
                url: `${API_BASE_URL}/posts/${postId}/like`,
                method: 'POST'
            });
            showToast("오프라인 상태입니다. 온라인 복귀 시 좋아요가 반영됩니다.");
            // 낙관적 UI 업데이트
            setPost(prev => ({
                ...prev,
                likes: prev.is_liked ? prev.likes - 1 : prev.likes + 1,
                is_liked: !prev.is_liked
            }));
            return;
        }

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
            if (err.response?.status === 401) showToast("로그인이 필요합니다.");
            else showToast("게시글 좋아요 처리에 실패했습니다.");
        }
    };

    const handleAdminPostDelete = async () => {
        const confirmDelete = window.confirm("관리자 권한으로 이 게시글을 정말로 '강제 삭제'하시겠습니까?");
        if (!confirmDelete) return;

        try {
            await axios.delete(`${API_BASE_URL}/admin/posts/${postId}`, { withCredentials: true });
            showToast("게시글이 강제 삭제되었습니다.");
            navigate(-1);
        } catch (err) {
            showToast(err.response?.data?.message || "게시글 삭제에 실패했습니다.");
        }
    };

    const handlePostDelete = async () => {
        const confirmDelete = window.confirm("이 게시글을 정말로 삭제하시겠습니까?");
        if (!confirmDelete) return;

        try {
            await axios.delete(`${API_BASE_URL}/posts/${postId}`, { withCredentials: true });
            showToast("게시글이 삭제되었습니다.");
            navigate(-1);
        } catch (err) {
            showToast(err.response?.data?.message || "게시글 삭제에 실패했습니다.");
        }
    };

    const handleCommentDelete = async (commentId) => {
        const confirmDelete = window.confirm("이 댓글을 정말로 삭제하시겠습니까?");
        if (!confirmDelete) return;

        try {
            await axios.delete(`${API_BASE_URL}/comments/${commentId}`, { withCredentials: true });
            showToast("댓글이 삭제되었습니다.");
            refetch();
        } catch (err) {
            showToast(err.response?.data?.message || "댓글 삭제에 실패했습니다.");
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
            showToast(err.response?.data?.message || "게시글 작성자 조회에 실패했습니다.");
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || newComment === '<p><br></p>' || isSubmitting) return;

        if (!isOnline) {
            await offlineQueue.enqueue({
                url: `${API_BASE_URL}/posts/${postId}/comments`,
                method: 'POST',
                body: {
                    content: newComment,
                    is_anonymous: isAnonymous,
                    parent_id: replyingTo
                }
            });
            setNewComment("");
            setReplyingTo(null);
            showToast("오프라인 상태입니다. 큐에 저장되어 온라인 복귀 시 댓글이 등록됩니다.");
            return;
        }

        try {
            setIsSubmitting(true);
            await axios.post(`${API_BASE_URL}/posts/${postId}/comments`, {
                content: newComment,
                is_anonymous: isAnonymous,
                parent_id: replyingTo
            }, { withCredentials: true });

            setNewComment("");
            setReplyingTo(null); // 전송 후 상태 초기화
            showToast("댓글이 작성되었습니다.");

            refetch();
        } catch (err) {
            if (err.response?.status === 401) showToast("로그인이 필요합니다.");
            else showToast(err.response?.data?.message || "댓글 작성에 실패했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCommentLike = async (commentId) => {
        if (!isOnline) {
            await offlineQueue.enqueue({
                url: `${API_BASE_URL}/comments/${commentId}/like`,
                method: 'POST'
            });
            showToast("오프라인 상태입니다. 온라인 복귀 시 좋아요가 반영됩니다.");
            // 낙관적 UI 업데이트 (간단히 처리)
            setComments(prev => {
                const updateLike = (list) => {
                    return list.map(c => {
                        if (c.comment_id === commentId) {
                            return { ...c, likes_count: (c.likes_count || 0) + (c.is_liked ? -1 : 1), is_liked: !c.is_liked };
                        }
                        if (c.replies) {
                            return { ...c, replies: updateLike(c.replies) };
                        }
                        return c;
                    });
                };
                return updateLike(prev);
            });
            return;
        }

        try {
            const res = await axios.post(`${API_BASE_URL}/comments/${commentId}/like`, {}, { withCredentials: true });
            if (res.data.status === 'success') {
                refetch();
            }
        } catch (err) {
            if (err.response?.status === 401) showToast("로그인이 필요합니다.");
            else showToast("좋아요 처리에 실패했습니다.");
        }
    };

    const handleAdminCommentDelete = async (commentId) => {
        const confirmDelete = window.confirm("⚠️ 관리자 권한으로 이 댓글을 강제 삭제하시겠습니까?");
        if (!confirmDelete) return;

        try {
            await axios.delete(`${API_BASE_URL}/admin/comments/${commentId}`, { withCredentials: true });
            showToast("댓글이 강제 삭제되었습니다.");
            refetch();
        } catch (err) {
            showToast(err.response?.data?.message || "댓글 삭제에 실패했습니다.");
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
            showToast(err.response?.data?.message || "작성자 조회에 실패했습니다.");
        }
    };

    const renderCommentItem = (comment, isPopularBadge = false) => {
        const isDeleted = comment.is_deleted;
        return (
            <div key={`comment-${comment.comment_id}`} className={`comment-item ${isPopularBadge ? 'popular-highlight' : ''} ${isDeleted ? 'deleted-item' : ''}`}>
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
                        {isDeleted && <span className="deleted-badge">삭제됨</span>}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* 본인 댓글 삭제 버튼 */}
                        {comment.is_mine && !isDeleted && (
                            <button
                                type="button"
                                onClick={() => handleCommentDelete(comment.comment_id)}
                                style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '12px' }}
                            >
                                삭제
                            </button>
                        )}
                        {/* 관리자 강제 삭제 버튼 */}
                        {isAdmin && !isDeleted && (
                            <button
                                type="button"
                                onClick={() => handleAdminCommentDelete(comment.comment_id)}
                                style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '12px' }}
                            >
                                강제 삭제
                            </button>
                        )}
                    </div>
                </div>

                <div className="comment-body">
                    {renderContentWithGifs(comment.content)}
                </div>


                {!isDeleted && (
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
                )}
            </div>
        );
    };

    const commentInputForm = (isReplyForm) => (
        <form onSubmit={handleCommentSubmit} className={`comment-form ${isReplyForm ? 'reply-mode' : ''}`}>
            {isReplyForm && (
                <div style={{ marginBottom: '8px', fontSize: '13px', color: '#0056b3', display: 'flex', alignItems: 'center' }}>
                    <span>원댓글에 답글을 작성 중입니다.</span>
                    <button
                        type="button"
                        onClick={() => {
                            setReplyingTo(null);
                            setNewComment("");
                        }}
                        style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        ✕ 취소
                    </button>
                </div>
            )}
            <div className="comment-form-inner" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="comment-input-wrapper" style={{ padding: '4px 16px' }}>
                    <ReactQuill
                        ref={quillRef}
                        theme="snow"
                        value={newComment}
                        onChange={setNewComment}
                        placeholder={isReplyForm ? "대댓글을 입력하세요" : "댓글을 입력하세요"}
                        modules={{ toolbar: false }}
                        style={{ flex: 1, minWidth: 0, border: 'none' }}
                        className="comment-quill"
                    />
                    <button 
                        type="button"
                        onClick={() => setShowCommentGifPicker(true)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                        title="GIF 추가"
                    >
                        <img src="/gif_box.svg" alt="GIF" width="22" height="22" style={{ opacity: 0.7 }} />
                    </button>
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
                        <button type="submit" className="comment-submit" disabled={isSubmitting}>
                            {isSubmitting ? '등록 중...' : '등록'}
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );

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
                        <h2 className={`post-title ${post.is_deleted ? 'deleted-post-title' : ''}`}>
                            {post.is_deleted && <span className="deleted-badge">삭제됨</span>}
                            {post.title}
                            {isStale && <span className="stale-badge" style={{ fontSize: '11px', color: '#666', background: '#eee', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle', marginLeft: '8px' }}>오프라인 데이터</span>}
                        </h2>
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
                            {renderContentWithGifs(post.content)}
                        </div>

                        <div className="post-actions" style={{ display: 'flex', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={handlePostLike}
                                className={`post-like-btn ${post.is_liked ? 'liked' : ''}`}
                            >
                                {post.is_liked ? '❤️' : '🤍'} 공감 {post.likes}
                            </button>

                            {/* 본인 게시글 삭제 버튼 */}
                            {post.is_mine && !post.is_deleted && (
                                <button
                                    type="button"
                                    onClick={handlePostDelete}
                                    style={{ background: '#f5f5f5', color: '#666', border: '1px solid #ddd', borderRadius: '20px', padding: '0 16px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
                                >
                                    🗑️ 삭제
                                </button>
                            )}

                            {isAdmin && !post.is_deleted && (
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

                                        {/* 대댓글 입력창 위치 */}
                                        {replyingTo === comment.comment_id && (
                                            <div className="reply-form-container" style={{ marginLeft: '32px', marginBottom: '16px' }}>
                                                {commentInputForm(true)}
                                            </div>
                                        )}

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

                        {/* 메인 댓글 입력창 */}
                        {!replyingTo && commentInputForm(false)}
                    </div>
                </>
            ) : (
                <div className="error-message">게시글이 존재하지 않습니다.</div>
            )}
            
            <GifPicker
                isOpen={showCommentGifPicker}
                onClose={() => setShowCommentGifPicker(false)}
                onSelect={(gifUrl) => {
                    if (quillRef.current) {
                        const quill = quillRef.current.getEditor();
                        const range = quill.getSelection(true);
                        const index = range ? range.index : quill.getLength();
                        quill.insertText(index, '\n');
                        quill.insertEmbed(index + 1, 'image', gifUrl);
                        quill.insertText(index + 2, '\n');
                        quill.setSelection(index + 3);
                    }
                    setShowCommentGifPicker(false);
                }}
            />

            {hoveredImgState && (
                <button
                    type="button"
                    className="gif-delete-btn"
                    onClick={(e) => handleDeleteImage(e, quillRef, setNewComment)}
                    style={{
                        position: 'absolute',
                        top: hoveredImgState.top + 4,
                        left: hoveredImgState.left + hoveredImgState.width - 36,
                        zIndex: 9999,
                        background: '#ffffff',
                        color: '#ff4d4f',
                        border: '1px solid #eee',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        fontWeight: 'bold'
                    }}
                >
                    ✕
                </button>
            )}
        </div>
    );
}
