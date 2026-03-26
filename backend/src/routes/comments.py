from flask import Blueprint, request, session, jsonify
from ..utils.database_util import DatabaseManager

comments_bp = Blueprint('comments', __name__)

# 댓글 목록 조회 (대댓글 계층 구조로 변환)
@comments_bp.route('/posts/<int:post_id>/comments', methods=['GET'])
def get_comments(post_id):
    db = DatabaseManager()
    
    # 해당 게시글의 모든 댓글 조회 (작성자 정보 포함)
    # 삭제된 댓글이라도 대댓글이 있으면 "삭제된 댓글입니다"로 표시하기 위해 조회는 해옴
    # 혹은 프론트에서 처리. 여기서는 is_deleted 플래그를 그대로 전달.
    sql = """
        SELECT 
            c.comment_id, c.post_id, c.content, c.parent_id, c.is_anonymous, c.created_at, c.is_deleted,
            s.student_name, s.student_id,
            (SELECT COUNT(*) FROM CommentLikes cl WHERE cl.comment_id = c.comment_id) as likes_count,
            EXISTS(SELECT 1 FROM CommentLikes cl WHERE cl.comment_id = c.comment_id AND cl.student_id = %(current_user)s) as is_liked
        FROM Comments c
        JOIN Students s ON c.author_id = s.student_id
        WHERE c.post_id = %(post_id)s
        ORDER BY c.created_at ASC
    """
    
    current_user = session.get('student_id', '') # 로그인 안했으면 ''
    
    rows = db.query(sql, post_id=post_id, current_user=current_user).result
    
    # 댓글을 딕셔너리 형태로 변환 및 익명 처리
    comment_map = {}
    root_comments = []
    
    # 1차 가공: 데이터 객체화
    for row in rows:
        # row는 튜플로 반환됨 (DatabaseManager 구현에 따라 다를 수 있으나 보통 튜플)
        # SELECT 순서: 
        # 0:comment_id, 1:post_id, 2:content, 3:parent_id, 4:is_anonymous, 
        # 5:created_at, 6:is_deleted, 7:student_name, 8:student_id, 9:likes_count, 10:is_liked
        
        c_id = row[0]
        is_anon = bool(row[4])
        is_del = bool(row[6])
        real_author_id = row[8]
        author_name = "익명" if is_anon else row[7]
        
        # 본인 댓글 여부 확인
        is_mine = (current_user == real_author_id) if current_user else False

        # 익명일 경우 author_id 숨김 (단, 필요한 경우 해시값 등으로 대체 가능)
        # 여기서는 아예 None으로 보내거나, 실명일 때만 보냄
        public_author_id = None if is_anon else real_author_id
        
        comment_obj = {
            "comment_id": c_id,
            "content": "삭제된 댓글입니다." if is_del else row[2],
            "parent_id": row[3],
            "is_anonymous": is_anon,
            "created_at": row[5], 
            "is_deleted": is_del,
            "author_name": author_name,
            "author_id": public_author_id, # 익명이면 None
            "is_mine": is_mine,            # 프론트 권한 확인용
            "likes_count": row[9],
            "is_liked": bool(row[10]),
            "replies": []
        }
        
        # datetime string convert
        if comment_obj["created_at"]:
            comment_obj["created_at"] = comment_obj["created_at"].strftime('%Y-%m-%d %H:%M:%S')

        comment_map[c_id] = comment_obj

    # 2차 가공: 계층 구조 조립
    for c_id, obj in comment_map.items():
        parent_id = obj['parent_id']
        if parent_id and parent_id in comment_map:
            comment_map[parent_id]['replies'].append(obj)
        else:
            root_comments.append(obj)
            
    return jsonify({
        "status": "success",
        "message": "Comments retrieved successfully",
        "data": root_comments
    })

# 댓글 작성
@comments_bp.route('/posts/<int:post_id>/comments', methods=['POST'])
def add_comment(post_id):
    if 'student_id' not in session:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401
        
    data = request.get_json(silent=True) or {}
    content = data.get('content')
    parent_id = data.get('parent_id') # 대댓글일 경우
    is_anonymous = data.get('is_anonymous', False)
    
    if not content:
        return jsonify({"status": "error", "message": "내용을 입력해주세요."}), 400
        
    student_id = session['student_id']
    db = DatabaseManager()
    
    # parent_id 유효성 검사 (옵션)
    if parent_id:
        parent = db.query("SELECT comment_id FROM Comments WHERE comment_id = %(parent_id)s", parent_id=parent_id).result
        if not parent:
             return jsonify({"status": "error", "message": "원댓글이 존재하지 않습니다."}), 404

    sql = """
        INSERT INTO Comments (post_id, author_id, content, parent_id, is_anonymous)
        VALUES (%(post_id)s, %(student_id)s, %(content)s, %(parent_id)s, %(is_anonymous)s)
    """
    
    db.query(sql, post_id=post_id, student_id=student_id, content=content, parent_id=parent_id, is_anonymous=is_anonymous)
    db.commit()
    
    return jsonify({
        "status": "success", 
        "message": "댓글이 등록되었습니다."
    }), 201

# 댓글 좋아요
@comments_bp.route('/comments/<int:comment_id>/like', methods=['POST'])
def like_comment(comment_id):
    if 'student_id' not in session:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401
        
    student_id = session['student_id']
    db = DatabaseManager()
    
    # 이미 좋아요 했는지 확인 (토글 기능)
    check_sql = "SELECT 1 FROM CommentLikes WHERE comment_id = %(comment_id)s AND student_id = %(student_id)s"
    existing = db.query(check_sql, comment_id=comment_id, student_id=student_id).result
    
    if existing:
        # 좋아요 취소
        db.query("DELETE FROM CommentLikes WHERE comment_id = %(comment_id)s AND student_id = %(student_id)s", comment_id=comment_id, student_id=student_id)
        msg = "좋아요가 취소되었습니다."
        liked = False
    else:
        # 좋아요 추가
        db.query("INSERT INTO CommentLikes (comment_id, student_id) VALUES (%(comment_id)s, %(student_id)s)", comment_id=comment_id, student_id=student_id)
        msg = "좋아요를 눌렀습니다."
        liked = True
        
    db.commit()
    
    # 현재 좋아요 수 반환
    count_sql = "SELECT COUNT(*) FROM CommentLikes WHERE comment_id = %(comment_id)s"
    count = db.query(count_sql, comment_id=comment_id).result[0][0]
    
    return jsonify({
        "status": "success",
        "message": msg,
        "data": {
            "likes_count": count,
            "is_liked": liked
        }
    })

# 댓글 수정
@comments_bp.route('/comments/<int:comment_id>', methods=['PATCH'])
def update_comment(comment_id):
    if 'student_id' not in session:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401
    
    data = request.get_json(silent=True) or {}
    new_content = data.get('content')
    
    if not new_content:
        return jsonify({"status": "error", "message": "수정할 내용을 입력해주세요."}), 400
        
    student_id = session['student_id']
    db = DatabaseManager()
    
    try:
        comment_query = "SELECT content, author_id, is_deleted FROM Comments WHERE comment_id = %(comment_id)s"
        comment_res = db.query(comment_query, comment_id=comment_id).result
        
        if not comment_res:
            return jsonify({"status": "error", "message": "댓글을 찾을 수 없습니다."}), 404
            
        old_comment = comment_res[0]
        
        if old_comment[2]:
            return jsonify({"status": "error", "message": "삭제된 댓글은 수정할 수 없습니다."}), 400
            
        if old_comment[1] != student_id:
            return jsonify({"status": "error", "message": "본인의 댓글만 수정할 수 있습니다."}), 403

        history_sql = """
            INSERT INTO CommentHistory (comment_id, prev_content, new_content)
            VALUES (%(comment_id)s, %(prev_content)s, %(new_content)s)
        """
        db.query(history_sql, comment_id=comment_id, prev_content=old_comment[0], new_content=new_content)
        
        update_sql = "UPDATE Comments SET content = %(new_content)s WHERE comment_id = %(comment_id)s"
        db.query(update_sql, new_content=new_content, comment_id=comment_id)
        
        db.commit()
        
        return jsonify({
            "status": "success",
            "message": "댓글이 수정되었으며 변경 이력이 기록되었습니다."
        })

    except Exception as e:
        return jsonify({"status": "error", "message": f"서버 오류: {str(e)}"}), 500

# 특정 댓글의 수정 이력 전체 조회
@comments_bp.route('/comments/<int:comment_id>/history', methods=['GET'])
def get_comment_history(comment_id):
    db = DatabaseManager()
    try:
        history_sql = """
            SELECT prev_content, new_content, changed_at 
            FROM CommentHistory 
            WHERE comment_id = %(comment_id)s 
            ORDER BY changed_at DESC
        """
        rows = db.query(history_sql, comment_id=comment_id).result
        
        history_list = []
        for row in rows:
            history_list.append({
                "prev_content": row[0],
                "new_content": row[1],
                "changed_at": row[2].strftime('%Y-%m-%d %H:%M:%S') if row[2] else None
            })
            
        return jsonify({
            "status": "success",
            "message": "Comment history retrieved successfully",
            "data": history_list
        })
    except Exception as e:
        return jsonify({"status": "error", "message": "이력 조회 중 오류 발생"}), 500
