import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {MainPage} from './components/MainPage';
import {Header} from "./components/Header.jsx";



function App() {
    return (
        <BrowserRouter>

            {/*상단바*/}
            <Header />


            <Routes>

                {

                    //로그인 안하면 여기로 보내기
                    //여기서 로그인 하면 메인페이지로 보내기
                    // <Route path="/" element={<LoginPage />} />

                    // 로그인만 한사람 여기로 보내기
                    //로그인 안한사람 여기들어오면 로그인페이지로 튕기기
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