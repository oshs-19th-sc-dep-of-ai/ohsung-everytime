import React, { useContext } from 'react';
import {
    Grid,
    SearchBar,
    SearchContext,
    SearchContextManager
} from '@giphy/react-components';
import { GIPHY_API_KEY } from '../config';
import './GifPicker.css';

// Child component that uses SearchContext
function GifPickerInner({ onSelect, onClose }) {
    const { fetchGifs, searchKey } = useContext(SearchContext);

    return (
        <div className="gif-picker-overlay" onClick={onClose}>
            <div className="gif-picker-modal" onClick={e => e.stopPropagation()}>
                <div className="gif-picker-header">
                    <h3>GIF 검색</h3>
                    <button className="gif-picker-close" onClick={onClose}>✕</button>
                </div>

                <div className="gif-picker-search-area">
                    <SearchBar placeholder="GIF 검색..." />
                </div>

                <div className="gif-picker-grid-wrapper">
                    <Grid
                        key={searchKey}
                        columns={3}
                        width={window.innerWidth > 600 ? 560 : window.innerWidth - 32} // 모바일 최적화 대응
                        fetchGifs={fetchGifs}
                        hideAttribution={true} // 워터마크 직접 렌더링을 위해 숨김
                        noLink={true}
                        onGifClick={(gif, e) => {
                            e.preventDefault();
                            onSelect(gif.images.fixed_height.url);
                            onClose();
                        }}
                        gifProps={{ borderRadius: 4 }}
                    />
                </div>

                <div className="gif-picker-footer">
                    <img src="/powered-by-giphy.png" alt="Powered by GIPHY" className="giphy-logo-small" />
                </div>
            </div>
        </div>
    );
}

// Wrapper component
export function GifPicker({ isOpen, onClose, onSelect }) {
    if (!isOpen) return null;

    return (
        <SearchContextManager
            apiKey={GIPHY_API_KEY}
            initialTerm=""
            shouldDefaultToTrending={true}
            options={{
                rating: 'pg', // 19금 필터링 적용 (pg)
                type: 'gifs',
            }}
            theme={{
                mode: 'light',
                searchbarHeight: 40,
                smallSearchbarHeight: 35
            }}
        >
            <GifPickerInner onSelect={onSelect} onClose={onClose} />
        </SearchContextManager>
    );
}
