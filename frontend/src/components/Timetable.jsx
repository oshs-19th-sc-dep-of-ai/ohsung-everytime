import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './Timetable.css';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

// 에브리타임 느낌의 파스텔톤 프리셋 컬러 모음
const PRESET_COLORS = [
    '#EAF1FF', // 연파랑 (기본)
    '#FFF0F2', // 연분홍
    '#FFF9E6', // 연노랑
    '#E6F7ED', // 연초록
    '#F0E6FF', // 연보라
    '#FEE4D6'  // 연주황
];

// 오늘 날짜 → YYYYMMDD 문자열 (주말이면 다음 월요일)
function getNearestSchoolDay() {
    const today = new Date();
    const day = today.getDay(); // 0=일, 6=토
    if (day === 0) today.setDate(today.getDate() + 1);
    if (day === 6) today.setDate(today.getDate() + 2);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

/**
 * 특정 기준 날짜(baseDateStr)가 속한 주의 특정 요일(targetDayOfWeek)의 날짜를 계산해 YYYYMMDD로 반환
 * @param {string} baseDateStr YYYYMMDD
 * @param {number} targetDayOfWeek 1(월) ~ 5(금)
 */
function getDateOfSpecificDay(baseDateStr, targetDayOfWeek) {
    if (!baseDateStr) return '';
    const year = parseInt(baseDateStr.slice(0, 4));
    const month = parseInt(baseDateStr.slice(4, 6)) - 1;
    const day = parseInt(baseDateStr.slice(6, 8));
    
    const baseDate = new Date(year, month, day);
    const baseDayOfWeek = baseDate.getDay(); // 0(일) ~ 6(토)
    
    // 일요일을 7로 조정하여 월(1)~일(7) 범위로 맞춤
    const adjustedBaseDay = baseDayOfWeek === 0 ? 7 : baseDayOfWeek;
    
    const diff = targetDayOfWeek - adjustedBaseDay;
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + diff);
    
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

/**
 * 4글자 강의실 패턴 (예: E311 -> 3학년 11반)을 변환하는 헬퍼 함수
 */
function processClassroom(rawClrm) {
    if (!rawClrm) return { location: '', isAuto: false };
    if (rawClrm.length === 4 && /^.\d{3}$/.test(rawClrm)) {
        const grade = rawClrm[1];
        const classNum = parseInt(rawClrm.slice(2, 4), 10);
        return { location: `${grade}학년 ${classNum}반`, isAuto: true };
    }
    return { location: '', isAuto: false };
}

export function Timetable() {
    // ─── 시간표 그리드 상태 ───────────────────────────────────────────
    const [grid, setGrid] = useState(Array.from({ length: 7 }, () => Array(5).fill(null)));

    // ─── NEIS 교시별 개설 과목 ─────────────────────────────────────────
    // byPeriod: { "1": [{subject, clrm}, ...], "2": [...], ... }
    const [byPeriod, setByPeriod] = useState({});
    const [neisDate, setNeisDate] = useState(getNearestSchoolDay());
    const [neisLoading, setNeisLoading] = useState(false);
    const [neisError, setNeisError] = useState('');

    // ─── 편집 모드 ────────────────────────────────────────────────────
    const [isEditMode, setIsEditMode] = useState(false);

    // ─── 모달 상태 ────────────────────────────────────────────────────
    const [detailModal, setDetailModal] = useState({ open: false, data: null });
    const [editModal, setEditModal] = useState({ open: false, day: null, period: null });

    // ─── 편집 폼 ──────────────────────────────────────────────────────
    const [editForm, setEditForm] = useState({
        period: 1,
        subject_name: '',
        location: '',
        memo: '',
        color: PRESET_COLORS[0],
        isAutoLocation: false,
    });

    // ─── 시간표 불러오기 ──────────────────────────────────────────────
    const fetchTimetable = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/timetable`, { withCredentials: true });
            const data = res.data.timetable || [];
            const newGrid = Array.from({ length: 7 }, () => Array(5).fill(null));
            data.forEach(item => {
                const pi = item.period - 1;
                const di = item.day_of_week - 1;
                if (pi >= 0 && pi < 7 && di >= 0 && di < 5) {
                    newGrid[pi][di] = item;
                }
            });
            setGrid(newGrid);
        } catch (err) {
            console.error('시간표 불러오기 실패:', err);
        }
    }, []);

    useEffect(() => { fetchTimetable(); }, [fetchTimetable]);

    // ─── NEIS 개설 과목 불러오기 ──────────────────────────────────────
    const fetchAvailable = useCallback(async (dateStr) => {
        setNeisLoading(true);
        setNeisError('');
        try {
            const res = await axios.get(`${API_BASE_URL}/timetable/available`, {
                params: { date: dateStr },
                withCredentials: true,
            });
            setByPeriod(res.data.by_period || {});
        } catch (err) {
            const msg = err.response?.data?.message || 'NEIS 과목 조회 실패';
            setNeisError(msg);
            setByPeriod({});
        } finally {
            setNeisLoading(false);
        }
    }, []);

    // 편집 모드 진입 시 NEIS 데이터 불러오기
    useEffect(() => {
        if (isEditMode) {
            fetchAvailable(neisDate);
        }
    }, [isEditMode, neisDate, fetchAvailable]);

    // ─── 요일 헤더 클릭 (편집 모드에서 날짜 연동) ─────────────────────
    const handleHeaderClick = (dayIndex) => {
        if (!isEditMode) return;
        const dayOfWeek = dayIndex + 1;
        const targetDate = getDateOfSpecificDay(neisDate, dayOfWeek);
        if (neisDate !== targetDate) {
            setNeisDate(targetDate);
        }
    };

    // ─── 셀 클릭 ──────────────────────────────────────────────────────
    const handleCellClick = (dayIndex, periodIndex) => {
        const cellData = grid[periodIndex][dayIndex];
        const dayOfWeek = dayIndex + 1;
        const period = periodIndex + 1;

        if (isEditMode) {
            // 선택한 셀의 요일에 맞춰 기준 날짜 자동 변경
            const targetDate = getDateOfSpecificDay(neisDate, dayOfWeek);
            if (neisDate !== targetDate) {
                setNeisDate(targetDate);
            }

            // 해당 교시의 개설 과목 목록
            const options = byPeriod[String(period)] || [];
            const firstOption = options[0];

            let initialSubject = cellData?.subject_name || '';
            let initialLocation = cellData?.location || '';
            let initialAuto = false;

            if (!cellData && firstOption) {
                initialSubject = firstOption.subject;
                const processed = processClassroom(firstOption.clrm);
                initialLocation = processed.location;
                initialAuto = processed.isAuto;
            }

            setEditModal({ open: true, day: dayOfWeek, period });
            setEditForm({
                period,
                subject_name: initialSubject,
                location:     initialLocation,
                memo:         cellData?.memo         || '',
                color:        cellData?.color        || PRESET_COLORS[0],
                isAutoLocation: initialAuto,
            });
        } else if (cellData) {
            setDetailModal({ open: true, data: { ...cellData, dayString: DAYS[dayIndex] } });
        }
    };

    // ─── 과목 선택 시 강의실 자동 채우기 ─────────────────────────────
    const handleSubjectChange = (subject) => {
        const options = byPeriod[String(editForm.period)] || [];
        const found = options.find(o => o.subject === subject);
        const processed = processClassroom(found?.clrm);
        
        setEditForm(prev => ({
            ...prev,
            subject_name: subject,
            location: processed.location,
            isAutoLocation: processed.isAuto,
        }));
    };

    // ─── 적용 저장 ────────────────────────────────────────────────────
    const handleEditSave = () => {
        if (!editForm.subject_name.trim()) {
            alert('과목을 선택해주세요.');
            return;
        }
        if (!editForm.location.trim()) {
            alert('강의실(교실) 위치를 입력해주세요.');
            return;
        }
        const newGrid = grid.map(row => [...row]);
        const di = editModal.day - 1;
        const pi = editModal.period - 1;
        newGrid[pi][di] = {
            day_of_week:  editModal.day,
            period:       editModal.period,
            subject_name: editForm.subject_name,
            location:     editForm.location,
            memo:         editForm.memo,
            color:        editForm.color,
        };
        setGrid(newGrid);
        setEditModal({ open: false, day: null, period: null });
    };

    // ─── 셀 비우기 ────────────────────────────────────────────────────
    const handleCellDelete = () => {
        const newGrid = grid.map(row => [...row]);
        newGrid[editModal.period - 1][editModal.day - 1] = null;
        setGrid(newGrid);
        setEditModal({ open: false, day: null, period: null });
    };

    // ─── 서버에 저장 ──────────────────────────────────────────────────
    const handleSaveToServer = async () => {
        const payload = [];
        grid.forEach(row => row.forEach(cell => { if (cell) payload.push(cell); }));
        try {
            await axios.put(`${API_BASE_URL}/timetable`, { timetable: payload }, { withCredentials: true });
            alert('시간표가 성공적으로 저장되었습니다!');
            setIsEditMode(false);
            fetchTimetable();
        } catch (err) {
            console.error('시간표 저장 실패:', err);
            alert('시간표 저장에 실패했습니다.');
        }
    };

    // ─── NEIS 날짜 변경 핸들러 ────────────────────────────────────────
    const handleDateChange = (e) => {
        const raw = e.target.value; // "YYYY-MM-DD"
        const ymd = raw.replace(/-/g, '');
        setNeisDate(ymd);
    };

    const dateInputValue = neisDate
        ? `${neisDate.slice(0, 4)}-${neisDate.slice(4, 6)}-${neisDate.slice(6, 8)}`
        : '';

    // ─── 현재 편집 중인 교시의 과목 목록 ─────────────────────────────
    const currentOptions = editModal.open
        ? (byPeriod[String(editModal.period)] || [])
        : [];

    // ─── 현재 기준 날짜와 일치하는 요일 인덱스 확인 ───────────────────
    const getActiveDayIndex = () => {
        if (!neisDate) return -1;
        const year = parseInt(neisDate.slice(0, 4));
        const month = parseInt(neisDate.slice(4, 6)) - 1;
        const day = parseInt(neisDate.slice(6, 8));
        const d = new Date(year, month, day);
        const dow = d.getDay(); // 0(일) ~ 6(토)
        return (dow === 0 || dow === 6) ? -1 : dow - 1; // 월(0)~금(4)
    };
    const activeDayIndex = getActiveDayIndex();

    // ─── 렌더링 ───────────────────────────────────────────────────────
    return (
        <div className="timetable-container has-bottom-nav">
            <div className="timetable-header-section">
                <h1>내 시간표</h1>
                {isEditMode ? (
                    <button className="btn-edit-toggle save-mode" onClick={handleSaveToServer}>
                        저장하기
                    </button>
                ) : (
                    <button className="btn-edit-toggle" onClick={() => setIsEditMode(true)}>
                        시간표 수정
                    </button>
                )}
            </div>

            {/* 편집 모드: NEIS 날짜 선택 배너 */}
            {isEditMode && (
                <div className="neis-date-banner">
                    <span className="neis-banner-label">📅 기준 날짜</span>
                    <input
                        type="date"
                        id="neis-date-picker"
                        className="neis-date-input"
                        value={dateInputValue}
                        onChange={handleDateChange}
                    />
                    <button
                        className="neis-refresh-btn"
                        onClick={() => fetchAvailable(neisDate)}
                        disabled={neisLoading}
                        title="과목 목록 새로고침"
                    >
                        {neisLoading ? '⏳' : '🔄'}
                    </button>
                    {neisError && <span className="neis-error-badge">{neisError}</span>}
                    {!neisLoading && !neisError && Object.keys(byPeriod).length > 0 && (
                        <span className="neis-ok-badge">✓ 과목 로드 완료</span>
                    )}
                </div>
            )}

            <div className="timetable-card">
                <div className="timetable-grid">
                    <div className="grid-header"></div>
                    {DAYS.map((day, i) => (
                        <div 
                            key={i} 
                            className={`grid-header ${isEditMode ? 'clickable' : ''} ${isEditMode && i === activeDayIndex ? 'active-date' : ''}`}
                            onClick={() => handleHeaderClick(i)}
                        >
                            {day}
                        </div>
                    ))}

                    {grid.map((row, periodIndex) => (
                        <React.Fragment key={periodIndex}>
                            <div className="grid-time-col">{periodIndex + 1}</div>
                            {row.map((cell, dayIndex) => (
                                <div
                                    key={dayIndex}
                                    id={`cell-p${periodIndex + 1}-d${dayIndex + 1}`}
                                    className={`grid-cell ${isEditMode ? 'edit-mode' : ''}`}
                                    style={{ backgroundColor: cell ? cell.color : '#FFFFFF' }}
                                    onClick={() => handleCellClick(dayIndex, periodIndex)}
                                >
                                    {cell && (
                                        <>
                                            <span className="cell-subject">{cell.subject_name}</span>
                                            <span className="cell-location">{cell.location}</span>
                                        </>
                                    )}
                                    {isEditMode && !cell && (
                                        <span className="cell-empty-hint">+</span>
                                    )}
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* 상세 보기 모달 */}
            {detailModal.open && detailModal.data && (
                <div className="modal-overlay" onClick={() => setDetailModal({ open: false, data: null })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">{detailModal.data.subject_name}</h2>
                        <div className="modal-detail-item">
                            <div className="modal-detail-label">시간</div>
                            <div className="modal-detail-value">
                                {detailModal.data.dayString}요일 {detailModal.data.period}교시
                            </div>
                        </div>
                        <div className="modal-detail-item">
                            <div className="modal-detail-label">장소</div>
                            <div className="modal-detail-value">{detailModal.data.location}</div>
                        </div>
                        {detailModal.data.memo && (
                            <div className="modal-detail-item">
                                <div className="modal-detail-label">메모</div>
                                <div className="modal-detail-value">{detailModal.data.memo}</div>
                            </div>
                        )}
                        <div className="modal-actions">
                            <button className="btn-submit" onClick={() => setDetailModal({ open: false, data: null })}>
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 편집 모달 */}
            {editModal.open && (
                <div className="modal-overlay" onClick={() => setEditModal({ open: false, day: null, period: null })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">
                            {DAYS[editModal.day - 1]}요일 {editModal.period}교시 설정
                        </h2>

                        {/* 과목 선택 */}
                        <div className="form-group">
                            <label className="form-label">과목 선택</label>
                            {neisLoading ? (
                                <div className="neis-loading-hint">⏳ 과목 목록을 불러오는 중...</div>
                            ) : currentOptions.length > 0 ? (
                                <div className="subject-option-list">
                                    {currentOptions
                                        .filter((opt, index, self) => index === self.findIndex((t) => t.subject === opt.subject))
                                        .map((opt, idx) => (
                                        <div
                                            key={idx}
                                            id={`subject-opt-${idx}`}
                                            className={`subject-option-chip ${editForm.subject_name === opt.subject ? 'selected' : ''}`}
                                            onClick={() => handleSubjectChange(opt.subject)}
                                        >
                                            <span className="chip-subject">{opt.subject}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="neis-empty-hint">
                                    해당 교시에 개설된 과목이 없습니다.<br />
                                    날짜를 바꿔 다시 조회해보세요.
                                </div>
                            )}
                        </div>

                        {/* 선택된 과목 및 강의실 설정 */}
                        <div className="form-group">
                            <label className="form-label">
                                과목명 <span style={{color: '#E93E4F'}}>*</span>
                            </label>
                            <input
                                type="text"
                                className="modal-input sel-subject-input"
                                placeholder="과목명을 입력하세요 (예: 국어)"
                                value={editForm.subject_name}
                                onChange={e => setEditForm({ ...editForm, subject_name: e.target.value })}
                            />
                        </div>

                        {/* 강의실 입력란 */}
                        <div className="form-group">
                            <label className="form-label">
                                강의실(위치) <span style={{color: '#E93E4F'}}>*</span>
                            </label>
                            <input
                                type="text"
                                className="modal-input"
                                placeholder="예: 3학년 11반, 음악실"
                                value={editForm.location}
                                onChange={e => setEditForm({ ...editForm, location: e.target.value, isAutoLocation: false })}
                            />
                        </div>

                        {/* 배경 색상 */}
                        <div className="form-group">
                            <label className="form-label">배경 색상</label>
                            <div className="color-picker-group">
                                {PRESET_COLORS.map(color => (
                                    <div
                                        key={color}
                                        className={`color-chip ${editForm.color === color ? 'selected' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setEditForm({ ...editForm, color })}
                                    />
                                ))}
                                <label
                                    className={`color-chip custom-color-chip ${!PRESET_COLORS.includes(editForm.color) ? 'selected' : ''}`}
                                    style={{ 
                                        backgroundColor: !PRESET_COLORS.includes(editForm.color) ? editForm.color : '#FFFFFF'
                                    }}
                                    title="사용자 지정 색상"
                                >
                                    {PRESET_COLORS.includes(editForm.color) && <span className="custom-color-plus">+</span>}
                                    <input 
                                        type="color" 
                                        className="custom-color-input"
                                        value={editForm.color} 
                                        onChange={(e) => setEditForm({ ...editForm, color: e.target.value.toUpperCase() })}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* 메모 */}
                        <div className="form-group">
                            <label className="form-label">메모 (선택)</label>
                            <input
                                type="text"
                                className="modal-input"
                                placeholder="준비물 등 간단한 메모"
                                value={editForm.memo}
                                onChange={e => setEditForm({ ...editForm, memo: e.target.value })}
                            />
                        </div>

                        <button className="btn-submit btn-delete" onClick={handleCellDelete}>
                            이 교시 비우기
                        </button>

                        <div className="modal-actions" style={{ marginTop: '0' }}>
                            <button className="btn-cancel" onClick={() => setEditModal({ open: false, day: null, period: null })}>
                                취소
                            </button>
                            <button className="btn-submit" onClick={handleEditSave}>
                                적용
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}