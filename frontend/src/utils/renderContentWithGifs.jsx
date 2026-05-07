import React from 'react';

export function renderContentWithGifs(text) {
    if (!text) return null;

    // [gif:url] 패턴 분리
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
