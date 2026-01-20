CREATE DATABASE IF NOT EXISTS student24_db;

USE student24_db;

-- 학생 테이블 (Students)
CREATE TABLE IF NOT EXISTS Students (
    student_id CHAR(7) PRIMARY KEY,
    student_name VARCHAR(128) NOT NULL,
    student_pw CHAR(64) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    grade INT NOT NULL
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