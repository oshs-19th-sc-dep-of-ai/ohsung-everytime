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
