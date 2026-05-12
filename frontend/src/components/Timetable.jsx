import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './Timetable.css';

const SUBJECTS_BY_GRADE = {
    1: ['국어', '수학', '영어', '한국사', '통합사회', '통합과학', '체육', '음악', '미술'],
    2: ['문학', '수학I', '수학II', '영어I', '물리학I', '화학I', '생명과학I', '지구과학I', '체육'],
    3: ['독서', '미적분', '기하', '영어II', '물리학II', '화학II', '생명과학II', '지구과학II', '체육']
};

const LOCATIONS_BY_GRADE = {
    1: ['1학년 1반', '1학년 2반', '과학실', '음악실', '미술실', '강당'],
    2: ['2학년 1반', '2학년 2반', '제1과학실', '제2과학실', '컴퓨터실', '체육관'],
    3: ['3학년 1반', '3학년 2반', '물리실험실', '화학실험실', '생명실험실', '대강당']
};

const DAYS = ['월', '화', '수', '목', '금'];

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
    const [grid, setGrid] = useState(Array.from({ length: 7 }, () => Array(5).fill(null)));
    const [isEditMode, setIsEditMode] = useState(false);

    const studentGrade = localStorage.getItem("student_grade") || "1";

    const [detailModal, setDetailModal] = useState({ open: false, data: null });
    const [editModal, setEditModal] = useState({ open: false, day: null });

    const [editForm, setEditForm] = useState({
        selectedPeriods: [],
        subject_name: '',
        location: '',
        memo: '',
        color: PRESET_COLORS[0] // 기본 컬러 설정
    });

    const fetchTimetable = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/timetable`, { withCredentials: true });
            const data = response.data.timetable || [];

            const newGrid = Array.from({ length: 7 }, () => Array(5).fill(null));

            data.forEach(item => {
                if(item.period >= 1 && item.period <= 7 && item.day_of_week >= 1 && item.day_of_week <= 5) {
                    newGrid[item.period - 1][item.day_of_week - 1] = item;
                }
            });
            setGrid(newGrid);
        } catch (error) {
            console.error("시간표를 불러오는 중 오류 발생:", error);
        }
    };

    useEffect(() => {
        fetchTimetable();
    }, []);

    const handleCellClick = (dayIndex, periodIndex) => {
        const cellData = grid[periodIndex][dayIndex];
        const dayOfWeek = dayIndex + 1;
        const period = periodIndex + 1;

        if (isEditMode) {
            setEditModal({ open: true, day: dayOfWeek });
            setEditForm({
                selectedPeriods: [period],
                subject_name: cellData ? cellData.subject_name : SUBJECTS_BY_GRADE[studentGrade][0],
                location: cellData ? cellData.location : LOCATIONS_BY_GRADE[studentGrade][0],
                memo: cellData ? (cellData.memo || '') : '',
                // 기존 색상이 있으면 불러오고, 없으면 프리셋 0번(기본) 적용
                color: cellData ? (cellData.color || PRESET_COLORS[0]) : PRESET_COLORS[0]
            });
        } else if (cellData) {
            setDetailModal({ open: true, data: { ...cellData, dayString: DAYS[dayIndex] } });
        }
    };

    const handleEditSave = () => {
        const newGrid = [...grid.map(row => [...row])];
        const dayIndex = editModal.day - 1;

        editForm.selectedPeriods.forEach(p => {
            const periodIndex = p - 1;
            newGrid[periodIndex][dayIndex] = {
                day_of_week: editModal.day,
                period: p,
                subject_name: editForm.subject_name,
                location: editForm.location,
                memo: editForm.memo,
                color: editForm.color // 선택한 색상 저장
            };
        });

        setGrid(newGrid);
        setEditModal({ open: false, day: null });
    };

    const handleCellDelete = () => {
        const newGrid = [...grid.map(row => [...row])];
        const dayIndex = editModal.day - 1;

        editForm.selectedPeriods.forEach(p => {
            newGrid[p - 1][dayIndex] = null;
        });

        setGrid(newGrid);
        setEditModal({ open: false, day: null });
    };

    const handleSaveToServer = async () => {
        try {
            const payload = [];
            grid.forEach(row => {
                row.forEach(cell => {
                    if (cell) payload.push(cell);
                });
            });

            await axios.put(`${API_BASE_URL}/timetable`, { timetable: payload }, { withCredentials: true });
            alert("시간표가 성공적으로 저장되었습니다!");
            setIsEditMode(false);
            fetchTimetable();
        } catch (error) {
            console.error("시간표 저장 실패:", error);
            alert("시간표 저장에 실패했습니다.");
        }
    };

    const togglePeriod = (p) => {
        setEditForm(prev => {
            const isSelected = prev.selectedPeriods.includes(p);
            if (isSelected && prev.selectedPeriods.length === 1) return prev;

            return {
                ...prev,
                selectedPeriods: isSelected
                    ? prev.selectedPeriods.filter(sp => sp !== p)
                    : [...prev.selectedPeriods, p].sort((a, b) => a - b)
            };
        });
    };

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

            <div className="timetable-card">
                <div className="timetable-grid">
                    <div className="grid-header"></div>
                    {DAYS.map((day, i) => (
                        <div key={i} className="grid-header">{day}</div>
                    ))}

                    {grid.map((row, periodIndex) => (
                        <React.Fragment key={periodIndex}>
                            <div className="grid-time-col">{periodIndex + 1}</div>
                            {row.map((cell, dayIndex) => (
                                <div
                                    key={dayIndex}
                                    className={`grid-cell ${isEditMode ? 'edit-mode' : ''}`}
                                    /* 데이터가 있으면 설정된 색상을, 비어있으면 흰색을 배경으로 지정 */
                                    style={{ backgroundColor: cell ? cell.color : '#FFFFFF' }}
                                    onClick={() => handleCellClick(dayIndex, periodIndex)}
                                >
                                    {cell && (
                                        <>
                                            <span className="cell-subject">{cell.subject_name}</span>
                                            <span className="cell-location">{cell.location}</span>
                                        </>
                                    )}
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {detailModal.open && detailModal.data && (
                <div className="modal-overlay" onClick={() => setDetailModal({ open: false, data: null })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">{detailModal.data.subject_name}</h2>

                        <div className="modal-detail-item">
                            <div className="modal-detail-label">시간</div>
                            <div className="modal-detail-value">{detailModal.data.dayString}요일 {detailModal.data.period}교시</div>
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
                            <button className="btn-submit" onClick={() => setDetailModal({ open: false, data: null })}>닫기</button>
                        </div>
                    </div>
                </div>
            )}

            {editModal.open && (
                <div className="modal-overlay" onClick={() => setEditModal({ open: false, day: null })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">{DAYS[editModal.day - 1]}요일 시간표 설정</h2>

                        <div className="form-group">
                            <label className="form-label">교시 선택 (연강 설정)</label>
                            <div className="period-selector">
                                {[1, 2, 3, 4, 5, 6, 7].map(p => (
                                    <div
                                        key={p}
                                        className={`period-chip ${editForm.selectedPeriods.includes(p) ? 'selected' : ''}`}
                                        onClick={() => togglePeriod(p)}
                                    >
                                        {p}교시
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">과목</label>
                            <select
                                className="modal-select"
                                value={editForm.subject_name}
                                onChange={e => setEditForm({...editForm, subject_name: e.target.value})}
                            >
                                {SUBJECTS_BY_GRADE[studentGrade].map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">장소</label>
                            <select
                                className="modal-select"
                                value={editForm.location}
                                onChange={e => setEditForm({...editForm, location: e.target.value})}
                            >
                                {LOCATIONS_BY_GRADE[studentGrade].map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">배경 색상</label>
                            <div className="color-picker-group">
                                {PRESET_COLORS.map(color => (
                                    <div
                                        key={color}
                                        className={`color-chip ${editForm.color === color ? 'selected' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setEditForm({ ...editForm, color: color })}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">메모 (선택)</label>
                            <input
                                type="text"
                                className="modal-input"
                                placeholder="준비물 등 간단한 메모"
                                value={editForm.memo}
                                onChange={e => setEditForm({...editForm, memo: e.target.value})}
                            />
                        </div>

                        <button className="btn-submit btn-delete" onClick={handleCellDelete}>해당 교시 비우기</button>

                        <div className="modal-actions" style={{marginTop: '0'}}>
                            <button className="btn-cancel" onClick={() => setEditModal({ open: false, day: null })}>취소</button>
                            <button className="btn-submit" onClick={handleEditSave}>적용</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}