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

@notifications_bp.route("/meal-notification", methods=["GET"])
def get_meal_notification():
    """급식 알림 설정 상태를 조회합니다."""
    user_id = session.get("student_id")
    if not user_id:
        return jsonify({"error": "로그인이 필요합니다."}), 401

    db = DatabaseManager()
    result = db.query(
        "SELECT meal_noti_enabled FROM Students WHERE student_id = %(user_id)s",
        user_id=user_id
    ).result
    
    # 기본값을 TRUE로 설정 (DB에 없는 경우 포함)
    enabled = bool(result[0][0]) if result else True
    return jsonify({"meal_noti_enabled": enabled}), 200

@notifications_bp.route("/meal-notification", methods=["POST"])
def toggle_meal_notification():
    """급식 알림 설정을 변경합니다."""
    user_id = session.get("student_id")
    if not user_id:
        return jsonify({"error": "로그인이 필요합니다."}), 401

    data = request.get_json(silent=True) or {}
    if "enabled" not in data:
        return jsonify({"error": "enabled 필드가 필요합니다."}), 400
        
    enabled = bool(data["enabled"])

    db = DatabaseManager()
    db.query(
        "UPDATE Students SET meal_noti_enabled = %(enabled)s WHERE student_id = %(user_id)s",
        enabled=enabled,
        user_id=user_id
    )
    db.commit()

    return jsonify({"message": "급식 알림 설정이 변경되었습니다.", "meal_noti_enabled": enabled}), 200
