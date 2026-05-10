-- 푸시 알림 내역 저장 테이블\
USE student24_db;
CREATE TABLE IF NOT EXISTS push_notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSON,
    icon VARCHAR(500),
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Students(student_id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_is_read (is_read)
);