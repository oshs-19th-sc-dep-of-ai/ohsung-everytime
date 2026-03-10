import { useState, useEffect } from "react";
import "./meal.css";

const BASE_URL = "http://localhost:5000";

//유틸 함수
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
};

const formatDisplayDate = (date) => {
  const day = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${day})`;
};

const checkIsToday = (date) => formatDate(date) === formatDate(new Date());

const checkIsWeekend = (date) => date.getDay() === 0 || date.getDay() === 6;

const parseMenu = (menuStr) => {
  if (!menuStr) return [];
  return menuStr
    .split("\n")
    .map((item) => item.replace(/\s*\([\d.]+\)\s*/g, "").trim())
    .filter(Boolean);
};

const parseNutrition = (ntrStr) => {
  if (!ntrStr) return [];
  return ntrStr
    .split("<br/>")
    .map((item) => {
      const [name, value] = item.split(":");
      return { name: name?.trim(), value: value?.trim() };
    })
    .filter((n) => n.name && n.value);
};

//MealCard 컴포넌트
function MealCard({ title, icon, data, loading, error }) {
  const [showNutrition, setShowNutrition] = useState(false);

  return (
    <div className="meal-card">
      {/* 헤더 */}
      <div className="meal-card__header">
        <span className="meal-card__icon">{icon}</span>
        <span className="meal-card__title">{title}</span>
      </div>

      {/* 로딩 스켈레톤 */}
      {loading && (
        <div className="meal-card__skeleton-wrap">
          <div className="meal-card__skeleton" style={{ width: "100%" }} />
          <div className="meal-card__skeleton" style={{ width: "75%" }} />
          <div className="meal-card__skeleton" style={{ width: "55%" }} />
        </div>
      )}

      {/* 에러 */}
      {!loading && error && (
        <div className="meal-card__error">
          <span>⚠️</span> 급식 정보를 불러올 수 없습니다.
        </div>
      )}

      {/* 데이터 없음 */}
      {!loading && !error && (!data || data.length === 0) && (
        <div className="meal-card__empty">
          <div className="meal-card__empty-icon">🍽️</div>
          오늘은 급식이 없습니다.
        </div>
      )}

      {/* 급식 정보 */}
      {!loading && !error && data && data.length > 0 && (
        <>
          <ul className="meal-card__menu-list">
            {parseMenu(data[0].메뉴).map((item, i) => (
              <li key={i} className="meal-card__menu-item">
                <span className="meal-card__menu-dot">•</span>
                {item}
              </li>
            ))}
          </ul>

          <div className="meal-card__footer">
            <div className="meal-card__kcal">
              <span>🔥</span>
              <span className="meal-card__kcal-text">{data[0].칼로리}</span>
            </div>

            {data[0].영양정보 && (
              <button
                className={`meal-card__nutrition-btn${showNutrition ? " meal-card__nutrition-btn--active" : ""}`}
                onClick={() => setShowNutrition((prev) => !prev)}
              >
                영양정보 {showNutrition ? "▲" : "▼"}
              </button>
            )}
          </div>

          {showNutrition && data[0].영양정보 && (
            <div className="meal-card__nutrition-grid">
              {parseNutrition(data[0].영양정보).map((n, i) => (
                <div key={i} className="meal-card__nutrition-row">
                  <span className="meal-card__nutrition-label">{n.name}</span>
                  <span className="meal-card__nutrition-value">{n.value}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

//MealPage 메인 컴포넌트
export default function MealPage() {
  const [date, setDate] = useState(new Date());
  const [lunch, setLunch] = useState(null);
  const [dinner, setDinner] = useState(null);
  const [lunchLoading, setLunchLoading] = useState(false);
  const [dinnerLoading, setDinnerLoading] = useState(false);
  const [lunchError, setLunchError] = useState(false);
  const [dinnerError, setDinnerError] = useState(false);

  //날짜 변경 시 API 호출
  useEffect(() => {
    if (checkIsWeekend(date)) return;

    const dateStr = formatDate(date);

    const fetchLunch = async () => {
      setLunchLoading(true);
      setLunchError(false);
      setLunch(null);
      try {
        const res = await fetch(`${BASE_URL}/meal_lunch?date=${dateStr}`);
        if (!res.ok) throw new Error();
        setLunch(await res.json());
      } catch {
        setLunchError(true);
      } finally {
        setLunchLoading(false);
      }
    };

    const fetchDinner = async () => {
      setDinnerLoading(true);
      setDinnerError(false);
      setDinner(null);
      try {
        const res = await fetch(`${BASE_URL}/meal_dinner?date=${dateStr}`);
        if (!res.ok) throw new Error();
        setDinner(await res.json());
      } catch {
        setDinnerError(true);
      } finally {
        setDinnerLoading(false);
      }
    };

    fetchLunch();
    fetchDinner();
  }, [date]);

  const changeDate = (days) => {
    setDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const isWeekend = checkIsWeekend(date);
  const isToday = checkIsToday(date);

  return (
    <div className="meal-page">
      {/* 헤더 */}
      <header className="meal-header">
        <div className="meal-header__inner">
          <button
            className="meal-header__nav-btn"
            onClick={() => changeDate(-1)}
          >
            ←
          </button>

          <div className="meal-header__date-box">
            <div className="meal-header__date-text">
              {formatDisplayDate(date)}
            </div>
            {isToday && <div className="meal-header__today-badge">오늘</div>}
          </div>

          <button
            className="meal-header__nav-btn"
            onClick={() => changeDate(1)}
          >
            →
          </button>
        </div>
      </header>

      {/* 본문 */}
      <main className="meal-body">
        {isWeekend ? (
          <div className="meal-weekend">
            <div className="meal-weekend__icon">🏖️</div>
            <div className="meal-weekend__title">주말은 급식이 없어요!</div>
            <div className="meal-weekend__sub">평일을 선택해 주세요!</div>
          </div>
        ) : (
          <div className="meal-cards">
            <MealCard
              key={`lunch-${formatDate(date)}`}
              title="점심"
              icon="🥗"
              data={lunch}
              loading={lunchLoading}
              error={lunchError}
            />
            <MealCard
              key={`dinner-${formatDate(date)}`}
              title="석식"
              icon="🍚"
              data={dinner}
              loading={dinnerLoading}
              error={dinnerError}
            />
          </div>
        )}
      </main>
    </div>
  );
}
