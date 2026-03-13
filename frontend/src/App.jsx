import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {MainPage} from './components/MainPage';
import {Header} from "./components/Header.jsx";
import {PostListPage} from "./components/PostListPage.jsx";
import {PostDetailPage} from './components/PostDetailPage'
import MealPage from './components/meal.jsx';
import {PostWritePage} from './components/PostWritePage.jsx'



function App() {
    return (
        <BrowserRouter>

            {/*상단바*/}
            <Header />

            <Routes>

                    {/*//로그인 안하면 여기로 보내기*/}
                    {/*//여기서 로그인 하면 메인페이지로 보내기*/}
                    {/*<Route path="/" element={<LoginPage />} />*/}

                    {/*// 로그인만 한사람 여기로 보내기*/}
                    {/*//로그인 안한사람 여기들어오면 로그인페이지로 튕기기*/}
                    <Route path="/" element={<MainPage />} />

                    {/*//글목록 라우트*/}
                    <Route path="/board" element={<PostListPage />} />

                    {/*글목록 페이지에서 넘겨야함*/}
                    <Route path="/post/:postId" element={<PostDetailPage  />} />

                    {/*//급식확인 라우트*/}
                    <Route path="/meal" element={<MealPage  />} />


                    {/*글쓰기 페이지 라우트*/}
                    <Route path="/postWrite" element={<PostWritePage  />} />




            </Routes>
        </BrowserRouter>
    );
}

export default App;