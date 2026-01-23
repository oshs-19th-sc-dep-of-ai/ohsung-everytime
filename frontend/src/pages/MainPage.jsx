
import './MainPage.css'; // CSS 파일 임포트



export function MainPage() {

    const handleLogout = () => {
        alert("로그아웃");
        //로그아웃 처리 로직
    };

    const goMeal = () => {
        alert("급식메뉴");
        //급식메뉴 페이지 이동 처리

    };

    const goPostList = () => {
        alert("게시판");
        //게시판 페이지로 이동처리

    };
    


    return (
        <div className="app-container">
            {/* 상단바 */}
            <header className="top-bar">
                <div className="top-bar-content">
                    <h1 className="logo">오성에타</h1>
                    <button className="login-button" type="button" onClick={handleLogout}>
                        로그아웃
                    </button>
                </div>
            </header>

            {/* 메인 콘텐츠 */}
            <main className="content-area">
                <section className="welcome-section">
                    <h2>홍길동님, 환영합니다 👋</h2> {/* 추후 학생정보에서 이름가져와서 표시예정  */}
                    <p className="sub-text"></p>
                </section>

                {/* 선택창 (반응형 그리드 적용) */}
                <section className="selection-grid">
                    
                    
                    {/* 옵션 1: 급식 */}
                    <article className="selection-card menu-card" onClick={goMeal}>
                        <div className="card-text">
                            <h3>급식 메뉴 🍱</h3>
                            <p>오늘의 맛있는 점심 확인하기</p> 
                        </div>
                        <div className="card-icon">➜</div>
                    </article>

                    {/* 옵션 2: 게시판 */}
                    <article className="selection-card board-card" onClick={goPostList}>
                        <div className="card-text">
                            <h3>자유 게시판 💬</h3>
                            <p>천안오성고 학생들과 소통하기</p>   {/* 적절한 문구 선정예정 */}
                        </div>
                        <div className="card-icon">➜</div>
                    </article>
                    
                    
                    
                    
                </section>
            </main>
        </div>
    );
}