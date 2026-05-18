import { useState, useEffect, useRef } from "react";
import { useToast } from "../contexts/ToastContext.jsx";
import { motion } from "framer-motion";
import "./admin.css";
import { API_BASE_URL } from "../config";
import { useNetwork } from '../contexts/NetworkContext.jsx';

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

  const sendTestTimetablePush = async (period = 1) => {
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch("/admin/test/timetable-push", {
        method: "POST",
        body: JSON.stringify({ period }),
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

          <LoadingBtn
            loading={loading}
            onClick={() => sendTestTimetablePush(1)}
            className="admin-btn--secondary"
            style={{ backgroundColor: '#2196f3' }}
          >
            📚 시간표(1교시) 알림 테스트
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

// 탭 5: 삭제 로그
function DeletedLogsTab() {
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/admin/deleted-logs");
      setLogs(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 탭 열릴 때 자동 조회
  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="admin-section-title" style={{ margin: 0 }}>삭제 로그</p>
        <LoadingBtn loading={loading} onClick={fetchLogs} className="admin-btn--primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
          새로고침
        </LoadingBtn>
      </div>
      <div className="admin-card" style={{ marginTop: '12px' }}>
        {error && <div className="admin-result admin-result--error">⚠️ {error}</div>}
        
        {logs !== null && logs.length === 0 ? (
          <div className="admin-empty">삭제된 항목이 없습니다.</div>
        ) : logs !== null ? (
          <div className="admin-history-list">
            {logs.map((log, i) => (
              <div key={i} className="admin-history-item" style={{ borderLeft: log.type === 'post' ? '3px solid #2196f3' : '3px solid #4caf50', paddingLeft: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', color: log.type === 'post' ? '#1976d2' : '#388e3c', fontSize: '13px' }}>
                    {log.type === 'post' ? '게시물' : '댓글'} (ID: {log.id})
                  </span>
                  <span className="admin-history-item__time">🕐 {log.created_at}</span>
                </div>
                <div style={{ fontSize: '14px', marginBottom: '8px', wordBreak: 'break-all' }}>
                  {log.title || log.content}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  작성자: {log.author} {log.post_id && `(원본 게시물 ID: ${log.post_id})`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-empty">로딩 중...</div>
        )}
      </div>
    </div>
  );
}

// 탭 6: 과목 관리 (새 탭)
function SubjectsTab() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState("");
  const [newGrade, setNewGrade] = useState("1");
  const [newSubject, setNewSubject] = useState("");
  const { showToast } = useToast();

  const fetchSubjects = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/admin/subjects");
      setSubjects(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleAdd = async () => {
    if (!newSubject.trim()) {
      showToast("과목명을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/admin/subjects", {
        method: "POST",
        body: JSON.stringify({ grade: parseInt(newGrade), subject_name: newSubject.trim() }),
      });
      setNewSubject("");
      showToast("과목이 추가되었습니다.");
      fetchSubjects();
    } catch (e) {
      showToast(e.message);
      setLoading(false);
    }
  };

  const handleDelete = async (subjectId) => {
    if (!window.confirm("정말 이 과목을 삭제하시겠습니까?")) return;
    setLoading(true);
    try {
      await apiFetch(`/admin/subjects/${subjectId}`, {
        method: "DELETE",
      });
      showToast("과목이 삭제되었습니다.");
      fetchSubjects();
    } catch (e) {
      showToast(e.message);
      setLoading(false);
    }
  };

  const handleSyncNeis = async () => {
    if (!window.confirm("NEIS에서 1, 2, 3학년 시간표 과목을 가져오시겠습니까?\n이 작업은 다소 시간이 걸릴 수 있습니다.")) return;
    setSyncLoading(true);
    try {
      const data = await apiFetch("/admin/subjects/sync-neis", { method: "POST" });
      showToast(data.message);
      fetchSubjects();
    } catch (e) {
      showToast(e.message);
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="admin-section-title" style={{ margin: 0 }}>과목 관리</p>
        <LoadingBtn loading={syncLoading} onClick={handleSyncNeis} className="admin-btn--primary" style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: '#e91e63' }}>
          나이스 API에서 가져오기
        </LoadingBtn>
      </div>
      <div className="admin-card" style={{ marginTop: '12px' }}>
        {error && <div className="admin-result admin-result--error">⚠️ {error}</div>}
        
        <div className="admin-input-row" style={{ marginBottom: "16px" }}>
          <select 
            className="admin-input" 
            style={{ width: '80px', flexShrink: 0 }}
            value={newGrade}
            onChange={(e) => setNewGrade(e.target.value)}
          >
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
          </select>
          <input
            className="admin-input"
            placeholder="새 과목명 추가"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <LoadingBtn
            loading={loading}
            onClick={handleAdd}
            className="admin-btn--primary"
          >
            추가
          </LoadingBtn>
        </div>

        {subjects.length === 0 ? (
          <div className="admin-empty">등록된 과목이 없습니다.</div>
        ) : (
          <div className="admin-history-list">
            {["1", "2", "3"].map(grade => {
              const gradeSubjects = subjects.filter(s => s.grade == grade);
              if (gradeSubjects.length === 0) return null;
              return (
                <div key={grade} style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', marginBottom: '8px', color: '#555' }}>{grade}학년 과목</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {gradeSubjects.map(sub => (
                      <div key={sub.subject_id} style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', padding: '6px 10px', borderRadius: '16px', fontSize: '13px' }}>
                        <span>{sub.subject_name}</span>
                        <button 
                          onClick={() => handleDelete(sub.subject_id)}
                          style={{ background: 'none', border: 'none', marginLeft: '6px', cursor: 'pointer', color: '#e57373', fontSize: '12px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// 탭 7: 알림 설정
function MealNotificationSettingTab() {
  const [notiEnabled, setNotiEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchNotiStatus = async () => {
      try {
        const data = await apiFetch("/notifications/meal-notification");
        setNotiEnabled(data.meal_noti_enabled);
      } catch (error) {
        console.error("알림 설정 상태를 가져오는데 실패했습니다.", error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotiStatus();
  }, []);

  const toggleNoti = async () => {
    setLoading(true);
    try {
      const newVal = !notiEnabled;
      await apiFetch("/notifications/meal-notification", {
        method: "POST",
        body: JSON.stringify({ enabled: newVal }),
      });
      setNotiEnabled(newVal);
      showToast(`급식 알림이 ${newVal ? '켜졌' : '꺼졌'}습니다.`);
    } catch (error) {
      console.error("알림 설정 변경 실패", error);
      showToast("알림 설정 변경에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <p className="admin-section-title">알림 설정</p>
      <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '15px' }}>급식 알림</div>
          <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>점심(11:30)과 저녁(15:30) 식단 알림을 받습니다.</div>
        </div>
        <button
          onClick={toggleNoti}
          disabled={loading}
          style={{
            position: 'relative',
            width: '52px',
            height: '28px',
            borderRadius: '16px',
            backgroundColor: notiEnabled ? '#6c63ff' : '#e0e0e0',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            padding: '4px',
            transition: 'background-color 0.3s ease',
            outline: 'none',
            flexShrink: 0
          }}
        >
          <motion.div
            layout
            initial={false}
            animate={{ x: notiEnabled ? 24 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          />
        </button>
      </div>
    </div>
  );
}

function TimetableNotificationSettingTab() {
  const [notiEnabled, setNotiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchNotiStatus = async () => {
      try {
        const data = await apiFetch("/notifications/timetable-notification");
        setNotiEnabled(data.timetable_noti_enabled);
      } catch (error) {
        console.error("시간표 알림 설정 상태를 가져오는데 실패했습니다.", error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotiStatus();
  }, []);

  const toggleNoti = async () => {
    setLoading(true);
    try {
      const newVal = !notiEnabled;
      await apiFetch("/notifications/timetable-notification", {
        method: "POST",
        body: JSON.stringify({ enabled: newVal }),
      });
      setNotiEnabled(newVal);
      showToast(`시간표 알림이 ${newVal ? '켜졌' : '꺼졌'}습니다.`);
    } catch (error) {
      console.error("시간표 알림 설정 변경 실패", error);
      showToast("시간표 알림 설정 변경에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '12px' }}>
      <div className="admin-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '15px' }}>시간표 수업 알림</div>
          <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>설정한 시간표에 따라 수업 시작 전 알림을 받습니다.</div>
        </div>
        <button
          onClick={toggleNoti}
          disabled={loading}
          style={{
            position: 'relative',
            width: '52px',
            height: '28px',
            borderRadius: '16px',
            backgroundColor: notiEnabled ? '#6c63ff' : '#e0e0e0',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            padding: '4px',
            transition: 'background-color 0.3s ease',
            outline: 'none',
            flexShrink: 0
          }}
        >
          <motion.div
            layout
            initial={false}
            animate={{ x: notiEnabled ? 24 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          />
        </button>
      </div>
    </div>
  );
}

// ───── 문의하기 (Inquiries) 컴포넌트 ─────

function InquiryList({ onSelect }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  
  const isMod = localStorage.getItem("eta_admin") === "true";
  const { showToast } = useToast();

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/inquiries");
      setInquiries(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      showToast("제목과 내용을 모두 입력해주세요.");
      return;
    }
    try {
      setLoading(true);
      await apiFetch("/inquiries", {
        method: "POST",
        body: JSON.stringify({ title: newTitle, content: newContent })
      });
      setNewTitle("");
      setNewContent("");
      setShowNewForm(false);
      showToast("문의가 접수되었습니다.");
      fetchInquiries();
    } catch (e) {
      showToast(e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="admin-section-title" style={{ margin: 0 }}>1:1 문의하기</p>
        {!isMod && (
          <button 
            className="admin-btn--primary" 
            style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            onClick={() => setShowNewForm(!showNewForm)}
          >
            {showNewForm ? "취소" : "새 문의 작성"}
          </button>
        )}
      </div>

      <div className="admin-card" style={{ marginTop: '12px' }}>
        {showNewForm && !isMod && (
          <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
            <input
              className="admin-input"
              placeholder="제목을 입력하세요"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              style={{ marginBottom: '8px' }}
            />
            <textarea
              className="admin-input admin-textarea"
              placeholder="문의 내용을 입력하세요"
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              style={{ minHeight: '80px' }}
            />
            <div style={{ textAlign: 'right', marginTop: '8px' }}>
              <LoadingBtn loading={loading} onClick={handleCreate} className="admin-btn--primary">
                등록하기
              </LoadingBtn>
            </div>
          </div>
        )}

        {error && <div className="admin-result admin-result--error">⚠️ {error}</div>}
        
        {loading && inquiries.length === 0 ? (
          <div className="admin-empty">로딩 중...</div>
        ) : inquiries.length === 0 ? (
          <div className="admin-empty">등록된 문의가 없습니다.</div>
        ) : (
          <div className="admin-history-list">
            {inquiries.map(inq => (
              <div 
                key={inq.inquiry_id} 
                className="admin-history-item" 
                style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                onClick={() => onSelect(inq.inquiry_id)}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                    {isMod && <span style={{ color: '#2196f3', marginRight: '4px' }}>[{inq.student_name}]</span>}
                    {inq.title}
                  </span>
                  <span className="admin-history-item__time">
                    {inq.status === 'pending' ? <span style={{ color: '#f44336', marginRight: '6px' }}>대기중</span> : 
                     inq.status === 'answered' ? <span style={{ color: '#4caf50', marginRight: '6px' }}>답변완료</span> :
                     <span style={{ color: '#9e9e9e', marginRight: '6px' }}>해결됨</span>}
                    🕐 {inq.updated_at}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InquiryChat({ inquiryId, onBack }) {
  const [inquiry, setInquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  
  const isMod = localStorage.getItem("eta_admin") === "true";
  const { showToast } = useToast();
  const chatEndRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const data = await apiFetch(`/inquiries/${inquiryId}/messages`);
      setInquiry(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [inquiryId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [inquiry]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/inquiries/${inquiryId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: newMessage })
      });
      setNewMessage("");
      fetchMessages();
    } catch (e) {
      showToast(e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="admin-card"><div className="admin-empty">로딩 중...</div></div>;
  if (error) return <div className="admin-card"><div className="admin-result admin-result--error">⚠️ {error}</div><button className="admin-btn--secondary" onClick={onBack}>뒤로가기</button></div>;
  if (!inquiry) return null;

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
        <button 
          className="admin-btn--secondary" 
          onClick={onBack}
          style={{ padding: '6px 10px', fontSize: '13px' }}
        >
          ← 뒤로
        </button>
        <p className="admin-section-title" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {inquiry.title}
        </p>
      </div>

      <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', height: '400px', padding: '0' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#f4f5f7' }}>
          {inquiry.messages.map(msg => {
            // isMine: 내가 보낸 메시지인지 확인. 
            // isMod(관리자)면 sender_type === 'admin'이 내 메시지
            // 일반유저면 sender_type === 'user'가 내 메시지
            const isMine = isMod ? (msg.sender_type === 'admin') : (msg.sender_type === 'user');
            
            return (
              <div key={msg.message_id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                {!isMine && (
                  <span style={{ fontSize: '11px', color: '#666', marginBottom: '4px', marginLeft: '4px' }}>
                    {msg.sender_type === 'admin' ? '관리자' : '사용자'}
                  </span>
                )}
                <div style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: '16px',
                  borderTopRightRadius: isMine ? '4px' : '16px',
                  borderTopLeftRadius: !isMine ? '4px' : '16px',
                  backgroundColor: isMine ? '#6c63ff' : '#ffffff',
                  color: isMine ? '#ffffff' : '#333333',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  fontSize: '14px',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {msg.content}
                </div>
                <span style={{ fontSize: '10px', color: '#999', marginTop: '4px', marginRight: isMine ? '4px' : '0', marginLeft: !isMine ? '4px' : '0' }}>
                  {msg.created_at}
                </span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: '12px', borderTop: '1px solid #eee', display: 'flex', gap: '8px', backgroundColor: '#fff' }}>
          <textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="메시지를 입력하세요 (Shift+Enter로 줄바꿈)"
            style={{ 
              flex: 1, 
              resize: 'none', 
              padding: '10px', 
              borderRadius: '8px', 
              border: '1px solid #ddd',
              outline: 'none',
              fontFamily: 'inherit',
              height: '40px'
            }}
          />
          <LoadingBtn 
            loading={sending} 
            onClick={handleSend} 
            className="admin-btn--primary"
            style={{ padding: '0 20px', borderRadius: '8px' }}
          >
            전송
          </LoadingBtn>
        </div>
      </div>
    </div>
  );
}

function InquirySection() {
  const [activeInquiryId, setActiveInquiryId] = useState(null);

  if (activeInquiryId) {
    return <InquiryChat inquiryId={activeInquiryId} onBack={() => setActiveInquiryId(null)} />;
  }
  return <InquiryList onSelect={setActiveInquiryId} />;
}

// 메인 AdminPage (설정 페이지)
const ADMIN_TABS = [
  { id: "history", label: "📋 수정 이력" },
  { id: "push", label: "📣 푸시 알림" },
  { id: "trace", label: "🔍 작성자 추적" },
  { id: "deleted", label: "🗑️ 삭제 로그" },
  { id: "subjects", label: "📚 과목 관리" }
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
            <InquirySection />
            <ChangePasswordTab />
            <MealNotificationSettingTab />
            <TimetableNotificationSettingTab />
            
            {isMod && (
              <>
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
            <div className="admin-tabs" style={{ display: 'flex', overflowX: 'auto', paddingBottom: '8px' }}>
              {ADMIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={`admin-tab${activeAdminTab === tab.id ? " admin-tab--active" : ""}`}
                  onClick={() => setActiveAdminTab(tab.id)}
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeAdminTab === "history" && <CommentHistoryTab />}
            {activeAdminTab === "push" && <PushNotificationTab />}
            {activeAdminTab === "trace" && <TraceAuthorTab />}
            {activeAdminTab === "deleted" && <DeletedLogsTab />}
            {activeAdminTab === "subjects" && <SubjectsTab />}
          </>
        )}
      </main>
    </div>
  );
}