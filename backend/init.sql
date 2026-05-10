CREATE DATABASE IF NOT EXISTS student24_db;

USE student24_db;

-- 학생 테이블 (Students)
CREATE TABLE IF NOT EXISTS Students (
    student_id CHAR(7) PRIMARY KEY,
    student_name VARCHAR(128) NOT NULL,
    student_pw CHAR(64) NOT NULL,
    rent_admin BOOLEAN DEFAULT FALSE,
    eta_admin BOOLEAN DEFAULT FALSE,
    grade INT NOT NULL,
    meal_noti_enabled BOOLEAN DEFAULT TRUE
);

-- 댓글 테이블 (Comments)
CREATE TABLE IF NOT EXISTS Comments (
    comment_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    author_id CHAR(7) NOT NULL,
    content TEXT NOT NULL,
    parent_id INT DEFAULT NULL, -- 대댓글용 (NULL이면 원댓글)
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (post_id) REFERENCES Posts (post_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES Students (student_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES Comments (comment_id) ON DELETE CASCADE
);

-- 댓글 좋아요 테이블 (CommentLikes)
CREATE TABLE IF NOT EXISTS CommentLikes (
    comment_id INT NOT NULL,
    student_id CHAR(7) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, student_id),
    FOREIGN KEY (comment_id) REFERENCES Comments (comment_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES Students (student_id) ON DELETE CASCADE
);

-- 게시글 테이블 (Posts)
CREATE TABLE IF NOT EXISTS Posts (
    post_id INT AUTO_INCREMENT PRIMARY KEY,
    author_id CHAR(7) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (author_id) REFERENCES Students (student_id) ON DELETE CASCADE
);

-- 게시글 좋아요 테이블 (PostLikes)
CREATE TABLE IF NOT EXISTS PostLikes (
    post_id INT NOT NULL,
    student_id CHAR(7) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, student_id),
    FOREIGN KEY (post_id) REFERENCES Posts (post_id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES Students (student_id) ON DELETE CASCADE
);

-- 댓글 변경 이력 테이블 (CommentHistory)
CREATE TABLE IF NOT EXISTS CommentHistory (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    comment_id INT NOT NULL,
    prev_content TEXT NOT NULL,
    new_content TEXT NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES Comments (comment_id) ON DELETE CASCADE
);

-- FCM 디바이스 토큰 테이블 (Firebase Push Notification)
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(7) NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fcm_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES Students (student_id) ON DELETE CASCADE
);

-- 시간표 테이블
CREATE TABLE IF NOT EXISTS Timetable (
    timetable_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id CHAR(7) NOT NULL,
    day_of_week TINYINT NOT NULL, -- 1=월, 2=화, 3=수, 4=목, 5=금
    period TINYINT NOT NULL, -- 교시
    subject_name VARCHAR(100) NOT NULL, -- 과목명
    location VARCHAR(20) DEFAULT NULL, -- 교실 (101~313)
    memo TEXT DEFAULT NULL, -- 메모
    color VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
    UNIQUE KEY uq_student_schedule (student_id, day_of_week, period),
    FOREIGN KEY (student_id) REFERENCES Students (student_id) ON DELETE CASCADE
);