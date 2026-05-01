import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Toast.css';

export function Toast({ message, onClose, duration = 5000 }) {
    const [isVisible, setIsVisible] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);

    const bodyRef = useRef(null);
    const timerRef = useRef(null);

    const handleClose = useCallback(() => {
        setIsLeaving(true);
        setTimeout(() => {
            setIsVisible(false);
            onClose?.();
        }, 300); // 퇴장 애니메이션 시간
    }, [onClose]);

    useEffect(() => {
        if (message) {
            setIsVisible(true);
            setIsLeaving(false);
            setIsExpanded(false);
            setIsTruncated(false);

            if (timerRef.current) clearTimeout(timerRef.current);

            timerRef.current = setTimeout(() => {
                handleClose();
            }, duration);

            return () => {
                if (timerRef.current) clearTimeout(timerRef.current);
            };
        }
    }, [message, duration, handleClose]);

    // 내용이 말줄임 처리되었는지 확인
    useEffect(() => {
        if (isVisible && bodyRef.current && !isExpanded) {
            const { scrollHeight, clientHeight } = bodyRef.current;
            setIsTruncated(scrollHeight > clientHeight);
        }
    }, [isVisible, message, isExpanded]);

    if (!isVisible || !message) return null;

    const handleClick = () => {
        if (isTruncated && !isExpanded) {
            // 내용이 길어서 잘린 경우 -> 확장 및 타이머 취소
            setIsExpanded(true);
            if (timerRef.current) clearTimeout(timerRef.current);
        } else {
            // 안 잘렸거나 이미 확장된 경우 -> 링크 이동 또는 닫기
            if (message.link) {
                window.location.href = message.link;
            }
            handleClose();
        }
    };

    return (
        <div
            className={`toast-container ${isLeaving ? 'toast-leaving' : 'toast-entering'} ${isExpanded ? 'toast-expanded' : ''}`}
            onClick={handleClick}
            role="alert"
            style={{ cursor: (isTruncated && !isExpanded) ? 'zoom-in' : 'pointer' }}
        >
            <div className="toast-icon">🔔</div>
            <div className="toast-content">
                <p className="toast-title">{message.title}</p>
                <p 
                    ref={bodyRef}
                    className={`toast-body ${isExpanded ? 'expanded' : ''}`}
                >
                    {message.body}
                </p>
                {isTruncated && !isExpanded && (
                    <div className="toast-more-hint">클릭해서 자세히 보기</div>
                )}
            </div>
            <button
                className="toast-close"
                onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                }}
                aria-label="닫기"
            >
                ✕
            </button>
        </div>
    );
}
