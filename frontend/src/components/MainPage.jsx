import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { messaging } from "../firebase";
import { getToken } from "firebase/messaging";
import { useOfflineData } from "../hooks/useOfflineData";
import "./MainPage.css";

export function MainPage() {
  const navigate = useNavigate();

  const userName = localStorage.getItem("student_name") || "학생";

  const [top3Posts, setTop3Posts] = useState([]);
  const [isInstallable, setIsInstallable] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  const tokenRequestSent = useRef(false);

  useEffect(() => {
    const registerTokenIfGranted = async () => {
      if (tokenRequestSent.current) return;
      tokenRequestSent.current = true;
      if (localStorage.getItem("login") !== "true") return;
      if (!messaging) return;
      if (
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      )
        return;

      try {
        const token = await getToken(messaging, {
          vapidKey:
            "BOxnVSvFhuK-6UD7fXnnGPcoU73mPbXnk5HQcLYTZom6hRoPVnVKc9xEIA7mZsM5ap3HgSz6V9DaU4a1T2TtBao",
        });
        if (token) {
          const response = await fetch(
            `${API_BASE_URL}/notifications/register-token`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
              credentials: "include",
            },
          );
          if (response.ok) {
            console.log("알림 토큰 발급 및 백엔드 전송 성공");
          } else {
            console.error("알림 토큰 백엔드 전송 실패:", response.status);
          }
        }
      } catch (error) {
        console.error("토큰 등록 중 오류:", error);
      }
    };

    registerTokenIfGranted();
  }, []);

  const handleNotificationClick = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);

      if (permission === "granted" && messaging) {
        const token = await getToken(messaging, {
          vapidKey:
            "BOxnVSvFhuK-6UD7fXnnGPcoU73mPbXnk5HQcLYTZom6hRoPVnVKc9xEIA7mZsM5ap3HgSz6V9DaU4a1T2TtBao",
        });
        if (token) {
          const response = await fetch(
            `${API_BASE_URL}/notifications/register-token`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
              credentials: "include",
            },
          );
          if (response.ok) {
            console.log("알림 토큰 발급 및 백엔드 전송 성공");
          }
        }
      }
    } catch (error) {
      console.error("알림 권한 요청 중 오류:", error);
    }
  };

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isStandalone) {
      setIsInstallable(false);
      return;
    }

    if (window.deferredPrompt) {
      setIsInstallable(true);
    }

    const handleReady = () => setIsInstallable(true);
    const handleInstalled = () => setIsInstallable(false);

    window.addEventListener("pwaInstallReady", handleReady);
    window.addEventListener("pwaInstalled", handleInstalled);

    return () => {
      window.removeEventListener("pwaInstallReady", handleReady);
      window.removeEventListener("pwaInstalled", handleInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = window.deferredPrompt;
    if (!promptEvent) return;

    promptEvent.prompt();
    const result = await promptEvent.userChoice;
    if (result.outcome === "accepted") {
      console.log("PWA 설치 완료");
    }
    window.deferredPrompt = null;
    setIsInstallable(false);
  };

  //오늘 날짜 필터 추가
  const fetchTopPosts = async () => {
    const response = await axios.get(`${API_BASE_URL}/posts`, {
      params: { page: 1, limit: 50 },
      withCredentials: true,
    });

    if (response.data && response.data.data && response.data.data.posts) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const fetchedPosts = response.data.data.posts
        .filter((post) => {
          const postDate = new Date(post.created_at);
          postDate.setHours(0, 0, 0, 0);
          return postDate.getTime() === today.getTime();
        })
        .map((post) => ({
          id: post.post_id,
          title: post.title,
          likes: post.likes_count || 0,
          commentCount: post.comment_count || 0,
        }));

      return fetchedPosts
        .sort((a, b) => {
          if (b.likes === a.likes) {
            return b.commentCount - a.commentCount;
          }
          return b.likes - a.likes;
        })
        .slice(0, 3);
    }
    return [];
  };

  const { data: cachedTop3Posts, isStale } = useOfflineData(
    "main-top3",
    fetchTopPosts,
    { store: "posts" },
  );

  useEffect(() => {
    if (cachedTop3Posts) {
      setTop3Posts(Array.isArray(cachedTop3Posts) ? cachedTop3Posts : []);
    }
  }, [cachedTop3Posts]);

  const goMeal = () => navigate("/meal");
  const goPostList = () => navigate("/board");
  const goPostDetail = (e, id) => {
    e.stopPropagation();
    navigate(`/post/${id}`);
  };

  return (
    <div className="app-container">
      <header className="home-header">
        <h1 className="title">
          안녕하세요,
          <span className="highlight"> {userName}</span>님 👋
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

        {isInstallable && (
          <section
            className="menu-card install-section"
            onClick={handleInstallClick}
          >
            <div className="install-icon">📲</div>
            <div className="install-text-group">
              <h2>앱 설치하기</h2>
              <span className="install-desc">
                홈 화면에 추가하여 빠르게 접속하세요
              </span>
            </div>
            <div className="install-arrow">➜</div>
          </section>
        )}

        {notificationStatus === "default" && (
          <section
            className="menu-card notify-section"
            onClick={handleNotificationClick}
          >
            <div className="install-icon">🔔</div>
            <div className="install-text-group">
              <h2>알림 허용하기</h2>
              <span className="install-desc">
                알림을 키고 급식 메뉴 알림 등 다양한 정보를 받아보세요!
              </span>
            </div>
            <div className="install-arrow">➜</div>
          </section>
        )}

        <section className="menu-card board-section" onClick={goPostList}>
          <div className="board-header">
            <div className="board-title-group">
              <h2>자유 게시판</h2>
            </div>
            <div className="go-icon">목록 보러가기 ➜</div>
          </div>

          <div className="divider"></div>

          <div className="popular-preview-area">
            <div
              className="area-label-wrapper"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p className="area-label">🔥 인기글</p>
              {isStale && (
                <span
                  className="stale-badge"
                  style={{
                    fontSize: "10px",
                    color: "#666",
                    background: "#eee",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  오프라인
                </span>
              )}
            </div>

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
                <p
                  style={{ fontSize: "13px", color: "#888", padding: "10px 0" }}
                >
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
