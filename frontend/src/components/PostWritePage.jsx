import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from "../config";
import { useToast } from "../contexts/ToastContext.jsx";
import { useNetwork } from '../contexts/NetworkContext.jsx';
import { offlineQueue } from '../utils/offlineQueue.js';
import { GifPicker } from './GifPicker.jsx';
import { renderContentWithGifs } from '../utils/renderContentWithGifs.jsx';
import './PostWritePage.css';

export const PostWritePage = () => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [selectedGif, setSelectedGif] = useState(null);
    const { isOnline } = useNetwork();

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
        if (!content.trim() && !selectedGif) {
            showToast("내용이나 GIF를 추가해주세요.");
            return;
        }
        if (title.length > 255) {
            showToast("제목은 255자 이내여야 합니다.");
            return;
        }

        const finalContent = content + (selectedGif ? (content.trim() ? '\n' : '') + `[gif:${selectedGif}]` : '');

        if (!isOnline) {
            await offlineQueue.enqueue({
                url: `${API_BASE_URL}/posts`,
                method: 'POST',
                body: {
                    title: title,
                    content: finalContent,
                    is_anonymous: isAnonymous
                }
            });
            showToast('오프라인 상태입니다. 큐에 저장되어 온라인 복귀 시 자동 게시됩니다.');
            navigate('/board', { replace: true });
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await axios.post(`${API_BASE_URL}/posts`, {
                title: title,
                content: finalContent,
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
                        <div className="write-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 8px 8px 0' }}>
                            <button 
                                type="button" 
                                className="gif-button" 
                                onClick={() => setShowGifPicker(true)}
                                style={{ background: 'none', border: '1px solid #ddd', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#555' }}
                            >
                                <img src="/gif_box.svg" alt="GIF" width="18" height="18" /> GIF 추가
                            </button>
                        </div>
                        <textarea
                            className="content-input"
                            placeholder="내용을 입력하세요"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                        {selectedGif && (
                            <div className="content-preview" style={{ position: 'relative', marginTop: '10px', padding: '10px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee', display: 'inline-block' }}>
                                <button 
                                    type="button" 
                                    onClick={() => setSelectedGif(null)}
                                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                                >
                                    ✕
                                </button>
                                <img src={selectedGif} alt="Selected GIF" style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '4px' }} />
                            </div>
                        )}
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
            <GifPicker
                isOpen={showGifPicker}
                onClose={() => setShowGifPicker(false)}
                onSelect={(gifUrl) => setSelectedGif(gifUrl)}
            />
        </div>
    );
};