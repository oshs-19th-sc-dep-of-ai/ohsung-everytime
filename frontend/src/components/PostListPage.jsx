import { useState, useEffect } from 'react';
import './PostListPage.css';

// =========================================
// 🔧 게시판 설정
// =========================================
const HOT_LIKE_THRESHOLD = 40;  // 🔥 이 개수 넘으면 리스트에서도 강조됨
const HOT_POST_LIMIT = 2;       // 상단 '실시간 인기글' 섹션에 띄울 개수
const POSTS_PER_PAGE = 10;
// =========================================

export function PostListPage() {
    const [posts, setPosts] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        // 더미 데이터 (테스트용)
        const mockPosts = Array.from({ length: 30 }, (_, i) => ({
            id: i + 1,
            title: i % 2 === 0 ? `오성고 급식 질문합니다 ${i+1}` : `체육대회 반티 추천좀 ${i+1}`,
            content: `이 글은 ${i+1}번째 게시글입니다. 내용이 길어지면 자동으로 말줄임표 처리됩니다.`,
            likes: i === 2 ? 120 : (i === 5 ? 95 : (i === 10 ? 80 : Math.floor(Math.random() * 40))),
            commentCount: Math.floor(Math.random() * 20),
            author: `익명${i+1}`,
            createdAt: "2024-05-20"
        })).reverse();

        setPosts(mockPosts);
    }, []);

    // 1. 상단 인기글 섹션용 (최상위 3개)
    const hotPosts = posts
        .filter(post => post.likes >= HOT_LIKE_THRESHOLD)
        .sort((a, b) => b.likes - a.likes)
        .slice(0, HOT_POST_LIMIT);

    // 2. 일반 리스트용 (전체 글)
    const normalPosts = posts;

    const indexOfLastPost = currentPage * POSTS_PER_PAGE;
    const indexOfFirstPost = indexOfLastPost - POSTS_PER_PAGE;
    const currentPosts = normalPosts.slice(indexOfFirstPost, indexOfLastPost);
    const totalPages = Math.ceil(normalPosts.length / POSTS_PER_PAGE);

    // 껍데기 함수들
    const handleSearch = () => alert(`"${searchTerm}" 검색`);
    const handleWrite = () => alert("글쓰기 페이지 이동");
    const handleNextPage = () => currentPage < totalPages && setCurrentPage(p => p + 1);
    const handlePrevPage = () => currentPage > 1 && setCurrentPage(p => p - 1);

    return (
        <div className="board-container">
            <div className="board-toolbar">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="글 제목, 내용 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button onClick={handleSearch}>검색</button>
                </div>
                <button className="write-btn" onClick={handleWrite}>✏️ 새 글 쓰기</button>
            </div>

            {/* 🔥 상단 인기글 섹션 */}
            {hotPosts.length > 0 && (
                <section className="hot-section">
                    <h3 className="section-title">🔥 실시간 인기글</h3>
                    <div className="post-list hot-list">
                        {hotPosts.map(post => (
                            <div key={post.id} className="post-card hot-card-top">
                                <div className="card-top">
                                    <span className="badge-hot">HOT</span>
                                    <h4 className="post-title">{post.title}</h4>
                                </div>
                                <p className="post-preview">{post.content}</p>
                                <div className="post-meta">
                                    <span className="author">{post.author}</span>
                                    <div className="meta-right">
                                        <span className="comments">💬 {post.commentCount}</span>
                                        <span className="likes">🔥 {post.likes}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 📝 전체 게시글 리스트 */}
            <section className="general-section">
                <h3 className="section-title">전체 게시글</h3>
                <div className="post-list">
                    {currentPosts.map(post => {
                        // ✨ 이 글이 인기글 기준을 넘는지 확인
                        const isHot = post.likes >= HOT_LIKE_THRESHOLD;

                        return (
                            <div
                                key={post.id}
                                // 인기글이면 'hot-highlight' 클래스 추가
                                className={`post-card ${isHot ? 'hot-highlight' : ''}`}
                            >
                                <h4 className="post-title">
                                    {/* 인기글이면 제목 옆에 작은 HOT 뱃지 표시 */}
                                    {isHot && <span className="small-hot-badge">HOT</span>}
                                    {post.title}
                                </h4>
                                <p className="post-preview">{post.content}</p>
                                <div className="post-meta">
                                    <span className="author">{post.author}</span>
                                    <div className="meta-right">
                                        <span className="comments">💬 {post.commentCount}</span>
                                        <span className="likes">
                                            {/* 인기글이면 하트 아이콘 변경 */}
                                            {isHot ? '🔥' : '👍'} {post.likes}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <div className="pagination">
                <button onClick={handlePrevPage} disabled={currentPage === 1} className="page-btn">
                    &lt; 이전
                </button>
                <span className="page-info">{currentPage} / {totalPages}</span>
                <button onClick={handleNextPage} disabled={currentPage === totalPages} className="page-btn">
                    다음 &gt;
                </button>
            </div>
        </div>
    );
}