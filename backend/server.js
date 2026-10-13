require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 1. API 라우터 등록
const apiRouter = require('./routes/api');
const walksRouter = require('./routes/walks');

app.use('/api', apiRouter);
app.use('/api/walks', walksRouter);

// 2. 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        service: 'Green Path Backend API',
        timestamp: new Date().toISOString()
    });
});

// 3. 프론트엔드 정적 파일 서빙 (단일 포트로 웹앱 전체 구동)
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// 그 외 경로는 프론트엔드 index.html로 포워딩 (SPA Fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// 서버 실행
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🌿 Green Path & 댕댕한바퀴 풀스택 서버가 시작되었습니다!`);
    console.log(`📍 웹 접속 URL:   http://localhost:${PORT}`);
    console.log(`📡 API 헬스체크: http://localhost:${PORT}/health`);
    console.log(`=======================================================`);
});
