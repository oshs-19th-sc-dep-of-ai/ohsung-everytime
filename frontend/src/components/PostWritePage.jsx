import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { useToast } from "../contexts/ToastContext.jsx";
import { useNetwork } from "../contexts/NetworkContext.jsx";
import { offlineQueue } from "../utils/offlineQueue.js";
import { GifPicker } from "./GifPicker.jsx";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import "./PostWritePage.css";

export const PostWritePage = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [boardType, setBoardType] = useState(
    () => sessionStorage.getItem("board_type") || "general",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const quillRef = useRef(null);
  const hoveredImgRef = useRef(null);
  const [hoveredImgState, setHoveredImgState] = useState(null);
  const { isOnline } = useNetwork();

  useEffect(() => {
    window.scrollTo(0, 0);

    const handleMouseOver = (e) => {
      if (e.target.tagName === "IMG" && e.target.closest(".ql-editor")) {
        const rect = e.target.getBoundingClientRect();
        const newData = {
          element: e.target,
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        };
        hoveredImgRef.current = newData;
        setHoveredImgState(newData);
      }
    };
    const handleMouseMove = (e) => {
      if (hoveredImgRef.current) {
        const isOverImg = e.target === hoveredImgRef.current.element;
        const isOverBtn = e.target.closest(".gif-delete-btn");
        if (!isOverImg && !isOverBtn) {
          hoveredImgRef.current = null;
          setHoveredImgState(null);
        }
      }
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const handleDeleteImage = (e) => {
    if (!hoveredImgState || !quillRef.current) return;
    const editor = quillRef.current.getEditor();

    const QuillObj = ReactQuill.Quill || window.Quill;
    if (QuillObj) {
      const blot = QuillObj.find(hoveredImgState.element);
      if (blot) {
        const offset = editor.getIndex(blot);
        editor.deleteText(offset, 1);
      }
    } else {
      hoveredImgState.element.remove();
      setContent(editor.root.innerHTML);
    }

    setHoveredImgState(null);
    hoveredImgRef.current = null;
  };

  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!content.trim() || content === "<p><br></p>") {
      showToast("내용을 입력해주세요.");
      return;
    }
    if (title.length > 255) {
      showToast("제목은 255자 이내여야 합니다.");
      return;
    }

    if (!isOnline) {
      await offlineQueue.enqueue({
        url: `${API_BASE_URL}/posts`,
        method: "POST",
        body: {
          title: title,
          content: content,
          is_anonymous: isAnonymous,
          board_type: boardType,
        },
      });
      showToast(
        "오프라인 상태입니다. 큐에 저장되어 온라인 복귀 시 자동 게시됩니다.",
      );
      navigate("/board", { replace: true });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await axios.post(
        `${API_BASE_URL}/posts`,
        {
          title: title,
          content: content,
          is_anonymous: isAnonymous,
          board_type: boardType,
        },
        {
          withCredentials: true,
        },
      );

      if (response.data.status === "success") {
        showToast("게시물이 등록되었습니다.");
        navigate(`/post/${response.data.data.post_id}`, { replace: true });
      }
    } catch (error) {
      console.error("게시물 작성 통신 오류:", error);
      if (error.response) {
        showToast(error.response.data.message || "게시물 작성에 실패했습니다.");
        if (error.response.status === 401) {
          navigate("/");
        }
      } else {
        showToast("서버와 통신하는 중 오류가 발생했습니다.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="post-write-wrapper">
      <div className="post-write-container">
        <h2 className="post-write-title">새 글 쓰기</h2>
        <form onSubmit={handleSubmit} className="post-write-form">
          {/* ✅ 게시판 선택 */}
          <div className="input-group">
            <select
              className="board-type-select"
              value={boardType}
              onChange={(e) => setBoardType(e.target.value)}
            >
              <option value="general">자유 게시판</option>
              {localStorage.getItem("eta_admin") === "true" ? (
                <>
                  <option value="grade1">1학년 게시판</option>
                  <option value="grade2">2학년 게시판</option>
                  <option value="grade3">3학년 게시판</option>
                </>
              ) : (
                <option value="grade">학년 게시판</option>
              )}
              <option value="lost_found">분실물 게시판</option>
            </select>
          </div>

          <div className="input-group">
            <input
              type="text"
              className="title-input"
              placeholder="제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="input-group">
            <div
              className="write-toolbar"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "0 8px 8px 0",
              }}
            >
              <button
                type="button"
                className="gif-button"
                onClick={() => setShowGifPicker(true)}
                style={{
                  background: "none",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  color: "#555",
                }}
              >
                <img src="/gif_box.svg" alt="GIF" width="18" height="18" /> GIF
                추가
              </button>
            </div>
            <ReactQuill
              ref={quillRef}
              theme="snow"
              placeholder="내용을 자유롭게 입력하세요..."
              value={content}
              onChange={setContent}
              modules={{
                toolbar: false,
              }}
              style={{
                minHeight: "400px",
                backgroundColor: "#fff",
                borderBottomLeftRadius: "8px",
                borderBottomRightRadius: "8px",
              }}
            />
          </div>

          <div className="form-footer">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="anonymousCheck"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              <label htmlFor="anonymousCheck">익명</label>
            </div>

            <div className="button-group">
              <button
                type="button"
                className="back-button"
                onClick={() => navigate(-1)}
              >
                취소
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "작성 중..." : "완료"}
              </button>
            </div>
          </div>
        </form>
      </div>
      <GifPicker
        isOpen={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={(gifUrl) => {
          if (quillRef.current) {
            const quill = quillRef.current.getEditor();
            const range = quill.getSelection(true);
            const index = range ? range.index : quill.getLength();
            quill.insertText(index, "\n");
            quill.insertEmbed(index + 1, "image", gifUrl);
            quill.insertText(index + 2, "\n");
            quill.setSelection(index + 3);
          }
          setShowGifPicker(false);
        }}
      />

      {hoveredImgState && (
        <button
          type="button"
          className="gif-delete-btn"
          onClick={handleDeleteImage}
          style={{
            position: "absolute",
            top: hoveredImgState.top + 4,
            left: hoveredImgState.left + hoveredImgState.width - 36,
            zIndex: 9999,
            background: "#ffffff",
            color: "#ff4d4f",
            border: "1px solid #eee",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            fontWeight: "bold",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};
