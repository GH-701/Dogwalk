const express = require('express');
const router = express.Router();

// 1. 서울시 공원 정보 프록시 API (최대 133개 전역 공원)
router.get('/parks', async (req, res) => {
    try {
        const apiKey = process.env.SEOUL_API_KEY;
        const count = req.query.count || 133;
        const targetUrl = `http://openapi.seoul.go.kr:8088/${apiKey}/json/SearchParkInfoService/1/${count}/`;
        
        const response = await fetch(targetUrl);
        if (!response.ok) {
            throw new Error(`서울시 API 응답 오류: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('[API /parks] 오류:', err.message);
        res.status(500).json({ error: '서울시 공원 정보를 불러오지 못했습니다.', details: err.message });
    }
});

// 2. 한국문화정보원 반려동물 동반 문화시설 위치 데이터 프록시 API
router.get('/culture', async (req, res) => {
    try {
        const apiKey = process.env.PUBLIC_DATA_KEY;
        const page = req.query.page || 1;
        const perPage = req.query.perPage || 40;
        const targetUrl = `https://api.odcloud.kr/api/15111389/v1/uddi:41944402-8249-4e45-9e9d-a52d0a7db1cc?serviceKey=${apiKey}&page=${page}&perPage=${perPage}`;

        const response = await fetch(targetUrl);
        if (!response.ok) {
            throw new Error(`문화정보원 API 응답 오류: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('[API /culture] 오류:', err.message);
        res.status(500).json({ error: '문화시설 정보를 불러오지 못했습니다.', details: err.message });
    }
});

// 3. 식품의약품안전처 반려동물 출입가능 음식점 프록시 API
router.get('/food', async (req, res) => {
    try {
        const apiKey = process.env.FOOD_SAFETY_KEY;
        const start = req.query.start || 1;
        const end = req.query.end || 20;
        const targetUrl = `http://openapi.foodsafetykorea.go.kr/api/${apiKey}/I1200/json/${start}/${end}`;

        const response = await fetch(targetUrl);
        if (!response.ok) {
            throw new Error(`식약처 API 응답 오류: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('[API /food] 오류:', err.message);
        res.status(500).json({ error: '식약처 음식점 정보를 불러오지 못했습니다.', details: err.message });
    }
});

// 4. OpenStreetMap Nominatim 정밀 도로망 & 지오코딩 프록시 (CORS 및 헤더 정책 준수)
router.get('/geocode', async (req, res) => {
    try {
        const q = req.query.q;
        if (!q) {
            return res.status(400).json({ error: '검색어(q) 파라미터가 필요합니다.' });
        }

        const targetUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&polygon_geojson=1&limit=3`;
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'GreenPath-DogWalking-Platform/1.0 (contact: greenpath@local.dev)',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Nominatim API 응답 오류: ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error('[API /geocode] 오류:', err.message);
        res.status(500).json({ error: '도로망 지오코딩 조회에 실패했습니다.', details: err.message });
    }
});

module.exports = router;
