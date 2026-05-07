//export const API_BASE_URL = 'https://api-c.coshsc.kr';
export const API_BASE_URL = 'http://localhost:5000';
// 환경 변수에서 GIPHY API KEY를 가져옵니다. (Vite 환경 변수 사용)
export const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'MISSING_API_KEY';