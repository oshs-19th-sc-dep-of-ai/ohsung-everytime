from flask import Blueprint, request, session, jsonify

from src.utils.database_util import DatabaseManager

notifications_bp = Blueprint("notifications", __name__, url_prefix="/notifications")


@notifications_bp.route("/register-token", methods=["POST"])
def register_token():
    """
    FCM 디바이스 토큰을 등록합니다.

    Request Body (JSON):
        token (str): FCM 디바이스 토큰

    Returns:
        200: 토큰 등록 성공
        400: token 필드 누락
        401: 로그인 필요
    """
    user_id = session.get("student_id")
    if not user_id:
        return jsonify({"error": "로그인이 필요합니다."}), 401

    data  = request.get_json(silent=True) or {}
    token = data.get("token", "").strip()

    if not token:
        return jsonify({"error": "token 필드가 필요합니다."}), 400

    db = DatabaseManager()
    db.query(
        """
        INSERT INTO fcm_tokens (user_id, token)
        VALUES (%(user_id)s, %(token)s)
        ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), updated_at = CURRENT_TIMESTAMP
        """,
        user_id=user_id,
        token=token,
    )
    db.commit()

    return jsonify({"message": "FCM 토큰이 등록되었습니다."}), 200


@notifications_bp.route("/unregister-token", methods=["DELETE"])
def unregister_token():
    """
    FCM 디바이스 토큰을 해제합니다.

    Request Body (JSON):
        token (str): 해제할 FCM 디바이스 토큰

    Returns:
        200: 토큰 해제 성공
        400: token 필드 누락
        401: 로그인 필요
    """
    user_id = session.get("student_id")
    if not user_id:
        return jsonify({"error": "로그인이 필요합니다."}), 401

    data  = request.get_json(silent=True) or {}
    token = data.get("token", "").strip()

    if not token:
        return jsonify({"error": "token 필드가 필요합니다."}), 400

    db = DatabaseManager()
    db.query(
        "DELETE FROM fcm_tokens WHERE user_id = %(user_id)s AND token = %(token)s",
        user_id=user_id, token=token,
    )
    db.commit()

    return jsonify({"message": "FCM 토큰이 해제되었습니다."}), 200


@notifications_bp.route("/history", methods=["GET"])
def get_notification_history():
    """
    사용자의 푸시 알림 내역을 조회합니다.

    Query Params:
        page (int): 페이지 번호 (기본값 1)
        limit (int): 한 페이지당 항목 수 (기본값 20, 최대 100)

    Returns:
        200: 알림 내역 목록
        401: 로그인 필요
    """
    user_id = session.get("student_id")
    if not user_id:
        return jsonify({"error": "로그인이 필요합니다."}), 401

    try:
        page  = max(1, int(request.args.get("page", 1)))
        limit = max(1, min(100, int(request.args.get("limit", 20))))
    except ValueError:
        return jsonify({"status": "error", "message": "page, limit은 정수여야 합니다."}), 400

    offset = (page - 1) * limit

    db = DatabaseManager()

    # 전체 개수
    total_count = db.query(
        "SELECT COUNT(*) FROM push_notifications WHERE user_id = %(user_id)s",
        user_id=user_id
    ).result[0][0]

    # 알림 내역 조회
    rows = db.query(
        """
        SELECT notification_id, title, body, data, icon, link, is_read, created_at
        FROM push_notifications
        WHERE user_id = %(user_id)s
        ORDER BY created_at DESC
        LIMIT %(limit)s OFFSET %(offset)s
        """,
        user_id=user_id, limit=limit, offset=offset
    ).result

    notifications = []
    for row in rows:
        notifications.append({
            "notification_id": row[0],
            "title": row[1],
            "body": row[2],
            "data": row[3],
            "icon": row[4],
            "link": row[5],
            "is_read": bool(row[6]),
            "created_at": row[7].strftime("%Y-%m-%d %H:%M:%S") if row[7] else None,
        })

    return jsonify({
        "status": "success",
        "data": {
            "notifications": notifications,
            "total_count": total_count,
            "page": page,
            "limit": limit,
            "total_pages": -(-total_count // limit),
        }
    })


@notifications_bp.route("/<int:notification_id>/read", methods=["POST"])
def mark_notification_read(notification_id):
    """
    특정 알림을 읽음 처리합니다.

    Returns:
        200: 읽음 처리 성공
        401: 로그인 필요
        404: 알림을 찾을 수 없음
    """
    user_id = session.get("student_id")
    if not user_id:
        return jsonify({"error": "로그인이 필요합니다."}), 401

    db = DatabaseManager()
    result = db.query(
        "UPDATE push_notifications SET is_read = TRUE WHERE notification_id = %(notification_id)s AND user_id = %(user_id)s",
        notification_id=notification_id, user_id=user_id
    )
    db.commit()

    if result.affected_rows == 0:
        return jsonify({"error": "알림을 찾을 수 없습니다."}), 404

    return jsonify({"message": "알림을 읽음 처리했습니다."}), 200


@notifications_bp.route("/read-all", methods=["POST"])
def mark_all_notifications_read():
    """
    사용자의 모든 알림을 읽음 처리합니다.

    Returns:
        200: 전체 읽음 처리 성공
        401: 로그인 필요
    """
    user_id = session.get("student_id")
    if not user_id:
        return jsonify({"error": "로그인이 필요합니다."}), 401

    db = DatabaseManager()
    db.query(
        "UPDATE push_notifications SET is_read = TRUE WHERE user_id = %(user_id)s AND is_read = FALSE",
        user_id=user_id
    )
    db.commit()

    return jsonify({"message": "모든 알림을 읽음 처리했습니다."}), 200


@notifications_bp.route("/unread-count", methods=["GET"])
def get_unread_count():
    """
    사용자의 읽지 않은 알림 개수를 조회합니다.

    Returns:
        200: 읽지 않은 알림 개수
        401: 로그인 필요
    """
    user_id = session.get("student_id")
    if not user_id:
        return jsonify({"error": "로그인이 필요합니다."}), 401

    db = DatabaseManager()
    count = db.query(
        "SELECT COUNT(*) FROM push_notifications WHERE user_id = %(user_id)s AND is_read = FALSE",
        user_id=user_id
    ).result[0][0]

    return jsonify({"status": "success", "data": {"unread_count": count}}), 200
