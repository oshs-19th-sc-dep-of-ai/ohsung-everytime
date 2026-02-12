import { useState, useEffect, useMemo } from 'react';
import './PostListPage.css';

// =========================================
// 🔧 유틸리티: 상대 시간 계산 (분/시간/일/달/년)
// =========================================
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now - date) / 1000; // 초 단위 차이

    if (diff < 60) return "방금 전";
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(diff / 3600);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(diff / 86400);
    if (days < 30) return `${days}일 전`;
    const months = Math.floor(diff / 2592000);
    if (months < 12) return `${months}달 전`;
    const years = Math.floor(diff / 31536000);
    return `${years}년 전`;
}

// =========================================
// 🔧 게시판 설정
// =========================================
const HOT_LIKE_THRESHOLD = 40;
const HOT_POST_LIMIT = 2;
const POSTS_PER_PAGE = 10;
// =========================================

export function PostListPage() {
    const [posts, setPosts] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState('latest');

    useEffect(() => {
        // 테스트 데이터 생성 (시간 차이를 다양하게 설정)
        const mockPosts = Array.from({ length: 50 }, (_, i) => {
            const now = new Date();
            // i가 커질수록 더 과거의 시간으로 설정 (테스트용)
            // 0~5: 분 단위, 6~15: 시간 단위, 16~: 일 단위
            let pastTime;
            if (i < 5) pastTime = new Date(now.getTime() - i * 1000 * 60 * 5); // 5분씩 차이
            else if (i < 15) pastTime = new Date(now.getTime() - i * 1000 * 60 * 60); // 1시간씩 차이
            else pastTime = new Date(now.getTime() - i * 1000 * 60 * 60 * 24); // 1일씩 차이

            return {
                id: i + 1,
                title: i % 3 === 0 ? `급식 메뉴 추천좀요 ${i + 1}` : `수학 수행평가 범위 ${i + 1}`,
                content: `내용 미리보기입니다. ${i + 1}`,
                likes: i === 49 ? 120 : (i === 48 ? 110 : Math.floor(Math.random() * 60)),
                commentCount: Math.floor(Math.random() * 20),
                author: `익명${i + 1}`,
                createdAt: pastTime.toISOString() // 과거 시간 입력
            };
        }).reverse(); // 최신순 정렬

        setPosts(mockPosts);
    }, []);

    // 1. 👑 최상위 HOT 게시글 (Top N)
    const topHotPosts = useMemo(() => {
        return [...posts]
            .filter(post => post.likes >= HOT_LIKE_THRESHOLD)
            .sort((a, b) => b.likes - a.likes)
            .slice(0, HOT_POST_LIMIT);
    }, [posts]);

    const topHotIds = useMemo(() => topHotPosts.map(p => p.id), [topHotPosts]);

    // 2. 리스트 필터링 및 정렬
    const processedPosts = useMemo(() => {
        let result = [...posts];

        if (searchTerm) {
            result = result.filter(post =>
                post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                post.content.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (sortOrder === 'popular') {
            result.sort((a, b) => b.likes - a.likes);
        } else {
            // 최신순 (createdAt 기준 내림차순)
            result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        return result;
    }, [posts, searchTerm, sortOrder]);

    // 페이지네이션
    const indexOfLastPost = currentPage * POSTS_PER_PAGE;
    const indexOfFirstPost = indexOfLastPost - POSTS_PER_PAGE;
    const currentPosts = processedPosts.slice(indexOfFirstPost, indexOfLastPost);
    const totalPages = Math.ceil(processedPosts.length / POSTS_PER_PAGE);

    useEffect(() => setCurrentPage(1), [searchTerm, sortOrder]);

    return (
        <div className="board-container">
            {/* 툴바 */}
            <div className="board-toolbar">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="제목, 내용 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="write-btn">✏️ 글쓰기</button>
            </div>

            {/* 👑 상단 고정 HOT 섹션 */}
            {topHotPosts.length > 0 && (
                <section className="hot-section">
                    <h3 className="section-title">🔥 실시간 HOT 게시글</h3>
                    <div className="hot-grid">
                        {topHotPosts.map(post => (
                            <div key={post.id} className="hot-card-top">
                                <div className="hot-badge-top">HOT</div>
                                <h4 className="post-title">{post.title}</h4>
                                <div className="post-meta-simple">
                                    <span>{post.author}</span>
                                    <span className="accent-text">❤️ {post.likes}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 📝 게시글 리스트 */}
            <section className="general-section">
                <div className="list-header">
                    <h3 className="section-title">전체 게시글</h3>
                    <div className="sort-wrapper">
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="sort-select"
                        >
                            <option value="latest">최신순</option>
                            <option value="popular">인기순</option>
                        </select>
                    </div>
                </div>

                <div className="post-list">
                    {currentPosts.length > 0 ? (
                        currentPosts.map(post => {
                            const isRealHot = topHotIds.includes(post.id);
                            const isPopular = !isRealHot && (post.likes >= HOT_LIKE_THRESHOLD);
                            const isLatestMode = sortOrder === 'latest';
                            const cardClassName = `post-card ${isRealHot && isLatestMode ? 'hot-highlight' : ''}`;

                            return (
                                <div key={post.id} className={cardClassName}>
                                    <h4 className="post-title">
                                        {isRealHot && <span className="badge badge-hot">HOT</span>}
                                        {isPopular && <span className="badge badge-popular">인기</span>}
                                        {post.title}
                                    </h4>

                                    <p className="post-preview">{post.content}</p>

                                    <div className="post-meta">
                                        <div className="meta-left">
                                            <span className="author">{post.author}</span>
                                            {/* 구분선이나 간격이 적용된 시간 표시 */}
                                            <span className="date">{formatTimeAgo(post.createdAt)}</span>
                                        </div>
                                        <div className="meta-right">
                                            <span className="comments">💬 {post.commentCount}</span>
                                            <span className={`likes ${isRealHot ? 'likes-hot' : (isPopular ? 'likes-pop' : '')}`}>
                                                ❤️ {post.likes}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="empty-state"><p>검색 결과가 없어요 🥲</p></div>
                    )}
                </div>
            </section>

            {/* 페이지네이션 */}
            {totalPages > 0 && (
                <div className="pagination">
                    <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="page-btn">&lt;</button>
                    <span className="page-info">{currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="page-btn">&gt;</button>
                </div>
            )}
        </div>
    );
}