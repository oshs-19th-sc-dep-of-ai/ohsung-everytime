from flask import Blueprint, request, session, jsonify
from ..utils.database_util import DatabaseManager
from ..utils.config_util import ConfigManager as Config
from ..utils.student_util import get_grade, get_class
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
    
    # 1. DB에서 기존 시간표 조회 (색상/메모 등)
    db_timetable = db.fetch_all(
        """
        SELECT timetable_id, day_of_week, period, subject_name, location, memo, color 
        FROM Timetable 
        WHERE student_id = %(student_id)s
        ORDER BY day_of_week, period
        """,
        student_id=student_id
    )

    grade_res = db.query("SELECT grade FROM Students WHERE student_id = %(student_id)s", student_id=student_id).result
    grade = grade_res[0][0] if grade_res else 1
    
    class_nm = get_class(student_id)

    # 1학년인 경우 나이스 API에서 이번 주 시간표를 가져와 병합
    if grade == 1:
        cfg = Config().get()["NICEAPI"]
        today = datetime.now()
        # 주말이면 다음 주 월요일 기준으로 시간표 로드
        if today.weekday() > 4:
            today += timedelta(days=(7 - today.weekday()))
            
        monday = today - timedelta(days=today.weekday())
        friday = monday + timedelta(days=4)
        
        params = {
            "KEY": cfg["KEY"],
            "Type": "json",
            "pIndex": 1,
            "pSize": 200,
            "ATPT_OFCDC_SC_CODE": cfg["SCHULSC"],
            "SD_SCHUL_CODE": cfg["SCHULC"],
            "AY": monday.strftime("%Y"),
            "SEM": _get_semester(monday.strftime("%Y%m%d")),
            "TI_FROM_YMD": monday.strftime("%Y%m%d"),
            "TI_TO_YMD": friday.strftime("%Y%m%d"),
            "GRADE": str(grade),
            "CLASS_NM": str(class_nm)
        }

        neis_rows = []
        try:
            resp = http_requests.get(cfg["TIMETABLE"], params=params, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if "hisTimetable" in data:
                    neis_rows = data["hisTimetable"][1].get("row", [])
        except Exception as e:
            print(f"[NEIS] 1학년 자동 시간표 API 오류: {e}")

        # DB 데이터를 dict로 변환하여 (요일, 교시)를 키로 쉽게 접근할 수 있게 함
        db_map = {(row['day_of_week'], row['period']): row for row in db_timetable}
        
        merged_timetable = []
        
        # NEIS 데이터를 바탕으로 시간표 구성
        for row in neis_rows:
            date_str = row["ALL_TI_YMD"] # YYYYMMDD
            period_num = int(row["PERIO"])
            subject_name = row.get("ITRT_CNTNT", "").strip()
            if not subject_name:
                continue
                
            date_obj = datetime.strptime(date_str, "%Y%m%d")
            day_of_week = date_obj.weekday() + 1 # 1=월, 2=화, 3=수, 4=목, 5=금
            
            if day_of_week > 5:
                continue

            db_entry = db_map.get((day_of_week, period_num))
            
            merged_timetable.append({
                "timetable_id": db_entry['timetable_id'] if db_entry else None,
                "day_of_week": day_of_week,
                "period": period_num,
                "subject_name": subject_name,
                "location": f"1학년 {class_nm}반",
                "memo": db_entry['memo'] if db_entry else None,
                "color": db_entry['color'] if db_entry else '#EAF1FF'
            })
            
        timetable_data = merged_timetable
    else:
        timetable_data = db_timetable

    return jsonify({
        "status": "success",
        "timetable": timetable_data,
        "grade": grade
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
    DB에 저장된 사용자의 학년에 맞는 과목 목록을 반환합니다.
    """
    student_id = session.get('student_id')
    if not student_id:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401

    db = DatabaseManager()
    
    # 학생 학년 조회
    student = db.query("SELECT grade FROM Students WHERE student_id = %(student_id)s", student_id=student_id).result
    if not student:
        return jsonify({"status": "error", "message": "학생 정보를 찾을 수 없습니다."}), 404
        
    grade = student[0][0]
    
    # 해당 학년의 과목 조회
    subjects = db.query("SELECT subject_name FROM Subjects WHERE grade = %(grade)s ORDER BY subject_name", grade=grade).result
    
    subject_list = [{"subject": row[0]} for row in subjects]

    return jsonify({
        "status": "success",
        "grade": grade,
        "subjects": subject_list
    }), 200
