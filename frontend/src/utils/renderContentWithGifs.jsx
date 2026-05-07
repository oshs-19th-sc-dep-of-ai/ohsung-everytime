import React from 'react';
import DOMPurify from 'dompurify';

export function renderContentWithGifs(text) {
    if (!text) return null;

    // 만약 텍스트가 HTML 태그를 포함하고 있다면 (새로운 에디터로 작성된 글)
    if (text.includes('<p>') || text.includes('<img')) {
        const cleanHtml = DOMPurify.sanitize(text, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'img', 'blockquote', 'u', 's', 'span'],
            ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'class', 'style', 'rel', 'width', 'height']
        });
        return (
            <div 
                className="rich-text-content ql-editor" 
                dangerouslySetInnerHTML={{ __html: cleanHtml }} 
                style={{ padding: 0 }}
            />
        );
    }

    // [gif:url] 패턴 분리 (기존 방식 하위 호환)
    const parts = text.split(/(\[gif:.*?\])/g);

    return parts.map((part, i) => {
        const gifMatch = part.match(/^\[gif:(.*?)\]$/);
        if (gifMatch) {
            return (
                <div key={i} className="inline-gif-wrapper">
                    <img
                        src={gifMatch[1]}
                        alt="GIF"
                        className="inline-gif"
                        loading="lazy"
                    />
                </div>
            );
        }
        
        // 일반 텍스트는 줄바꿈 처리
        return part.split('\n').map((line, j) => (
            <React.Fragment key={`${i}-${j}`}>
                {j > 0 && <br />}
                {line}
            </React.Fragment>
        ));
    });
}
