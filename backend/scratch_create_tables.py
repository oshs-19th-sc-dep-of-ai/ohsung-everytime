import sys
from src.utils.config_util import ConfigManager as Config
from src.utils.database_util import DatabaseManager

Config().read_file('config.json')
db = DatabaseManager()
db.connect(
    host=Config().get()['Database']['Host'],
    username=Config().get()['Database']['Username'],
    password=Config().get()['Database']['Password']
)

db.query("""
CREATE TABLE IF NOT EXISTS Inquiries (
    inquiry_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id CHAR(7) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status ENUM('pending', 'answered', 'resolved') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES Students (student_id) ON DELETE CASCADE
)
""")

db.query("""
CREATE TABLE IF NOT EXISTS InquiryMessages (
    message_id INT AUTO_INCREMENT PRIMARY KEY,
    inquiry_id INT NOT NULL,
    sender_type ENUM('user', 'admin') NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inquiry_id) REFERENCES Inquiries (inquiry_id) ON DELETE CASCADE
)
""")

db.commit()
print("Tables created successfully.")
