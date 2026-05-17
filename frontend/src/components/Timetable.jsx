import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useToast } from '../contexts/ToastContext.jsx';
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

export function Timetable() {
    const { showToast } = useToast();

    // ─── 시간표 그리드 상태 ───────────────────────────────────────────
    const [grid, setGrid] = useState(Array.from({ length: 7 }, () => Array(5).fill(null)));
    const [userGrade, setUserGrade] = useState(null);

    // ─── DB 개설 과목 목록 ─────────────────────────────────────────
    const [availableSubjects, setAvailableSubjects] = useState([]);
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
    });

    // ─── 변경사항 추적 ─────────────────────────────────────────────────
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');
    const latestGridRef = useRef(grid);
    const changeVersionRef = useRef(0);
    const savedVersionRef = useRef(0);
    const isSavingRef = useRef(false);
    const saveNowRef = useRef(null);

    const buildPayload = useCallback((gridSnapshot) => {
        const payload = [];
        gridSnapshot.forEach(row => row.forEach(cell => { if (cell) payload.push(cell); }));
        return payload;
    }, []);

    const runAutoSave = useCallback(async () => {
        if (isSavingRef.current) return;

        const versionToSave = changeVersionRef.current;
        if (versionToSave === savedVersionRef.current) return;

        const gridToSave = latestGridRef.current;
        isSavingRef.current = true;
        setSaveStatus('saving');

        let savedThisAttempt = false;
        try {
            await axios.put(
                `${API_BASE_URL}/timetable`,
                { timetable: buildPayload(gridToSave) },
                { withCredentials: true }
            );
            savedThisAttempt = true;
            savedVersionRef.current = versionToSave;

            if (changeVersionRef.current === versionToSave) {
                setHasUnsavedChanges(false);
                setSaveStatus('saved');
            }
        } catch (err) {
            console.error('시간표 자동 저장 실패:', err);
            if (changeVersionRef.current === versionToSave) {
                setHasUnsavedChanges(true);
                setSaveStatus('error');
                showToast('오류', '시간표 자동 저장에 실패했습니다.');
            }
        } finally {
            isSavingRef.current = false;
            const hasNewerChanges = changeVersionRef.current !== versionToSave;
            if ((savedThisAttempt || hasNewerChanges) && changeVersionRef.current !== savedVersionRef.current) {
                window.setTimeout(() => saveNowRef.current?.(), 0);
            }
        }
    }, [buildPayload, showToast]);

    useEffect(() => {
        saveNowRef.current = runAutoSave;
    }, [runAutoSave]);

    const applyGridChange = useCallback((nextGrid) => {
        latestGridRef.current = nextGrid;
        changeVersionRef.current += 1;
        setGrid(nextGrid);
        setHasUnsavedChanges(true);
        setSaveStatus('saving');
        window.setTimeout(() => saveNowRef.current?.(), 0);
    }, []);

    // 저장하지 않고 이탈 방지 (새로고침, 탭 닫기)
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // 저장하지 않고 이탈 방지 (앱 내 네비게이션 - BottomNav, Header 클릭 등)
    useEffect(() => {
        const handleGlobalClick = (e) => {
            if (!hasUnsavedChanges) return;

            const container = document.querySelector('.timetable-container');
            // 클릭한 요소가 시간표 컨테이너 바깥인 경우 (예: 네비게이션 바)
            if (container && !container.contains(e.target)) {
                if (!window.confirm('저장하지 않은 변경사항이 있습니다. 정말 이동하시겠습니까?')) {
                    e.preventDefault();
                    e.stopPropagation();
                } else {
                    setHasUnsavedChanges(false);
                }
            }
        };

        // 캡처 페이즈에서 이벤트 가로채기
        document.addEventListener('click', handleGlobalClick, { capture: true });
        return () => {
            document.removeEventListener('click', handleGlobalClick, { capture: true });
        };
    }, [hasUnsavedChanges]);

    // ─── 시간표 불러오기 ──────────────────────────────────────────────
    const fetchTimetable = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/timetable`, { withCredentials: true });
            const data = res.data.timetable || [];
            setUserGrade(res.data.grade);
            const newGrid = Array.from({ length: 7 }, () => Array(5).fill(null));
            data.forEach(item => {
                const pi = item.period - 1;
                const di = item.day_of_week - 1;
                if (pi >= 0 && pi < 7 && di >= 0 && di < 5) {
                    newGrid[pi][di] = item;
                }
            });
            latestGridRef.current = newGrid;
            changeVersionRef.current = 0;
            savedVersionRef.current = 0;
            setGrid(newGrid);
            setHasUnsavedChanges(false);
            setSaveStatus('idle');
        } catch (err) {
            console.error('시간표 불러오기 실패:', err);
        }
    }, []);

    useEffect(() => { fetchTimetable(); }, [fetchTimetable]);

    // ─── DB 과목 목록 불러오기 ──────────────────────────────────────
    const fetchAvailable = useCallback(async () => {
        setNeisLoading(true);
        setNeisError('');
        try {
            const res = await axios.get(`${API_BASE_URL}/timetable/available`, {
                withCredentials: true,
            });
            setAvailableSubjects(res.data.subjects || []);
        } catch (err) {
            const msg = err.response?.data?.message || '과목 조회 실패';
            setNeisError(msg);
            setAvailableSubjects([]);
        } finally {
            setNeisLoading(false);
        }
    }, []);

    // 편집 모드 진입 시 과목 데이터 불러오기
    useEffect(() => {
        if (isEditMode) {
            fetchAvailable();
        }
    }, [isEditMode, fetchAvailable]);


    // ─── 셀 클릭 ──────────────────────────────────────────────────────
    const handleCellClick = (dayIndex, periodIndex) => {
        const cellData = grid[periodIndex][dayIndex];
        const dayOfWeek = dayIndex + 1;
        const period = periodIndex + 1;

        if (isEditMode && userGrade !== 1) {
            let initialSubject = cellData?.subject_name || '';
            let initialLocation = cellData?.location || '';

            setEditModal({ open: true, day: dayOfWeek, period });
            setEditForm({
                period,
                subject_name: initialSubject,
                location: initialLocation,
                memo: cellData?.memo || '',
                color: cellData?.color || PRESET_COLORS[0],
            });
        } else if (cellData) {
            setDetailModal({ open: true, data: { ...cellData, dayString: DAYS[dayIndex] } });
        }
    };

    // ─── 과목 선택 ─────────────────────────────
    const handleSubjectChange = (subject) => {
        setEditForm(prev => ({
            ...prev,
            subject_name: subject,
        }));
    };

    // ─── 적용 저장 ────────────────────────────────────────────────────
    const handleEditSave = () => {
        if (!editForm.subject_name.trim()) {
            showToast('알림', '과목을 선택/입력해주세요.');
            return;
        }
        const newGrid = grid.map(row => [...row]);
        const di = editModal.day - 1;
        const pi = editModal.period - 1;
        newGrid[pi][di] = {
            day_of_week: editModal.day,
            period: editModal.period,
            subject_name: editForm.subject_name,
            location: editForm.location,
            memo: editForm.memo,
            color: editForm.color,
        };
        applyGridChange(newGrid);
        setEditModal({ open: false, day: null, period: null });
    };

    // ─── 셀 비우기 ────────────────────────────────────────────────────
    const handleCellDelete = () => {
        const newGrid = grid.map(row => [...row]);
        newGrid[editModal.period - 1][editModal.day - 1] = null;
        applyGridChange(newGrid);
        setEditModal({ open: false, day: null, period: null });
    };

    const getAutoSaveLabel = () => {
        if (saveStatus === 'saving') return '저장 중...';
        if (saveStatus === 'saved') return '저장됨';
        if (saveStatus === 'error') return '자동 저장 실패';
        return '자동 저장';
    };

    // ─── 렌더링 ───────────────────────────────────────────────────────
    return (
        <div className="timetable-container has-bottom-nav">
            <div className="timetable-header-section">
                <h1>내 시간표</h1>
                {userGrade === 1 ? (
                    <span style={{ fontSize: '0.8rem', color: '#666', background: '#eee', padding: '4px 8px', borderRadius: '12px' }}>
                        1학년 자동 동기화
                    </span>
                ) : isEditMode ? (
                    <div className="timetable-header-actions">
                        <span className={`autosave-status ${saveStatus}`}>
                            {getAutoSaveLabel()}
                        </span>
                        <button className="btn-edit-toggle save-mode" onClick={() => setIsEditMode(false)}>
                            완료
                        </button>
                    </div>
                ) : (
                    <button className="btn-edit-toggle" onClick={() => setIsEditMode(true)}>
                        시간표 수정
                    </button>
                )}
            </div>

            <div className="timetable-card">
                <div className="timetable-grid">
                    <div className="grid-header"></div>
                    {DAYS.map((day, i) => (
                        <div
                            key={i}
                            className={`grid-header ${isEditMode && userGrade !== 1 ? 'clickable' : ''}`}
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
                                    className={`grid-cell ${isEditMode && userGrade !== 1 ? 'edit-mode' : ''}`}
                                    style={{ backgroundColor: cell ? cell.color : '#FFFFFF' }}
                                    onClick={() => handleCellClick(dayIndex, periodIndex)}
                                >
                                    {cell && (
                                        <>
                                            <span className="cell-subject">{cell.subject_name}</span>
                                            <span className="cell-location">{cell.location}</span>
                                        </>
                                    )}
                                    {isEditMode && userGrade !== 1 && !cell && (
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
                        
                        {/* 1학년의 경우 DB에 저장된 색상/메모를 수정할 수 있도록 허용할 수도 있지만, 여기서는 간단히 닫기만 제공 */}
                        <div className="modal-actions">
                            <button className="btn-submit" onClick={() => setDetailModal({ open: false, data: null })}>
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 편집 모달 */}
            {editModal.open && userGrade !== 1 && (
                <div className="modal-overlay" onClick={() => setEditModal({ open: false, day: null, period: null })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">
                            {DAYS[editModal.day - 1]}요일 {editModal.period}교시 설정
                        </h2>

                        {/* 과목 선택 */}
                        <div className="form-group">
                            <label className="form-label">과목 선택</label>
                            {neisError && (
                                <div className="neis-error-badge timetable-subject-error">
                                    {neisError}
                                </div>
                            )}
                            {neisLoading ? (
                                <div className="neis-loading-hint">⏳ 과목 목록을 불러오는 중...</div>
                            ) : availableSubjects.length > 0 ? (
                                <div className="subject-option-list">
                                    {availableSubjects.map((opt, idx) => (
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
                                    등록된 과목이 없습니다.<br />
                                    직접 입력하거나 관리자에게 문의하세요.
                                </div>
                            )}
                        </div>

                        {/* 선택된 과목 및 강의실 설정 */}
                        <div className="form-group">
                            <label className="form-label">
                                과목명 <span style={{ color: '#E93E4F' }}>*</span>
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
                                강의실(위치) <span style={{ fontSize: '0.7rem', color: '#999', marginLeft: '4px', fontWeight: 'normal' }}>(선택사항)</span>
                            </label>
                            <input
                                type="text"
                                className="modal-input"
                                placeholder="예: 3학년 11반, 음악실"
                                value={editForm.location}
                                onChange={e => setEditForm({ ...editForm, location: e.target.value })}
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
