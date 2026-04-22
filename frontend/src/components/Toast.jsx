import React, { useState, useEffect, useCallback } from 'react';
import './Toast.css';

export function Toast({ message, onClose, duration = 5000 }) {
    const [isVisible, setIsVisible] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

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

            const timer = setTimeout(() => {
                handleClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [message, duration, handleClose]);

    if (!isVisible || !message) return null;

    const handleClick = () => {
        if (message.link) {
            window.location.href = message.link;
        }
        handleClose();
    };

    return (
        <div
            className={`toast-container ${isLeaving ? 'toast-leaving' : 'toast-entering'}`}
            onClick={handleClick}
            role="alert"
        >
            <div className="toast-icon">🔔</div>
            <div className="toast-content">
                <p className="toast-title">{message.title}</p>
                <p className="toast-body">{message.body}</p>
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
