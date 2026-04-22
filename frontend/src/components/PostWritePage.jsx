import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from "../config";
import { useToast } from "../contexts/ToastContext.jsx";
import './PostWritePage.css';

export const PostWritePage = () => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const navigate = useNavigate();
    const { showToast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isSubmitting) return;

        if (!title.trim()) {
            showToast("제목을 입력해주세요.");
            return;
        }
        if (!content.trim()) {
            showToast("내용을 입력해주세요.");
            return;
        }
        if (title.length > 255) {
            showToast("제목은 255자 이내여야 합니다.");
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await axios.post(`${API_BASE_URL}/posts`, {
                title: title,
                content: content,
                is_anonymous: isAnonymous
            }, {
                withCredentials: true
            });

            if (response.data.status === 'success') {
                showToast('게시물이 등록되었습니다.');
                navigate(`/post/${response.data.data.post_id}`, { replace: true });
            }
        } catch (error) {
            console.error("게시물 작성 통신 오류:", error);
            if (error.response) {
                showToast(error.response.data.message || '게시물 작성에 실패했습니다.');
                if (error.response.status === 401) {
                    navigate('/');
                }
            } else {
                showToast('서버와 통신하는 중 오류가 발생했습니다.');
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
                        <textarea
                            className="content-input"
                            placeholder="내용을 입력하세요"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
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
                                {isSubmitting ? '작성 중...' : '완료'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};