import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { useOfflineData } from "../hooks/useOfflineData";
import "./PostListPage.css";

// =========================================
// 🔧 유틸리티: 상대 시간 계산 (분/시간/일/달/년)
// =========================================
function formatTimeAgo(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diff = (now - date) / 1000;

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
  const navigate = useNavigate(); // 라우팅을 위한 useNavigate 훅
  const [posts, setPosts] = useState([]);
  const [currentPage, setCurrentPage] = useState(
    () => Number(sessionStorage.getItem("board_page")) || 1,
  );
  const [searchTerm, setSearchTerm] = useState(
    () => sessionStorage.getItem("board_search") || "",
  );
  const [sortOrder, setSortOrder] = useState(
    () => sessionStorage.getItem("board_sort") || "latest",
  );

  const isAdmin = localStorage.getItem("eta_admin") === "true";

  // 상태 변경 시 sessionStorage에 저장
  useEffect(() => {
    sessionStorage.setItem("board_page", currentPage);
    sessionStorage.setItem("board_search", searchTerm);
    sessionStorage.setItem("board_sort", sortOrder);
  }, [currentPage, searchTerm, sortOrder]);

  // 🌟 API 연동 및 오프라인 캐시
  const fetchPosts = async () => {
    const params = { page: 1, limit: 100 };
    const response = await axios.get(`${API_BASE_URL}/posts`, {
      params,
      withCredentials: true,
    });

    if (response.data && response.data.data && response.data.data.posts) {
      return response.data.data.posts.map((post) => ({
        id: post.post_id,
        title: post.title,
        content: post.content_preview || "내용이 없습니다.",
        likes: post.likes_count || 0,
        commentCount: post.comment_count || 0,
        author: post.is_anonymous ? "익명" : post.author_name || "알 수 없음",
        createdAt: post.created_at,
        is_deleted: post.is_deleted || false,
      }));
    }
    return [];
  };

  const { data: cachedPosts, isStale } = useOfflineData(
    "board_posts_false",
    fetchPosts,
    { store: "posts" },
  );

  useEffect(() => {
    if (cachedPosts) {
      setPosts(Array.isArray(cachedPosts) ? cachedPosts : []);
    }
  }, [cachedPosts]);

  const topHotPosts = useMemo(() => {
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const todayKST = new Date(now.getTime() + kstOffset);
    todayKST.setUTCHours(0, 0, 0, 0);

    return [...posts]
      .filter((post) => {
        const postDate = new Date(
          new Date(post.createdAt).getTime() + kstOffset,
        );
        postDate.setUTCHours(0, 0, 0, 0);
        return (
          post.likes >= HOT_LIKE_THRESHOLD &&
          postDate.getTime() === todayKST.getTime()
        );
      })
      .sort((a, b) => b.likes - a.likes)
      .slice(0, HOT_POST_LIMIT);
  }, [posts]);

  const topHotIds = useMemo(() => topHotPosts.map((p) => p.id), [topHotPosts]);

  const processedPosts = useMemo(() => {
    let result = [...posts];

    if (searchTerm) {
      result = result.filter(
        (post) =>
          post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          post.content.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (sortOrder === "popular") {
      result.sort((a, b) => b.likes - a.likes);
    } else {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return result;
  }, [posts, searchTerm, sortOrder]);

  const indexOfLastPost = currentPage * POSTS_PER_PAGE;
  const indexOfFirstPost = indexOfLastPost - POSTS_PER_PAGE;
  const currentPosts = processedPosts.slice(indexOfFirstPost, indexOfLastPost);
  const totalPages = Math.ceil(processedPosts.length / POSTS_PER_PAGE);

  const isMounted = useRef(false);
  useEffect(() => {
    if (isMounted.current) {
      setCurrentPage(1);
    } else {
      isMounted.current = true;
    }
  }, [searchTerm, sortOrder]);

  // 브라우저 기본 스크롤 복원 비활성화
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  // 게시글 데이터를 불러온 뒤, 이전 스크롤 위치가 있으면 복구
  // AnimatePresence 애니메이션이 끝난 뒤 DOM 높이가 충분해질 때까지 재시도
  // 게시글 데이터를 불러온 뒤, 이전 스크롤 위치가 있으면 복구
  const scrollRestoredRef = useRef(false);
  useEffect(() => {
    if (scrollRestoredRef.current) return;
    if (currentPosts.length === 0) return;

    const savedScroll = sessionStorage.getItem("board_scroll");
    if (!savedScroll) return;

    const targetScroll = parseInt(savedScroll, 10);
    if (isNaN(targetScroll) || targetScroll <= 0) {
      sessionStorage.removeItem("board_scroll");
      return;
    }

    // 즉시 스크롤 시도 (DOM이 렌더링된 상태라면 바로 적용됨)
    window.scrollTo(0, targetScroll);

    // 애니메이션(0.3s)이 완료된 후 혹시나 스크롤이 풀렸을 경우를 대비해 한번 더 시도
    const timer = setTimeout(() => {
      window.scrollTo(0, targetScroll);
      sessionStorage.removeItem("board_scroll");
      scrollRestoredRef.current = true;
    }, 350);

    return () => clearTimeout(timer);
  }, [currentPosts]);

  // 게시글 클릭 시 상세 페이지로 이동하면서 스크롤 위치 저장
  const handlePostClick = (postId) => {
    sessionStorage.setItem("board_scroll", window.scrollY);
    navigate(`/post/${postId}`);
  };

  return (
    <div className="board-container">
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
        {/* 글쓰기 버튼 클릭 시 라우팅 적용 */}
        <button className="write-btn" onClick={() => navigate("/postWrite")}>
          ✏️ 글쓰기
        </button>
      </div>

      {topHotPosts.length > 0 && (
        <section className="hot-section">
          <h3 className="section-title">🔥 실시간 HOT 게시글</h3>
          <div className="hot-grid">
            {topHotPosts.map((post) => (
              <div
                key={post.id}
                className="hot-card-top"
                onClick={() => handlePostClick(post.id)}
                style={{ cursor: "pointer" }}
              >
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

      <section className="general-section">
        <div className="list-header">
          <h3 className="section-title">
            전체 게시글{" "}
            {isStale && (
              <span
                className="stale-badge"
                style={{
                  fontSize: "10px",
                  color: "#666",
                  background: "#eee",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  verticalAlign: "middle",
                  marginLeft: "6px",
                }}
              >
                오프라인
              </span>
            )}
          </h3>
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
            currentPosts.map((post) => {
              const isRealHot = topHotIds.includes(post.id);
              const isPopular = !isRealHot && post.likes >= HOT_LIKE_THRESHOLD;
              const isLatestMode = sortOrder === "latest";
              const cardClassName = `post-card ${isRealHot && isLatestMode ? "hot-highlight" : ""} ${post.is_deleted ? "deleted-post-card" : ""}`;

              return (
                <div
                  key={post.id}
                  className={cardClassName}
                  onClick={() => handlePostClick(post.id)}
                  style={{ cursor: "pointer" }}
                >
                  <h4 className="post-title">
                    {post.is_deleted && (
                      <span className="deleted-post-badge">삭제됨</span>
                    )}
                    {isRealHot && <span className="badge badge-hot">HOT</span>}
                    {isPopular && (
                      <span className="badge badge-popular">인기</span>
                    )}
                    {post.title}
                  </h4>

                  <div className="post-meta">
                    <div className="meta-left">
                      <span className="author">{post.author}</span>
                      <span className="date">
                        {formatTimeAgo(post.createdAt)}
                      </span>
                    </div>
                    <div className="meta-right">
                      <span className="comments">💬 {post.commentCount}</span>
                      <span
                        className={`likes ${isRealHot ? "likes-hot" : isPopular ? "likes-pop" : ""}`}
                      >
                        ❤️ {post.likes}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <p>게시글이 존재하지 않습니다 🥲</p>
            </div>
          )}
        </div>
      </section>

      {totalPages > 0 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={currentPage === 1}
            className="page-btn"
          >
            &lt;
          </button>
          <span className="page-info">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={currentPage === totalPages}
            className="page-btn"
          >
            &gt;
          </button>
        </div>
      )}
    </div>
  );
}
