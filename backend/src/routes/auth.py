from flask import Blueprint, request, session, jsonify
from ..utils.database_util import DatabaseManager

auth_bp = Blueprint('auth', __name__)

# 로그인 라우트
@auth_bp.route('/login', methods=['POST'])
def login():
    # None 방지
    data = request.get_json(silent=True) or {}
    input_student_id = data.get('student_id')
    input_student_pw = data.get('password')

    # 입력값 체크
    if not input_student_id or not input_student_pw:
        return jsonify({
            "message": "ID와 비밀번호를 모두 입력해주세요.",
            "status": "error"
        }), 400

    db = DatabaseManager()

    # 학생 로그인 처리
    student = db.query(
        """
        SELECT student_id, student_name, rent_admin, eta_admin FROM Students
        WHERE student_id = %(student_id)s AND student_pw = SHA2(%(student_pw)s, 256)
        """,
        student_id=input_student_id,
        student_pw=input_student_pw
    ).result

    # SELECT 후 commit은 필수는 아니지만 기존 흐름 유지
    db.commit()

    if student:
        student = student[0]
        student_id, student_name, rent_admin, eta_admin = student

        # 세션 사용 사용자 정보 저장
        session.permanent = True
        session['student_id'] = student_id
        session['student_name'] = student_name
        session['session_student_id'] = student_id  # 다른 라우트 호환용
        session['rent_admin'] = bool(rent_admin)
        session['eta_admin'] = bool(eta_admin)

        if eta_admin:
            # 모더레이터 키 명시적 설정 (이제 rent_admin만으로는 설정되지 않음)
            session['admin_id'] = student_id
            session['admin_name'] = student_name

            return jsonify({
                "message": "모더레이터 로그인 성공!",
                "status": "admin", # 기존 클라이언트 호환
                "rent_admin": bool(rent_admin),
                "eta_admin": True,
                "admin_id": student_id,
                "student_id": student_id,
                "student_name": student_name
            }), 200
        else:
            # 일반 학생 (rent_admin만 있는 경우도 여기 포함됨)
            return jsonify({
                "message": "로그인 성공!",
                "status": "success",
                "rent_admin": bool(rent_admin),
                "eta_admin": False,
                "student_id": student_id,
                "student_name": student_name
            }), 200
    else:
        return jsonify({
            "message": "잘못된 ID 또는 비밀번호입니다.",
            "status": "error"
        }), 401


# 로그아웃
@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({
        "message": "로그아웃 되었습니다."
    })

# 세션 확인
@auth_bp.route('/check_session', methods=['GET'])
def check_session():
    # 이제 admin_id 세션은 eta_admin인 경우에만 생성됨
    logged = bool(session.get("student_id") or session.get("admin_id"))
    return jsonify({
        "student_id": session.get("student_id"),
        "student_name": session.get("student_name"),
        "admin_id": session.get("admin_id"),
        "rent_admin": bool(session.get("rent_admin")),
        "eta_admin": bool(session.get("eta_admin")),
        "status": "success" if logged else "unauthorized"
    }), 200


# 비밀번호 변경
@auth_bp.route('/change_password', methods=['POST'])
def change_password():
    student_id = session.get('student_id')
    if not student_id:
        return jsonify({"message": "로그인이 필요합니다.", "status": "error"}), 401

    data = request.get_json(silent=True) or {}
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not current_password or not new_password:
        return jsonify({"message": "현재 비밀번호와 새 비밀번호를 모두 입력해주세요.", "status": "error"}), 400

    db = DatabaseManager()
    
    # 현재 비밀번호 확인
    student = db.query(
        """
        SELECT student_id FROM Students
        WHERE student_id = %(student_id)s AND student_pw = SHA2(%(current_password)s, 256)
        """,
        student_id=student_id,
        current_password=current_password
    ).result

    if not student:
        return jsonify({"message": "현재 비밀번호가 일치하지 않습니다.", "status": "error"}), 401

    # 새 비밀번호 업데이트
    db.query(
        """
        UPDATE Students
        SET student_pw = SHA2(%(new_password)s, 256)
        WHERE student_id = %(student_id)s
        """,
        new_password=new_password,
        student_id=student_id
    )
    db.commit()

    return jsonify({"message": "비밀번호가 성공적으로 변경되었습니다.", "status": "success"}), 200

