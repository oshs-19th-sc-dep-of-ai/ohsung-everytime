import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './PostDetailPage.css';

export function PostDetailPage() {
    // URL에서 :postId 파라미터를 가져옵니다.
    const { postId } = useParams();
    const navigate = useNavigate();

    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");

    // 백엔드 API 연동 전 프론트엔드 UI 테스트용 가짜 데이터 할당
    useEffect(() => {
        // 추후 이 부분에 fetch(`/posts/${postId}`) 코드가 들어갑니다.
        setPost({
            id: postId,
            title: `오성에타 자유게시판 테스트 글 (ID: ${postId})`,
            content: "이곳에 게시글 본문 내용이 들어갑니다.\n백엔드 API가 연동되기 전까지는 이 내용이 보입니다.\n\n프로젝트 화이팅입니다!",
            author: "익명",
            createdAt: "2026-02-20 12:30",
            likes: 5,
        });

        // 추후 이 부분에 fetch(`/posts/${postId}/comments`) 코드가 들어갑니다.
        setComments([
            { comment_id: 1, author_name: "익명1", content: "첫 번째 댓글입니다.", created_at: "2026-02-20 12:35", likes_count: 2 },
            { comment_id: 2, author_name: "익명2", content: "프론트엔드 화면 잘 나오네요!", created_at: "2026-02-20 12:40", likes_count: 0 }
        ]);
    }, [postId]);

    const handleCommentSubmit = (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        // 추후 댓글 작성 API(POST) 연동이 필요합니다.
        alert(`댓글 API 연동 필요: ${newComment}`);
        setNewComment("");
    };

    if (!post) return <div className="loading">로딩 중...</div>;

    return (
        <div className="post-detail-container">
            {/* 상단 툴바 */}
            <div className="toolbar">
                <button onClick={() => navigate(-1)} className="back-button">
                    ← 목록으로
                </button>
            </div>

            {/* 게시글 본문 영역 */}
            <div className="post-card">
                <h2 className="post-title">{post.title}</h2>
                <div className="post-meta">
                    <span className="author">{post.author}</span>
                    <span className="date">{post.createdAt}</span>
                </div>

                <hr className="divider" />

                <div className="post-content">
                    {/* 줄바꿈 문자를 실제 <br /> 태그로 변환하여 렌더링합니다. */}
                    {post.content.split('\n').map((line, i) => (
                        <React.Fragment key={i}>
                            {line}<br />
                        </React.Fragment>
                    ))}
                </div>

                <div className="post-actions">
                    <button className="like-button">❤️ 공감 {post.likes}</button>
                </div>
            </div>

            {/* 댓글 영역 */}
            <div className="comments-section">
                <h3 className="comments-title">댓글</h3>

                <div className="comments-list">
                    {comments.length > 0 ? (
                        comments.map(comment => (
                            <div key={comment.comment_id} className="comment-item">
                                <div className="comment-header">
                                    <span className="comment-author">{comment.author_name}</span>
                                    <span className="comment-date">{comment.created_at}</span>
                                </div>
                                <div className="comment-body">{comment.content}</div>
                                <button className="comment-like">❤️ {comment.likes_count}</button>
                            </div>
                        ))
                    ) : (
                        <div className="empty-comments">댓글이 없습니다.</div>
                    )}
                </div>

                {/* 댓글 작성 폼 */}
                <form onSubmit={handleCommentSubmit} className="comment-form">
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="댓글을 입력하세요 (익명)"
                        className="comment-input"
                    />
                    <button type="submit" className="comment-submit">등록</button>
                </form>
            </div>
        </div>
    );
}