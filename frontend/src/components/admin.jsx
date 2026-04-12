import { useState } from "react";
import "./admin.css";
import { API_BASE_URL } from "../config";

// ───── 공통 fetch 헬퍼 ─────
const apiFetch = async (url, options = {}) => {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "서버 오류가 발생했습니다.");
  return data;
};

// ───── 로딩 버튼 ─────
function LoadingBtn({ loading, onClick, className, children }) {
  return (
    <button
      className={`admin-btn ${className}`}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? <span className="admin-btn__spinner" /> : null}
      {children}
    </button>
  );
}

// 탭 1: 댓글 수정 이력
function CommentHistoryTab() {
  const [commentId, setCommentId] = useState("");
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchHistory = async () => {
    if (!commentId.trim()) return;
    setLoading(true);
    setError("");
    setHistory(null);
    try {
      const data = await apiFetch(`/admin/comments/${commentId}/history`);
      setHistory(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="admin-section-title">댓글 수정 이력 조회</p>
      <div className="admin-card">
        <div className="admin-input-row">
          <input
            className="admin-input"
            placeholder="댓글 ID 입력"
            value={commentId}
            onChange={(e) => setCommentId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchHistory()}
          />
          <LoadingBtn
            loading={loading}
            onClick={fetchHistory}
            className="admin-btn--primary"
          >
            조회
          </LoadingBtn>
        </div>

        {error && (
          <div className="admin-result admin-result--error">⚠️ {error}</div>
        )}

        {history !== null &&
          (history.length === 0 ? (
            <div className="admin-empty">수정 이력이 없습니다.</div>
          ) : (
            <div className="admin-history-list" style={{ marginTop: "16px" }}>
              {history.map((item, i) => (
                <div key={i} className="admin-history-item">
                  <div className="admin-history-item__time">
                    🕐 {item.changed_at}
                  </div>
                  <div className="admin-history-diff">
                    <div className="admin-history-diff__box admin-history-diff__box--prev">
                      <div className="admin-history-diff__label">수정 전</div>
                      {item.prev_content}
                    </div>
                    <div className="admin-history-diff__box admin-history-diff__box--new">
                      <div className="admin-history-diff__label">수정 후</div>
                      {item.new_content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

// 탭 2: 수동 푸시 알림
function PushNotificationTab() {
  const [target, setTarget] = useState("all"); // "all" | "specific"
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const sendPush = async () => {
    if (!title.trim() || !body.trim()) {
      setResult({ type: "error", message: "제목과 내용을 모두 입력해주세요." });
      return;
    }
    if (target === "specific" && !userId.trim()) {
      setResult({ type: "error", message: "학번을 입력해주세요." });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        ...(target === "specific" && { target_user_id: userId.trim() }),
      };
      const data = await apiFetch("/admin/notifications/push", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResult({
        type: "success",
        message: `✅ 전송 완료 — 성공 ${data.data?.success_count ?? 0}건 / 실패 ${data.data?.failure_count ?? 0}건`,
      });
      setTitle("");
      setBody("");
      setUserId("");
    } catch (e) {
      setResult({ type: "error", message: `⚠️ ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="admin-section-title">수동 푸시 알림 전송</p>
      <div className="admin-card">
        {/* 대상 선택 */}
        <div className="admin-target-toggle">
          <button
            className={`admin-toggle-btn${target === "all" ? " admin-toggle-btn--active" : ""}`}
            onClick={() => setTarget("all")}
          >
            전체 학생
          </button>
          <button
            className={`admin-toggle-btn${target === "specific" ? " admin-toggle-btn--active" : ""}`}
            onClick={() => setTarget("specific")}
          >
            특정 학생
          </button>
        </div>

        <div className="admin-input-group">
          {target === "specific" && (
            <input
              className="admin-input"
              placeholder="학번 입력 (예: 1234567)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          )}
          <input
            className="admin-input"
            placeholder="알림 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="admin-input admin-textarea"
            placeholder="알림 내용"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <LoadingBtn
          loading={loading}
          onClick={sendPush}
          className="admin-btn--primary"
        >
          📣 {target === "all" ? "전체 전송" : "전송"}
        </LoadingBtn>

        {result && (
          <div className={`admin-result admin-result--${result.type}`}>
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}

// 탭 3: 익명 작성자 추적

function TraceAuthorTab() {
  const [type, setType] = useState("post"); // "post" | "comment"
  const [targetId, setTargetId] = useState("");
  const [author, setAuthor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const trace = async () => {
    if (!targetId.trim()) return;
    setLoading(true);
    setError("");
    setAuthor(null);
    try {
      const endpoint =
        type === "post"
          ? `/admin/trace/posts/${targetId}`
          : `/admin/trace/comments/${targetId}`;
      const data = await apiFetch(endpoint);
      setAuthor(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="admin-section-title">익명 작성자 추적</p>
      <div className="admin-card">
        {/* 타입 선택 */}
        <div className="admin-target-toggle">
          <button
            className={`admin-toggle-btn${type === "post" ? " admin-toggle-btn--active" : ""}`}
            onClick={() => {
              setType("post");
              setAuthor(null);
              setError("");
            }}
          >
            게시물
          </button>
          <button
            className={`admin-toggle-btn${type === "comment" ? " admin-toggle-btn--active" : ""}`}
            onClick={() => {
              setType("comment");
              setAuthor(null);
              setError("");
            }}
          >
            댓글
          </button>
        </div>

        <div className="admin-input-row" style={{ marginTop: "12px" }}>
          <input
            className="admin-input"
            placeholder={`${type === "post" ? "게시물" : "댓글"} ID 입력`}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && trace()}
          />
          <LoadingBtn
            loading={loading}
            onClick={trace}
            className="admin-btn--primary"
          >
            추적
          </LoadingBtn>
        </div>

        {error && (
          <div className="admin-result admin-result--error">⚠️ {error}</div>
        )}

        {author && (
          <div className="admin-author-box">
            <div className="admin-author-box__avatar">👤</div>
            <div className="admin-author-box__info">
              <div className="admin-author-box__name">
                {author.student_name}
              </div>
              <div className="admin-author-box__id">
                학번: {author.author_id}
              </div>
            </div>
            {author.was_anonymous && (
              <div className="admin-author-box__anon-badge">익명 작성</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 메인 AdminPage
const TABS = [
  { id: "history", label: "📋 수정 이력" },
  { id: "push", label: "📣 푸시 알림" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("history");

  const status = localStorage.getItem("status");
  const userName = localStorage.getItem("student_name");

  // 관리자 아니면 접근 차단
  if (status !== "admin") {
    return (
      <div className="admin-page">
        <div className="admin-forbidden">
          <div className="admin-forbidden__icon">🚫</div>
          <div className="admin-forbidden__title">접근 권한이 없습니다</div>
          <div className="admin-forbidden__sub">
            관리자 계정으로 로그인해주세요.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* 헤더 */}
      <header className="admin-header">
        <div className="admin-header__left">
          <span className="admin-header__badge">ADMIN</span>
          <span className="admin-header__title">오성에타 관리자</span>
        </div>
        <span className="admin-header__user">🛡 {userName}</span>
      </header>

      {/* 탭 */}
      <div className="admin-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`admin-tab${activeTab === tab.id ? " admin-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 본문 */}
      <main className="admin-body">
        {activeTab === "history" && <CommentHistoryTab />}
        {activeTab === "push" && <PushNotificationTab />}
      </main>
    </div>
  );
}
