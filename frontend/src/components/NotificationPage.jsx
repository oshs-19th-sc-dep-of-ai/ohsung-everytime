import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config";
import "./NotificationPage.css";

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

export function NotificationPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [currentPage, setCurrentPage] = useState(
    () => Number(sessionStorage.getItem("notif_page")) || 1
  );
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    sessionStorage.setItem("notif_page", currentPage);
  }, [currentPage]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/notifications/history`, {
        params: { page: currentPage, limit },
        withCredentials: true,
      });

      if (response.data && response.data.data) {
        setNotifications(response.data.data.notifications || []);
        setTotalPages(response.data.data.total_pages || 1);
      }
    } catch (error) {
      console.error("알림 내역 불러오기 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/notifications/unread-count`, {
        withCredentials: true,
      });
      if (response.data && response.data.data) {
        setUnreadCount(response.data.data.unread_count || 0);
      }
    } catch (error) {
      console.error("읽지 않은 알림 개수 불러오기 실패:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [currentPage]);

  const handleMarkRead = async (notificationId) => {
    try {
      await axios.post(
        `${API_BASE_URL}/notifications/${notificationId}/read`,
        {},
        { withCredentials: true }
      );
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("알림 읽음 처리 실패:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/notifications/read-all`,
        {},
        { withCredentials: true }
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("전체 알림 읽음 처리 실패:", error);
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      handleMarkRead(notification.notification_id);
    }
    if (notification.link) {
      window.open(notification.link, "_blank");
    }
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="notif-container">
        <div className="notif-header">
          <h2 className="notif-title">알림</h2>
        </div>
        <div className="notif-loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="notif-container">
      <div className="notif-header">
        <h2 className="notif-title">알림</h2>
        {unreadCount > 0 && (
          <button className="notif-mark-all-btn" onClick={handleMarkAllRead}>
            모두 읽음
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="notif-empty">
          <p>아직 받은 알림이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="notif-list">
            {notifications.map((notification) => (
              <div
                key={notification.notification_id}
                className={`notif-item ${notification.is_read ? "read" : "unread"}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notif-content">
                  <h4 className="notif-item-title">{notification.title}</h4>
                  <p className="notif-item-body">{notification.body}</p>
                  <span className="notif-time">
                    {formatTimeAgo(notification.created_at)}
                  </span>
                </div>
                {!notification.is_read && <div className="notif-dot"></div>}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="notif-pagination">
              <button
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 1}
                className="notif-page-btn"
              >
                &lt;
              </button>
              <span className="notif-page-info">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage === totalPages}
                className="notif-page-btn"
              >
                &gt;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}