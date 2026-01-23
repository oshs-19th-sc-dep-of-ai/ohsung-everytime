import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {MainPage} from './pages/MainPage';   



function App() {
    return (
        <BrowserRouter>
            <Routes>

                {

                    //로그인 안하면 여기로 보내기
                    // <Route path="/" element={<LoginPage />} />

                    // 로그인만 한사람 여기로 보내기
                    <Route path="/main" element={<MainPage />} />

                    //글목록 라우트
                    // <Route path="/postList" element={<??? />} />
                    //+ post 라우트는 /post/postID로 처리예정?

                    //급식확인 라우트
                    // <Route path="/meal" element={<??? />} />


                }

            </Routes>
        </BrowserRouter>
    );
}

export default App;