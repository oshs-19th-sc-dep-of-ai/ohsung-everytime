from flask import Blueprint, request, session, jsonify
from firebase_admin import messaging

from ..utils.database_util import DatabaseManager

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

def is_admin():
    return session.get('is_admin') is True

# ────────────────────────────────────────────
# 1. 댓글 / 게시물 강제 삭제
# ────────────────────────────────────────────
@admin_bp.route('/posts/<int:post_id>', methods=['DELETE'])
def admin_delete_post(post_id):
    if not is_admin():
        return jsonify({"status": "error", "message": "관리자 권한이 필요합니다."}), 403

    db = DatabaseManager()
    
    # 게시물 존재 여부 확인
    post = db.query("SELECT post_id FROM Posts WHERE post_id = %(post_id)s", post_id=post_id).result
    if not post:
        return jsonify({"status": "error", "message": "게시물을 찾을 수 없습니다."}), 404

    # 강제 삭제 (Cascade 적용되어 댓글, 좋아요 모두 삭제됨)
    db.query("DELETE FROM Posts WHERE post_id = %(post_id)s", post_id=post_id)
    db.commit()

    return jsonify({"status": "success", "message": "게시물이 강제로 삭제되었습니다."})


@admin_bp.route('/comments/<int:comment_id>', methods=['DELETE'])
def admin_delete_comment(comment_id):
    if not is_admin():
        return jsonify({"status": "error", "message": "관리자 권한이 필요합니다."}), 403

    db = DatabaseManager()

    # 댓글 존재 여부 확인
    comment = db.query("SELECT comment_id FROM Comments WHERE comment_id = %(comment_id)s", comment_id=comment_id).result
    if not comment:
        return jsonify({"status": "error", "message": "댓글을 찾을 수 없습니다."}), 404

    # DB에서 강제 삭제 (대댓글 및 좋아요 cascade 삭제됨)
    db.query("DELETE FROM Comments WHERE comment_id = %(comment_id)s", comment_id=comment_id)
    db.commit()

    return jsonify({"status": "success", "message": "댓글이 강제로 삭제되었습니다."})


# ────────────────────────────────────────────
# 2. 수정 이력 확인 (댓글)
# ────────────────────────────────────────────
@admin_bp.route('/comments/<int:comment_id>/history', methods=['GET'])
def admin_comment_history(comment_id):
    if not is_admin():
        return jsonify({"status": "error", "message": "관리자 권한이 필요합니다."}), 403

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
    if not is_admin():
        return jsonify({"status": "error", "message": "관리자 권한이 필요합니다."}), 403

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
        else:
            # 전체 사용자 대상
            tokens = db.query("SELECT token FROM fcm_tokens").result

        if not tokens:
            return jsonify({"status": "success", "message": "전송할 FCM 디바이스 토큰이 없습니다."})

        # 토큰 리스트 추출
        token_list = [t[0] for t in tokens]
        
        # FCM 메시지 생성
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon='/vite.svg',
                    badge='/vite.svg'
                )
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
    if not is_admin():
        return jsonify({"status": "error", "message": "관리자 권한이 필요합니다."}), 403

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
    if not is_admin():
        return jsonify({"status": "error", "message": "관리자 권한이 필요합니다."}), 403

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
