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

    # 전체 게시물 수
    count_sql = "SELECT COUNT(*) FROM Posts"
    total_count = db.query(count_sql).result[0][0]

    # 게시물 목록 (작성자 이름, 댓글 수 포함)
    sql = """
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
            EXISTS(SELECT 1 FROM PostLikes pl WHERE pl.post_id = p.post_id AND pl.student_id = %(current_user)s) AS is_liked
        FROM Posts p
        JOIN Students s ON p.author_id = s.student_id
        ORDER BY p.created_at DESC
        LIMIT %(limit)s OFFSET %(offset)s
    """

    current_user = session.get('student_id', '')
    rows = db.query(sql, limit=limit, offset=offset, current_user=current_user).result

    posts = []
    for row in rows:
        raw_content = row[2] or ""
        clean_content = re.sub(r'\[gif:.*?\]', '[GIF]', raw_content).strip()
        content_preview = clean_content[:100] + "…" if len(clean_content) > 100 else clean_content
        is_anon = bool(row[6])

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

    sql = """
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
            EXISTS(SELECT 1 FROM PostLikes pl WHERE pl.post_id = p.post_id AND pl.student_id = %(current_user)s) AS is_liked
        FROM Posts p
        JOIN Students s ON p.author_id = s.student_id
        WHERE p.post_id = %(post_id)s
    """

    current_user = session.get('student_id', '')
    rows = db.query(sql, post_id=post_id, current_user=current_user).result

    if not rows:
        return jsonify({"status": "error", "message": "게시물을 찾을 수 없습니다."}), 404

    row = rows[0]
    is_anon = bool(row[6])
    real_author_id = row[4]

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

    if not title:
        return jsonify({"status": "error", "message": "제목을 입력해주세요."}), 400
    if not content:
        return jsonify({"status": "error", "message": "내용을 입력해주세요."}), 400
    if len(title) > 255:
        return jsonify({"status": "error", "message": "제목은 255자 이내여야 합니다."}), 400

    student_id = session['student_id']
    db = DatabaseManager()

    sql = """
        INSERT INTO Posts (author_id, title, content, is_anonymous)
        VALUES (%(author_id)s, %(title)s, %(content)s, %(is_anonymous)s)
    """

    try:
        db.query(sql, author_id=student_id, title=title, content=content, is_anonymous=is_anonymous)
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
