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
function LoadingBtn({ loading, onClick, className, children, style }) {
  return (
    <button
      className={`admin-btn ${className}`}
      onClick={onClick}
      disabled={loading}
      style={style}
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

  const sendTestLunchPush = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch("/admin/test/lunch-push", {
        method: "POST",
      });
      setResult({
        type: "success",
        message: data.message,
      });
    } catch (e) {
      setResult({ type: "error", message: `⚠️ ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  const sendTestDinnerPush = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch("/admin/test/dinner-push", {
        method: "POST",
      });
      setResult({
        type: "success",
        message: data.message,
      });
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

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <LoadingBtn
            loading={loading}
            onClick={sendPush}
            className="admin-btn--primary"
          >
            📣 {target === "all" ? "전체 전송" : "전송"}
          </LoadingBtn>
          
          <LoadingBtn
            loading={loading}
            onClick={sendTestLunchPush}
            className="admin-btn--secondary"
            style={{ backgroundColor: '#ff9800' }}
          >
            🍱 중식 알림 전송 테스트
          </LoadingBtn>

          <LoadingBtn
            loading={loading}
            onClick={sendTestDinnerPush}
            className="admin-btn--secondary"
            style={{ backgroundColor: '#e91e63' }}
          >
            🍽️ 석식 알림 전송 테스트
          </LoadingBtn>
        </div>

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

// 탭 4: 비밀번호 변경
function ChangePasswordTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const changePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setResult({ type: "error", message: "모든 필드를 입력해주세요." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setResult({ type: "error", message: "새 비밀번호가 일치하지 않습니다." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch("/change_password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      setResult({ type: "success", message: data.message });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setResult({ type: "error", message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="admin-section-title">계정 설정</p>
      <div className="admin-card">
        <div className="admin-input-group">
          <input
            className="admin-input"
            type="password"
            placeholder="현재 비밀번호"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            className="admin-input"
            type="password"
            placeholder="새 비밀번호"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            className="admin-input"
            type="password"
            placeholder="새 비밀번호 확인"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <div style={{ marginTop: '16px' }}>
          <LoadingBtn
            loading={loading}
            onClick={changePassword}
            className="admin-btn--primary"
            style={{ width: '100%' }}
          >
            비밀번호 변경
          </LoadingBtn>
        </div>

        {result && (
          <div className={`admin-result admin-result--${result.type}`}>
            {result.type === "success" ? "✅" : "⚠️"} {result.message}
          </div>
        )}
      </div>
    </div>
  );
}

// 삭제된 항목 보기 토글
function DeletedItemsToggle() {
  const [showDeleted, setShowDeleted] = useState(() => {
    return localStorage.getItem("show_deleted") === "true";
  });

  const handleToggle = () => {
    const newValue = !showDeleted;
    setShowDeleted(newValue);
    localStorage.setItem("show_deleted", newValue.toString());
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <p className="admin-section-title">관리자 설정</p>
      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>🗑️ 삭제된 항목 보기</div>
            <div style={{ fontSize: '13px', color: '#888' }}>게시글, 댓글에서 논리적으로 삭제된 항목을 확인합니다</div>
          </div>
          <button
            onClick={handleToggle}
            className="admin-deleted-toggle-btn"
            style={{
              width: '52px',
              height: '28px',
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background-color 0.3s',
              backgroundColor: showDeleted ? '#ff4d4f' : '#ccc',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '3px',
                left: showDeleted ? '26px' : '3px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                transition: 'left 0.3s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>
        {showDeleted && (
          <div style={{ marginTop: '12px', padding: '10px', background: '#fff5f5', borderRadius: '6px', fontSize: '13px', color: '#c62828', fontWeight: '500' }}>
            ⚠️ 삭제된 항목 보기가 활성화되었습니다. 게시판에서 삭제된 게시글과 댓글이 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );
}

import { useNetwork } from '../contexts/NetworkContext.jsx';

// 메인 AdminPage (설정 페이지)
const ADMIN_TABS = [
  { id: "history", label: "📋 수정 이력" },
  { id: "push", label: "📣 푸시 알림" },
  { id: "trace", label: "🔍 작성자 추적" }
];

export default function AdminPage() {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState("history");
  
  const { isOnline } = useNetwork();

  const isMod = localStorage.getItem("eta_admin") === "true";
  const userName = localStorage.getItem("student_name") || "사용자";

  return (
    <div className="admin-page">
      {/* 헤더 */}
      <header className="admin-header" style={{ justifyContent: 'space-between' }}>
        <div className="admin-header__left">
          <span className="admin-header__badge">{isMod ? "MODERATOR" : "USER"}</span>
          <span className="admin-header__title">{showAdminPanel ? "어드민 패널" : "설정"}</span>
        </div>
        <span className="admin-header__user">🛡 {userName}</span>
      </header>

      {/* 오프라인 경고 */}
      {!isOnline && (
        <div style={{ margin: '16px', padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' }}>
          ⚠️ 오프라인 상태에서는 설정 및 관리자 기능을 사용할 수 없습니다.
        </div>
      )}

      {/* 본문 */}
      <main className="admin-body" style={{ opacity: isOnline ? 1 : 0.5, pointerEvents: isOnline ? 'auto' : 'none' }}>
        {!showAdminPanel ? (
          <>
            <ChangePasswordTab />
            
            {isMod && (
              <>
                <DeletedItemsToggle />
                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <button 
                    className="admin-btn admin-btn--primary" 
                    style={{ width: '100%', backgroundColor: '#333' }}
                    onClick={() => setShowAdminPanel(true)}
                  >
                    ⚙️ 어드민 패널 접속
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <button 
                className="admin-btn admin-btn--secondary" 
                onClick={() => setShowAdminPanel(false)}
              >
                ← 설정으로 돌아가기
              </button>
            </div>
            {/* 어드민 탭 */}
            <div className="admin-tabs">
              {ADMIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`admin-tab${activeAdminTab === tab.id ? " admin-tab--active" : ""}`}
                  onClick={() => setActiveAdminTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeAdminTab === "history" && <CommentHistoryTab />}
            {activeAdminTab === "push" && <PushNotificationTab />}
            {activeAdminTab === "trace" && <TraceAuthorTab />}
          </>
        )}
      </main>
    </div>
  );
}
