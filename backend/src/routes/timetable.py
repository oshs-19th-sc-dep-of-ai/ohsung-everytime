from flask import Blueprint, request, session, jsonify
from ..utils.database_util import DatabaseManager
from ..utils.config_util import ConfigManager as Config
import requests as http_requests
from datetime import datetime, timedelta

timetable_bp = Blueprint('timetable', __name__, url_prefix='/timetable')


def _get_neis_timetable(date_str: str):
    """NEIS API에서 특정 날짜의 3학년 시간표를 가져와 교시별로 그룹화해 반환."""
    cfg = Config().get()["NICEAPI"]
    params = {
        "KEY": cfg["KEY"],
        "Type": "json",
        "pIndex": 1,
        "pSize": 200,
        "ATPT_OFCDC_SC_CODE": cfg["SCHULSC"],
        "SD_SCHUL_CODE": cfg["SCHULC"],
        "AY": date_str[:4],          # 학년도 (YYYY)
        "SEM": _get_semester(date_str),
        "ALL_TI_YMD": date_str,      # YYYYMMDD
        "GRADE": "3",
    }

    try:
        resp = http_requests.get(cfg["TIMETABLE"], params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        rows = (
            data.get("hisTimetable", [{}])[1]
               .get("row", [])
        )
    except Exception as e:
        print(f"[NEIS] 시간표 API 오류: {e}")
        return None

    # ITRT_CNTNT이 없는 row(빈 데이터) 필터링
    rows = [r for r in rows if r.get("ITRT_CNTNT")]

    # 교시별로 그룹화: { "1": [ {subject, clrm} ... ], ... }
    by_period = {}
    for row in rows:
        period = str(row["PERIO"])
        entry = {
            "subject": row["ITRT_CNTNT"],
            "clrm": row.get("CLRM_NM", ""),
        }
        by_period.setdefault(period, [])
        # 동일한 과목+강의실 중복 제거
        if entry not in by_period[period]:
            by_period[period].append(entry)

    return by_period


def _get_semester(date_str: str) -> str:
    """날짜 문자열(YYYYMMDD)로 학기(1 or 2)를 추정."""
    month = int(date_str[4:6])
    return "1" if month <= 8 else "2"


def _nearest_school_day() -> str:
    """오늘이 주말이면 가장 가까운 평일(월요일)로 이동, YYYYMMDD 반환."""
    today = datetime.now()
    weekday = today.weekday()  # 0=월 … 6=일
    if weekday == 5:   # 토
        today += timedelta(days=2)
    elif weekday == 6: # 일
        today += timedelta(days=1)
    return today.strftime("%Y%m%d")

@timetable_bp.route('', methods=['GET'])
def get_timetable():
    student_id = session.get('student_id')
    if not student_id:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401

    db = DatabaseManager()
    
    # 시간표 데이터 조회
    timetable_data = db.fetch_all(
        """
        SELECT timetable_id, day_of_week, period, subject_name, location, memo, color 
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
                INSERT INTO Timetable (student_id, day_of_week, period, subject_name, location, memo, color) 
                VALUES (%(student_id)s, %(day_of_week)s, %(period)s, %(subject_name)s, %(location)s, %(memo)s, %(color)s)
            """
            for item in new_timetable:
                db.query(insert_sql, 
                    student_id=student_id,
                    day_of_week=int(item.get('day_of_week')),
                    period=int(item.get('period')),
                    subject_name=str(item.get('subject_name')).strip(),
                    location=str(item.get('location')).strip() if item.get('location') else None,
                    memo=str(item.get('memo')).strip() if item.get('memo') else None,
                    color=str(item.get('color')).strip() if item.get('color') else '#FFFFFF'
                )

        db.commit()
        return jsonify({"status": "success", "message": "시간표가 저장되었습니다."}), 200

    except Exception as e:
        print(f"시간표 저장 오류: {e}")
        # 오류 발생하면 저장 ㄴㄴ
        return jsonify({"status": "error", "message": "시간표 저장 중 오류가 발생했습니다."}), 500


@timetable_bp.route('/available', methods=['GET'])
def get_available_subjects():
    """
    NEIS API를 통해 특정 날짜(3학년)의 교시별 개설 과목 목록을 반환합니다.

    Query params:
      - date (optional): YYYYMMDD 형식의 날짜. 미입력 시 오늘(주말이면 다음 월요일) 기준.

    Response:
      {
        "status": "success",
        "date": "20260513",
        "by_period": {
          "1": [{"subject": "화법과 작문", "clrm": "E301"}, ...],
          "2": [...],
          ...
        }
      }
    """
    if not session.get('student_id'):
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401

    date_str = request.args.get('date', '').strip()

    # 날짜 유효성 검사 (YYYYMMDD, 8자리 숫자)
    if date_str:
        if not date_str.isdigit() or len(date_str) != 8:
            return jsonify({"status": "error", "message": "날짜 형식은 YYYYMMDD여야 합니다."}), 400
    else:
        date_str = _nearest_school_day()

    by_period = _get_neis_timetable(date_str)

    if by_period is None:
        return jsonify({"status": "error", "message": "NEIS API 조회에 실패했습니다."}), 502

    if not by_period:
        return jsonify({
            "status": "success",
            "date": date_str,
            "by_period": {},
            "message": "해당 날짜에 3학년 시간표 데이터가 없습니다."
        }), 200

    return jsonify({
        "status": "success",
        "date": date_str,
        "by_period": by_period
    }), 200
