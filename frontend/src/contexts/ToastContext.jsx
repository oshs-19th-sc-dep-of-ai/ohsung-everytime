import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast } from '../components/Toast';

const ToastContext = createContext(null);

export const useToast = () => {
    return useContext(ToastContext);
};

export const ToastProvider = ({ children }) => {
    const [toastMessage, setToastMessage] = useState(null);

    const showToast = useCallback((title, body = "") => {
        setToastMessage({ title, body });
    }, []);

    const showToastWithLink = useCallback((title, body, link) => {
        setToastMessage({ title, body, link });
    }, []);

    const hideToast = useCallback(() => {
        setToastMessage(null);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, showToastWithLink, hideToast }}>
            {children}
            <Toast message={toastMessage} onClose={hideToast} />
        </ToastContext.Provider>
    );
};
