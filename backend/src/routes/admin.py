from flask import Blueprint, request, session, jsonify
from firebase_admin import messaging

from ..utils.database_util import DatabaseManager

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

def eta_admin():
    return session.get('eta_admin') is True

# ────────────────────────────────────────────
# 1. 댓글 / 게시물 강제 삭제
# ────────────────────────────────────────────
@admin_bp.route('/posts/<int:post_id>', methods=['DELETE'])
def admin_delete_post(post_id):
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    db = DatabaseManager()
    
    # 게시물 존재 여부 확인
    post = db.query("SELECT post_id, is_deleted FROM Posts WHERE post_id = %(post_id)s", post_id=post_id).result
    if not post:
        return jsonify({"status": "error", "message": "게시물을 찾을 수 없습니다."}), 404

    if post[0][1]:
        return jsonify({"status": "error", "message": "이미 삭제된 게시물입니다."}), 400

    # 논리적 삭제 (is_deleted = TRUE)
    db.query("UPDATE Posts SET is_deleted = TRUE WHERE post_id = %(post_id)s", post_id=post_id)
    db.commit()

    return jsonify({"status": "success", "message": "게시물이 강제로 삭제되었습니다."})


@admin_bp.route('/comments/<int:comment_id>', methods=['DELETE'])
def admin_delete_comment(comment_id):
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    db = DatabaseManager()

    # 댓글 존재 여부 확인
    comment = db.query("SELECT comment_id, is_deleted FROM Comments WHERE comment_id = %(comment_id)s", comment_id=comment_id).result
    if not comment:
        return jsonify({"status": "error", "message": "댓글을 찾을 수 없습니다."}), 404

    if comment[0][1]:
        return jsonify({"status": "error", "message": "이미 삭제된 댓글입니다."}), 400

    # 논리적 삭제 (is_deleted = TRUE)
    db.query("UPDATE Comments SET is_deleted = TRUE WHERE comment_id = %(comment_id)s", comment_id=comment_id)
    db.commit()

    return jsonify({"status": "success", "message": "댓글이 강제로 삭제되었습니다."})


# ────────────────────────────────────────────
# 2. 수정 이력 확인 (댓글)
# ────────────────────────────────────────────
@admin_bp.route('/comments/<int:comment_id>/history', methods=['GET'])
def admin_comment_history(comment_id):
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    db = DatabaseManager()
    
    sql = """
        SELECT history_id, prev_content, new_content, changed_at 
        FROM CommentHistory 
        WHERE comment_id = %(comment_id)s 
        ORDER BY changed_at DESC
    """
    rows = db.query(sql, comment_id=comment_id).result

    history = []
    for row in rows:
        history.append({
            "history_id": row[0],
            "prev_content": row[1],
            "new_content": row[2],
            "changed_at": row[3].strftime('%Y-%m-%d %H:%M:%S') if row[3] else None
        })

    return jsonify({
        "status": "success",
        "message": "수정 이력을 가져왔습니다.",
        "data": history
    })


# ────────────────────────────────────────────
# 3. 수동 푸시 알람 전송
# ────────────────────────────────────────────
@admin_bp.route('/notifications/push', methods=['POST'])
def admin_push_notification():
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    data = request.get_json(silent=True) or {}
    title = data.get('title')
    body = data.get('body')
    target_user_id = data.get('target_user_id') # 특정 유저에게만 보낼 경우 (선택)

    if not title or not body:
        return jsonify({"status": "error", "message": "제목(title)과 내용(body)을 입력해주세요."}), 400

    db = DatabaseManager()

    try:
        if target_user_id:
            # 특정 사용자 대상
            tokens = db.query("SELECT token FROM fcm_tokens WHERE user_id = %(user_id)s", user_id=target_user_id).result
            db.query(
                """
                INSERT INTO push_notifications (user_id, title, body, icon, created_at)
                VALUES (%(user_id)s, %(title)s, %(body)s, %(icon)s, NOW())
                """,
                user_id=target_user_id, title=title, body=body, icon='/icon_notification.svg'
            )
        else:
            # 전체 사용자 대상
            tokens = db.query("SELECT token FROM fcm_tokens").result
            db.query(
                """
                INSERT INTO push_notifications (user_id, title, body, icon, created_at)
                SELECT DISTINCT user_id, %(title)s, %(body)s, %(icon)s, NOW()
                FROM fcm_tokens
                """,
                title=title, body=body, icon='/icon_notification.svg'
            )

        db.commit()

        if not tokens:
            return jsonify({"status": "success", "message": "전송할 FCM 디바이스 토큰이 없으나, 내역은 저장되었습니다."})

        # 토큰 리스트 추출
        token_list = [t[0] for t in tokens]
        
        # FCM 메시지 생성
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon='/icon_notification.svg',
                    badge='/icon_notification.svg'
                ),
                fcm_options=messaging.WebpushFCMOptions(link='https://square.coshsc.kr/notifications')
            ),
            tokens=token_list
        )
        
        # 전송 (firebase-admin v6+: send_multicast → send_each_for_multicast)
        response = messaging.send_each_for_multicast(message)
        
        # 유효하지 않은 토큰(만료, 기기 변경 등) DB에서 정리
        if response.failure_count > 0:
            failed_tokens = []
            for idx, resp in enumerate(response.responses):
                if not resp.success:
                    failed_tokens.append(token_list[idx])
            
            if failed_tokens:
                for failed_token in failed_tokens:
                    db.query("DELETE FROM fcm_tokens WHERE token = %(token)s", token=failed_token)
                db.commit()
        
        return jsonify({
            "status": "success",
            "message": "푸시 알림 전송을 완료했습니다.",
            "data": {
                "success_count": response.success_count,
                "failure_count": response.failure_count
            }
        })
        
    except Exception as e:
        return jsonify({"status": "error", "message": f"푸시 알림 전송 실패: {str(e)}"}), 500


# ────────────────────────────────────────────
# 4. 익명 게시자 추적
# ────────────────────────────────────────────
@admin_bp.route('/trace/posts/<int:post_id>', methods=['GET'])
def admin_trace_post_author(post_id):
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    db = DatabaseManager()
    
    sql = """
        SELECT p.author_id, s.student_name, p.is_anonymous
        FROM Posts p
        JOIN Students s ON p.author_id = s.student_id
        WHERE p.post_id = %(post_id)s
    """
    row = db.query(sql, post_id=post_id).result

    if not row:
        return jsonify({"status": "error", "message": "게시물을 찾을 수 없습니다."}), 404

    return jsonify({
        "status": "success",
        "data": {
            "post_id": post_id,
            "author_id": row[0][0],
            "student_name": row[0][1],
            "was_anonymous": bool(row[0][2])
        }
    })


@admin_bp.route('/trace/comments/<int:comment_id>', methods=['GET'])
def admin_trace_comment_author(comment_id):
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    db = DatabaseManager()
    
    sql = """
        SELECT c.author_id, s.student_name, c.is_anonymous, c.post_id
        FROM Comments c
        JOIN Students s ON c.author_id = s.student_id
        WHERE c.comment_id = %(comment_id)s
    """
    row = db.query(sql, comment_id=comment_id).result

    if not row:
        return jsonify({"status": "error", "message": "댓글을 찾을 수 없습니다."}), 404

    return jsonify({
        "status": "success",
        "data": {
            "comment_id": comment_id,
            "post_id": row[0][3],
            "author_id": row[0][0],
            "student_name": row[0][1],
            "was_anonymous": bool(row[0][2])
        }
    })

# ────────────────────────────────────────────
# 5. 중식 알람 테스트
# ────────────────────────────────────────────
@admin_bp.route('/test/lunch-push', methods=['POST'])
def admin_test_lunch_push():
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    from ..utils.scheduler_util import send_lunch_menu_notification
    try:
        send_lunch_menu_notification()
        return jsonify({"status": "success", "message": "중식 알람 푸시 테스트가 실행되었습니다. (서버 로그 확인)"})
    except Exception as e:
        return jsonify({"status": "error", "message": f"중식 알람 테스트 실패: {str(e)}"}), 500

@admin_bp.route('/test/dinner-push', methods=['POST'])
def admin_test_dinner_push():
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    from ..utils.scheduler_util import send_dinner_menu_notification
    try:
        send_dinner_menu_notification()
        return jsonify({"status": "success", "message": "석식 알람 푸시 테스트가 실행되었습니다. (서버 로그 확인)"})
    except Exception as e:
        return jsonify({"status": "error", "message": f"석식 알람 테스트 실패: {str(e)}"}), 500

@admin_bp.route('/test/timetable-push', methods=['POST'])
def admin_test_timetable_push():
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    data = request.get_json(silent=True) or {}
    period = data.get('period', 1)

    from ..utils.scheduler_util import send_timetable_notification
    try:
        send_timetable_notification(period)
        return jsonify({"status": "success", "message": f"{period}교시 알람 푸시 테스트가 실행되었습니다. (서버 로그 확인)"})
    except Exception as e:
        return jsonify({"status": "error", "message": f"시간표 알람 테스트 실패: {str(e)}"}), 500


# ────────────────────────────────────────────
# 6. 삭제 로그 조회
# ────────────────────────────────────────────
@admin_bp.route('/deleted-logs', methods=['GET'])
def admin_deleted_logs():
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    db = DatabaseManager()
    
    post_sql = """
        SELECT p.post_id, p.title, s.student_name, p.created_at
        FROM Posts p
        JOIN Students s ON p.author_id = s.student_id
        WHERE p.is_deleted = TRUE
        ORDER BY p.created_at DESC
        LIMIT 50
    """
    deleted_posts = db.query(post_sql).result

    comment_sql = """
        SELECT c.comment_id, c.content, s.student_name, c.created_at, c.post_id
        FROM Comments c
        JOIN Students s ON c.author_id = s.student_id
        WHERE c.is_deleted = TRUE
        ORDER BY c.created_at DESC
        LIMIT 50
    """
    deleted_comments = db.query(comment_sql).result

    logs = []
    for row in deleted_posts:
        logs.append({
            "type": "post",
            "id": row[0],
            "title": row[1],
            "author": row[2],
            "created_at": row[3].strftime('%Y-%m-%d %H:%M:%S') if row[3] else None
        })

    for row in deleted_comments:
        import re
        clean_content = re.sub(r'<[^>]+>', ' ', row[1]).strip()
        logs.append({
            "type": "comment",
            "id": row[0],
            "content": clean_content[:100] + "…" if len(clean_content) > 100 else clean_content,
            "author": row[2],
            "created_at": row[3].strftime('%Y-%m-%d %H:%M:%S') if row[3] else None,
            "post_id": row[4]
        })

    logs.sort(key=lambda x: x['created_at'], reverse=True)

    return jsonify({
        "status": "success",
        "data": logs
    })

# ────────────────────────────────────────────
# 7. 과목 관리
# ────────────────────────────────────────────
@admin_bp.route('/subjects', methods=['GET'])
def get_admin_subjects():
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    db = DatabaseManager()
    rows = db.query("SELECT subject_id, grade, subject_name FROM Subjects ORDER BY grade, subject_name").result
    subjects = [{"subject_id": r[0], "grade": r[1], "subject_name": r[2]} for r in rows]
    return jsonify({"status": "success", "data": subjects})

@admin_bp.route('/subjects', methods=['POST'])
def add_admin_subject():
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    data = request.get_json(silent=True) or {}
    grade = data.get('grade')
    subject_name = data.get('subject_name')

    if not grade or not subject_name:
        return jsonify({"status": "error", "message": "학년과 과목명을 모두 입력해주세요."}), 400

    db = DatabaseManager()
    try:
        db.query("INSERT INTO Subjects (grade, subject_name) VALUES (%(grade)s, %(subject_name)s)", grade=grade, subject_name=subject_name)
        db.commit()
        return jsonify({"status": "success", "message": "과목이 추가되었습니다."})
    except Exception as e:
        if 'Duplicate' in str(e) or '1062' in str(e):
            return jsonify({"status": "error", "message": "이미 존재하는 과목입니다."}), 400
        return jsonify({"status": "error", "message": str(e)}), 500

@admin_bp.route('/subjects/<int:subject_id>', methods=['DELETE'])
def delete_admin_subject(subject_id):
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    db = DatabaseManager()
    db.query("DELETE FROM Subjects WHERE subject_id = %(subject_id)s", subject_id=subject_id)
    db.commit()
    return jsonify({"status": "success", "message": "과목이 삭제되었습니다."})

@admin_bp.route('/subjects/sync-neis', methods=['POST'])
def sync_neis_subjects():
    if not eta_admin():
        return jsonify({"status": "error", "message": "모더레이터 권한이 필요합니다."}), 403

    from ..utils.config_util import ConfigManager as Config
    import requests as http_requests
    from datetime import datetime, timedelta

    cfg = Config().get()["NICEAPI"]
    
    db = DatabaseManager()

    # 기준일을 오늘로 잡고, 이번 주 월요일부터 금요일까지 5일치 데이터를 모두 수집
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    dates_to_fetch = [(monday + timedelta(days=i)).strftime("%Y%m%d") for i in range(5)]
    
    for date_str in dates_to_fetch:
        month = int(date_str[4:6])
        sem = "1" if month <= 8 else "2"
        
        for grade in ["1", "2", "3"]:
            params = {
                "KEY": cfg["KEY"],
                "Type": "json",
                "pIndex": 1,
                "pSize": 1000,
                "ATPT_OFCDC_SC_CODE": cfg["SCHULSC"],
                "SD_SCHUL_CODE": cfg["SCHULC"],
                "AY": date_str[:4],
                "SEM": sem,
                "ALL_TI_YMD": date_str,
                "GRADE": grade,
            }
            
            try:
                resp = http_requests.get(cfg["TIMETABLE"], params=params, timeout=10)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                rows = data.get("hisTimetable", [{}])[1].get("row", [])
                
                subjects = set()
                for row in rows:
                    if row.get("ITRT_CNTNT"):
                        subjects.add(row["ITRT_CNTNT"])
                
                for subject_name in subjects:
                    try:
                        db.query("INSERT IGNORE INTO Subjects (grade, subject_name) VALUES (%(grade)s, %(subject_name)s)", grade=int(grade), subject_name=subject_name)
                    except:
                        pass
            except Exception as e:
                print(f"[NEIS Sync Error] Date {date_str} Grade {grade}: {e}")
                continue

    db.commit()
    return jsonify({"status": "success", "message": "NEIS에서 5일간의 모든 과목 목록을 동기화했습니다."})
