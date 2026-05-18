from flask import Blueprint, request, session, jsonify
import re
from ..utils.database_util import DatabaseManager

posts_bp = Blueprint('posts', __name__)


# ────────────────────────────────────────────
# 게시물 목록 조회
# GET /posts?page=1&limit=20
# ────────────────────────────────────────────
@posts_bp.route('/posts', methods=['GET'])
def get_posts():
    db = DatabaseManager()

    # 페이지네이션 파라미터
    try:
        page  = max(1, int(request.args.get('page', 1)))
        limit = max(1, min(100, int(request.args.get('limit', 20))))
    except ValueError:
        return jsonify({"status": "error", "message": "page, limit은 정수여야 합니다."}), 400

    offset = (page - 1) * limit

    board_type_input = request.args.get('board_type', 'general').strip()
    
    board_type = board_type_input
    target_grade = None
    if board_type_input in ['grade1', 'grade2', 'grade3']:
        board_type = 'grade'
        target_grade = int(board_type_input[-1])

    if board_type not in ['general', 'grade', 'lost_found']:
        board_type = 'general'

    current_user = session.get('student_id', '')
    is_eta_admin = session.get('eta_admin') is True

    # 관리자가 삭제된 항목을 볼 수 있는지 여부
    include_deleted = request.args.get('include_deleted', 'false').lower() == 'true'
    show_deleted = include_deleted and is_eta_admin
    deleted_filter = "" if show_deleted else "AND p.is_deleted = FALSE"

    # 쿼리 조건 생성
    where_clause = f"WHERE p.board_type = %(board_type)s {deleted_filter}"
    
    if board_type == 'grade':
        if is_eta_admin:
            if target_grade:
                where_clause = f"WHERE p.board_type = 'grade' {deleted_filter} AND s.grade = {target_grade}"
            else:
                where_clause = f"WHERE p.board_type = 'grade' {deleted_filter}"
        else:
            if not current_user:
                return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401
            where_clause = f"""WHERE p.board_type = 'grade' {deleted_filter} 
                              AND s.grade = (SELECT grade FROM Students WHERE student_id = %(current_user)s)"""

    # 전체 게시물 수
    count_sql = f"SELECT COUNT(*) FROM Posts p JOIN Students s ON p.author_id = s.student_id {where_clause}"
    total_count = db.query(count_sql, board_type=board_type, current_user=current_user).result[0][0]

    # 게시물 목록 (작성자 이름, 댓글 수 포함)
    sql = f"""
        SELECT
            p.post_id,
            p.title,
            p.content,
            p.created_at,
            p.author_id,
            s.student_name,
            p.is_anonymous,
            (SELECT COUNT(*) FROM Comments c WHERE c.post_id = p.post_id AND c.is_deleted = FALSE) AS comment_count,
            (SELECT COUNT(*) FROM PostLikes pl WHERE pl.post_id = p.post_id) AS likes_count,
            EXISTS(SELECT 1 FROM PostLikes pl WHERE pl.post_id = p.post_id AND pl.student_id = %(current_user)s) AS is_liked,
            p.board_type,
            p.is_deleted
        FROM Posts p
        JOIN Students s ON p.author_id = s.student_id
        {where_clause}
        ORDER BY p.created_at DESC
        LIMIT %(limit)s OFFSET %(offset)s
    """

    rows = db.query(sql, limit=limit, offset=offset, board_type=board_type, current_user=current_user).result

    posts = []
    for row in rows:
        raw_content = row[2] or ""
        # 1. <img> 태그를 [이미지] 로 변경
        clean_content = re.sub(r'<img[^>]*>', '[이미지]', raw_content)
        # 2. [gif:...] 기존 포맷을 [GIF] 로 변경
        clean_content = re.sub(r'\[gif:.*?\]', '[GIF]', clean_content)
        # 3. 나머지 모든 HTML 태그를 공백으로 치환하여 제거
        clean_content = re.sub(r'<[^>]+>', ' ', clean_content)
        # 3-1. &nbsp; 및 기타 특수문자 처리
        import html
        clean_content = html.unescape(clean_content)
        clean_content = clean_content.replace('\xa0', ' ')
        # 4. 연속된 공백을 하나로 압축
        clean_content = re.sub(r'\s+', ' ', clean_content).strip()
        
        content_preview = clean_content[:100] + "…" if len(clean_content) > 100 else clean_content
        is_anon = bool(row[6])
        is_del = bool(row[11])

        posts.append({
            "post_id":         row[0],
            "title":           row[1],
            "content_preview": content_preview,
            "created_at":      row[3].strftime('%Y-%m-%d %H:%M:%S') if row[3] else None,
            "author_id":       None if is_anon else row[4],
            "author_name":     "익명" if is_anon else row[5],
            "is_anonymous":    is_anon,
            "comment_count":   row[7],
            "likes_count":     row[8],
            "is_liked":        bool(row[9]),
            "board_type":      row[10],
            "is_deleted":      is_del,
        })

    return jsonify({
        "status":  "success",
        "message": "게시물 목록을 가져왔습니다.",
        "data": {
            "posts":       posts,
            "total_count": total_count,
            "page":        page,
            "limit":       limit,
            "total_pages": -(-total_count // limit),   # ceiling division
        }
    })


# ────────────────────────────────────────────
# 게시물 상세 조회
# GET /posts/<post_id>
# ────────────────────────────────────────────
@posts_bp.route('/posts/<int:post_id>', methods=['GET'])
def get_post(post_id):
    db = DatabaseManager()

    # 관리자가 삭제된 항목을 볼 수 있는지 여부
    include_deleted = request.args.get('include_deleted', 'false').lower() == 'true'
    is_admin = session.get('eta_admin') is True
    show_deleted = include_deleted and is_admin

    deleted_filter = "" if show_deleted else "AND p.is_deleted = FALSE"
    sql = f"""
        SELECT
            p.post_id,
            p.title,
            p.content,
            p.created_at,
            p.author_id,
            s.student_name,
            p.is_anonymous,
            (SELECT COUNT(*) FROM Comments c WHERE c.post_id = p.post_id AND c.is_deleted = FALSE) AS comment_count,
            (SELECT COUNT(*) FROM PostLikes pl WHERE pl.post_id = p.post_id) AS likes_count,
            EXISTS(SELECT 1 FROM PostLikes pl WHERE pl.post_id = p.post_id AND pl.student_id = %(current_user)s) AS is_liked,
            p.board_type,
            s.grade,
            p.is_deleted
        FROM Posts p
        JOIN Students s ON p.author_id = s.student_id
        WHERE p.post_id = %(post_id)s {deleted_filter}
    """

    current_user = session.get('student_id', '')
    rows = db.query(sql, post_id=post_id, current_user=current_user).result

    if not rows:
        return jsonify({"status": "error", "message": "게시물을 찾을 수 없습니다."}), 404

    row = rows[0]
    board_type = row[10]
    author_grade = row[11]
    
    is_eta_admin = session.get('eta_admin') is True
    
    if board_type == 'grade' and not is_eta_admin:
        if not current_user:
            return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401
            
        current_user_grade = session.get('grade')
        if not current_user_grade:
            user_res = db.query("SELECT grade FROM Students WHERE student_id = %(current_user)s", current_user=current_user).result
            if user_res:
                current_user_grade = user_res[0][0]
                session['grade'] = current_user_grade
                
        if current_user_grade != author_grade:
            return jsonify({"status": "error", "message": "다른 학년의 게시물은 열람할 수 없습니다."}), 403

    is_anon = bool(row[6])
    real_author_id = row[4]
    is_del = bool(row[12])

    post = {
        "post_id":       row[0],
        "title":         row[1],
        "content":       row[2],
        "created_at":    row[3].strftime('%Y-%m-%d %H:%M:%S') if row[3] else None,
        "author_id":     None if is_anon else real_author_id,
        "author_name":   "익명" if is_anon else row[5],
        "is_anonymous":  is_anon,
        "comment_count": row[7],
        "likes_count":   row[8],
        "is_liked":      bool(row[9]),
        "is_mine":       (current_user == real_author_id) if current_user else False,
        "board_type":    board_type,
        "is_deleted":    is_del
    }

    return jsonify({
        "status":  "success",
        "message": "게시물을 가져왔습니다.",
        "data":    post
    })


# ────────────────────────────────────────────
# 게시물 작성
# POST /posts
# Body: { "title": "...", "content": "..." }
# ────────────────────────────────────────────
@posts_bp.route('/posts', methods=['POST'])
def create_post():
    if 'student_id' not in session:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401

    data         = request.get_json(silent=True) or {}
    title        = data.get('title', '').strip()
    content      = data.get('content', '').strip()
    is_anonymous = bool(data.get('is_anonymous', False))
    board_type_input = data.get('board_type', 'general').strip()
    board_type = board_type_input
    
    if board_type_input in ['grade1', 'grade2', 'grade3']:
        board_type = 'grade'
    
    if board_type not in ['general', 'grade', 'lost_found']:
        return jsonify({"status": "error", "message": "유효하지 않은 게시판 종류입니다."}), 400

    if not title:
        return jsonify({"status": "error", "message": "제목을 입력해주세요."}), 400
    if not content:
        return jsonify({"status": "error", "message": "내용을 입력해주세요."}), 400
    if len(title) > 255:
        return jsonify({"status": "error", "message": "제목은 255자 이내여야 합니다."}), 400

    student_id = session['student_id']
    db = DatabaseManager()

    sql = """
        INSERT INTO Posts (author_id, title, content, is_anonymous, board_type)
        VALUES (%(author_id)s, %(title)s, %(content)s, %(is_anonymous)s, %(board_type)s)
    """

    try:
        db.query(sql, author_id=student_id, title=title, content=content, is_anonymous=is_anonymous, board_type=board_type)
        db.commit()

        # 방금 삽입된 post_id 조회
        new_id_row = db.query("SELECT LAST_INSERT_ID()").result
        new_post_id = new_id_row[0][0] if new_id_row else None

        return jsonify({
            "status":  "success",
            "message": "게시물이 등록되었습니다.",
            "data":    {"post_id": new_post_id}
        }), 201

    except Exception as e:
        return jsonify({"status": "error", "message": f"서버 오류: {str(e)}"}), 500

# ────────────────────────────────────────────
# 게시물 삭제 (본인 게시물 논리적 삭제)
# DELETE /posts/<post_id>
# ────────────────────────────────────────────
@posts_bp.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if 'student_id' not in session:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401

    student_id = session['student_id']
    db = DatabaseManager()

    # 게시물 존재 여부 및 작성자 확인
    post = db.query("SELECT author_id, is_deleted FROM Posts WHERE post_id = %(post_id)s", post_id=post_id).result
    if not post:
        return jsonify({"status": "error", "message": "게시물을 찾을 수 없습니다."}), 404

    if post[0][1]:
        return jsonify({"status": "error", "message": "이미 삭제된 게시물입니다."}), 400

    if post[0][0] != student_id:
        return jsonify({"status": "error", "message": "본인의 게시물만 삭제할 수 있습니다."}), 403

    # 논리적 삭제 (is_deleted = TRUE)
    db.query("UPDATE Posts SET is_deleted = TRUE WHERE post_id = %(post_id)s", post_id=post_id)
    db.commit()

    return jsonify({"status": "success", "message": "게시물이 삭제되었습니다."})


# ────────────────────────────────────────────
# 게시물 좋아요
# POST /posts/<post_id>/like
# ────────────────────────────────────────────
@posts_bp.route('/posts/<int:post_id>/like', methods=['POST'])
def like_post(post_id):
    if 'student_id' not in session:
        return jsonify({"status": "error", "message": "로그인이 필요합니다."}), 401
        
    student_id = session['student_id']
    db = DatabaseManager()
    
    # 이미 좋아요 했는지 확인 (토글 기능)
    check_sql = "SELECT 1 FROM PostLikes WHERE post_id = %(post_id)s AND student_id = %(student_id)s"
    existing = db.query(check_sql, post_id=post_id, student_id=student_id).result
    
    if existing:
        # 좋아요 취소
        db.query("DELETE FROM PostLikes WHERE post_id = %(post_id)s AND student_id = %(student_id)s", post_id=post_id, student_id=student_id)
        msg = "좋아요가 취소되었습니다."
        liked = False
    else:
        # 좋아요 추가
        db.query("INSERT INTO PostLikes (post_id, student_id) VALUES (%(post_id)s, %(student_id)s)", post_id=post_id, student_id=student_id)
        msg = "좋아요를 눌렀습니다."
        liked = True
        
    db.commit()
    
    # 현재 좋아요 수 반환
    count_sql = "SELECT COUNT(*) FROM PostLikes WHERE post_id = %(post_id)s"
    count = db.query(count_sql, post_id=post_id).result[0][0]
    
    return jsonify({
        "status": "success",
        "message": msg,
        "data": {
            "likes_count": count,
            "is_liked": liked
        }
    })
