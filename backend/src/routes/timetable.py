from flask import Blueprint, request, session, jsonify
from ..utils.database_util import DatabaseManager

timetable_bp = Blueprint('timetable', __name__, url_prefix='/timetable')

@timetable_bp.route('', methods=['GET'])
def get_timetable():
    student_id = session.get('student_id')
    if not student_id:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401

    db = DatabaseManager()
    
    # 시간표 데이터 조회
    timetable_data = db.fetch_all(
        """
        SELECT timetable_id, day_of_week, period, subject_name, location, memo 
        FROM Timetable 
        WHERE student_id = %(student_id)s
        ORDER BY day_of_week, period
        """,
        student_id=student_id
    )

    return jsonify({
        "status": "success",
        "timetable": timetable_data
    }), 200

@timetable_bp.route('', methods=['PUT'])
def update_timetable():
    student_id = session.get('student_id')
    if not student_id:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401

    data = request.get_json(silent=True)
    if data is None or 'timetable' not in data:
        return jsonify({"status": "error", "message": "시간표 데이터가 필요합니다."}), 400

    new_timetable = data['timetable']

    # 유효성 검사 및 중복 체크
    seen = set()
    for item in new_timetable:
        day = item.get('day_of_week')
        period = item.get('period')
        subject = item.get('subject_name')

        if day is None or not (1 <= int(day) <= 5):
            return jsonify({"status": "error", "message": "요일은 1(월)~5(금) 범위여야 합니다."}), 400
        if period is None or not (1 <= int(period) <= 7):
            return jsonify({"status": "error", "message": "교시는 1~7 범위여야 합니다."}), 400
        if not subject or not str(subject).strip():
            return jsonify({"status": "error", "message": "과목명은 필수입니다."}), 400

        key = (int(day), int(period))
        if key in seen:
            return jsonify({"status": "error", "message": f"같은 요일·교시({day}요일 {period}교시)에 중복 항목이 있습니다."}), 400
        seen.add(key)

    db = DatabaseManager()

    # 시간표 저장할떄 초기화
    try:
        # 기존 시간표 삭제
        db.query("DELETE FROM Timetable WHERE student_id = %(student_id)s", student_id=student_id)

        # 시간표 삽입
        if new_timetable:
            insert_sql = """
                INSERT INTO Timetable (student_id, day_of_week, period, subject_name, location, memo) 
                VALUES (%(student_id)s, %(day_of_week)s, %(period)s, %(subject_name)s, %(location)s, %(memo)s)
            """
            for item in new_timetable:
                db.query(insert_sql, 
                    student_id=student_id,
                    day_of_week=int(item.get('day_of_week')),
                    period=int(item.get('period')),
                    subject_name=str(item.get('subject_name')).strip(),
                    location=str(item.get('location')).strip() if item.get('location') else None,
                    memo=str(item.get('memo')).strip() if item.get('memo') else None
                )

        db.commit()
        return jsonify({"status": "success", "message": "시간표가 저장되었습니다."}), 200

    except Exception as e:
        print(f"시간표 저장 오류: {e}")
        # 오류 발생하면 저장 ㄴㄴ
        return jsonify({"status": "error", "message": "시간표 저장 중 오류가 발생했습니다."}), 500
