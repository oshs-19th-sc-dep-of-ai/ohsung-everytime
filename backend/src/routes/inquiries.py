from flask import Blueprint, request, session, jsonify
from ..utils.database_util import DatabaseManager
from ..utils.firebase_util import FirebaseManager

inquiries_bp = Blueprint('inquiries', __name__)

# 문의 목록 조회
@inquiries_bp.route('/inquiries', methods=['GET'])
def get_inquiries():
    if 'student_id' not in session and 'admin_id' not in session:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401
    
    db = DatabaseManager()
    is_admin = session.get('eta_admin') is True
    
    if is_admin:
        sql = """
            SELECT i.inquiry_id, i.student_id, i.title, i.status, i.created_at, i.updated_at, s.student_name
            FROM Inquiries i
            JOIN Students s ON i.student_id = s.student_id
            ORDER BY i.updated_at DESC
        """
        rows = db.query(sql).result
    else:
        student_id = session.get('student_id')
        sql = """
            SELECT i.inquiry_id, i.student_id, i.title, i.status, i.created_at, i.updated_at, s.student_name
            FROM Inquiries i
            JOIN Students s ON i.student_id = s.student_id
            WHERE i.student_id = %(student_id)s
            ORDER BY i.updated_at DESC
        """
        rows = db.query(sql, student_id=student_id).result
        
    inquiries = []
    for r in rows:
        inquiries.append({
            "inquiry_id": r[0],
            "student_id": r[1],
            "title": r[2],
            "status": r[3],
            "created_at": r[4].strftime('%Y-%m-%d %H:%M:%S') if r[4] else None,
            "updated_at": r[5].strftime('%Y-%m-%d %H:%M:%S') if r[5] else None,
            "student_name": r[6]
        })
        
    return jsonify({
        "status": "success",
        "data": inquiries
    }), 200

# 문의 스레드 생성
@inquiries_bp.route('/inquiries', methods=['POST'])
def create_inquiry():
    if 'student_id' not in session:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401
        
    data = request.get_json(silent=True) or {}
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    
    if not title or not content:
        return jsonify({"status": "error", "message": "제목과 내용을 입력해주세요."}), 400
        
    student_id = session['student_id']
    db = DatabaseManager()
    
    try:
        # Inquiries 테이블에 스레드 생성
        sql_inquiry = "INSERT INTO Inquiries (student_id, title) VALUES (%(student_id)s, %(title)s)"
        db.query(sql_inquiry, student_id=student_id, title=title)
        
        # 방금 생성된 inquiry_id 조회
        new_id_row = db.query("SELECT LAST_INSERT_ID()").result
        inquiry_id = new_id_row[0][0]
        
        # 첫 메시지 저장
        sql_msg = "INSERT INTO InquiryMessages (inquiry_id, sender_type, content) VALUES (%(inquiry_id)s, 'user', %(content)s)"
        db.query(sql_msg, inquiry_id=inquiry_id, content=content)
        
        db.commit()
        return jsonify({"status": "success", "message": "문의가 접수되었습니다.", "data": {"inquiry_id": inquiry_id}}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 문의 상세(메시지) 조회
@inquiries_bp.route('/inquiries/<int:inquiry_id>/messages', methods=['GET'])
def get_inquiry_messages(inquiry_id):
    if 'student_id' not in session and 'admin_id' not in session:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401
        
    db = DatabaseManager()
    is_admin = session.get('eta_admin') is True
    student_id = session.get('student_id')
    
    # 접근 권한 체크
    inquiry_res = db.query("SELECT student_id, title, status, created_at FROM Inquiries WHERE inquiry_id = %(inquiry_id)s", inquiry_id=inquiry_id).result
    if not inquiry_res:
        return jsonify({"status": "error", "message": "존재하지 않는 문의입니다."}), 404
        
    owner_id = inquiry_res[0][0]
    if not is_admin and owner_id != student_id:
        return jsonify({"status": "error", "message": "권한이 없습니다."}), 403
        
    msg_res = db.query("SELECT message_id, sender_type, content, created_at FROM InquiryMessages WHERE inquiry_id = %(inquiry_id)s ORDER BY created_at ASC", inquiry_id=inquiry_id).result
    
    messages = []
    for m in msg_res:
        messages.append({
            "message_id": m[0],
            "sender_type": m[1],
            "content": m[2],
            "created_at": m[3].strftime('%Y-%m-%d %H:%M:%S') if m[3] else None
        })
        
    return jsonify({
        "status": "success",
        "data": {
            "inquiry_id": inquiry_id,
            "title": inquiry_res[0][1],
            "status": inquiry_res[0][2],
            "created_at": inquiry_res[0][3].strftime('%Y-%m-%d %H:%M:%S') if inquiry_res[0][3] else None,
            "messages": messages
        }
    }), 200

# 문의 메시지(답변/추가질문) 작성
@inquiries_bp.route('/inquiries/<int:inquiry_id>/messages', methods=['POST'])
def add_inquiry_message(inquiry_id):
    if 'student_id' not in session and 'admin_id' not in session:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401
        
    db = DatabaseManager()
    is_admin = session.get('eta_admin') is True
    student_id = session.get('student_id')
    
    inquiry_res = db.query("SELECT student_id, title FROM Inquiries WHERE inquiry_id = %(inquiry_id)s", inquiry_id=inquiry_id).result
    if not inquiry_res:
        return jsonify({"status": "error", "message": "존재하지 않는 문의입니다."}), 404
        
    owner_id = inquiry_res[0][0]
    inquiry_title = inquiry_res[0][1]
    
    if not is_admin and owner_id != student_id:
        return jsonify({"status": "error", "message": "권한이 없습니다."}), 403
        
    data = request.get_json(silent=True) or {}
    content = data.get('content', '').strip()
    
    if not content:
        return jsonify({"status": "error", "message": "내용을 입력해주세요."}), 400
        
    sender_type = 'admin' if is_admin else 'user'
    
    try:
        # 메시지 저장
        db.query("INSERT INTO InquiryMessages (inquiry_id, sender_type, content) VALUES (%(inquiry_id)s, %(sender_type)s, %(content)s)",
                 inquiry_id=inquiry_id, sender_type=sender_type, content=content)
        
        # 스레드 업데이트 (시간 및 상태 갱신)
        new_status = 'answered' if is_admin else 'pending'
        db.query("UPDATE Inquiries SET status = %(status)s, updated_at = CURRENT_TIMESTAMP WHERE inquiry_id = %(inquiry_id)s",
                 status=new_status, inquiry_id=inquiry_id)
                 
        db.commit()
        
        # 푸시 알림 전송 (관리자가 답변했을 때 유저에게)
        if is_admin:
            try:
                fm = FirebaseManager()
                fm.send_push_notification(
                    user_id=owner_id,
                    title="문의하신 내용에 답변이 등록되었습니다.",
                    body=f"[{inquiry_title}]\n{content[:50]}{'...' if len(content) > 50 else ''}",
                    data={"inquiry_id": str(inquiry_id), "type": "inquiry_answer"}
                )
            except Exception as push_err:
                print(f"푸시 알림 전송 실패: {push_err}")
                
        return jsonify({"status": "success", "message": "메시지가 등록되었습니다."}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
