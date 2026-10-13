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
// 2. 서울시 실시간 대기환경 정보 API
router.get('/air-quality', async (req, res) => {
    try {
        const apiKey = process.env.SEOUL_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                error: '서울시 API 키가 설정되지 않았습니다.'
            });
        }

        const targetUrl =
            `http://openapi.seoul.go.kr:8088/${apiKey}/json/RealtimeCityAir/1/25/`;

        const response = await fetch(targetUrl);

        if (!response.ok) {
            throw new Error(`서울시 API 응답 오류: ${response.status}`);
        }

        const data = await response.json();

        if (!data.RealtimeCityAir) {
            return res.status(502).json({
                error: '대기질 데이터 응답을 확인할 수 없습니다.',
                details: data.RESULT || data
            });
        }

        res.json(data);

    } catch (err) {
        console.error('[API /air-quality] 오류:', err.message);

        res.status(500).json({
            error: '실시간 대기질 정보를 불러오지 못했습니다.',
            details: err.message
        });
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
// 출발지 좌표를 서울시 자치구 이름으로 변환
router.get('/reverse-geocode', async (req, res) => {
    try {
        const lon = Number(req.query.lon);
        const lat = Number(req.query.lat);

        if (
            !req.query.lon || !req.query.lat ||
            !Number.isFinite(lon) || !Number.isFinite(lat) ||
            lon < 124 || lon > 132 ||
            lat < 33 || lat > 39
        ) {
            return res.status(400).json({
                error: '올바른 위도와 경도를 입력해주세요.'
            });
        }

        const targetUrl =
            `https://nominatim.openstreetmap.org/reverse` +
            `?lat=${lat}&lon=${lon}&format=json&zoom=12&addressdetails=1`;

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
        const address = data.address || {};

        // 주소 정보에서 서울시 자치구 찾기
        const candidates = [
            address.borough,
            address.city_district,
            address.county,
            address.district,
            address.suburb
        ];

        const district = candidates.find(
            value => typeof value === 'string' &&
                     /^[가-힣]+구$/.test(value)
        ) || null;

        res.json({
            district,
            displayName: data.display_name || null
        });

    } catch (err) {
        console.error('[API /reverse-geocode] 오류:', err.message);

        res.status(502).json({
            error: '출발지 행정구역 조회에 실패했습니다.'
        });
    }
});
// 5. 실제 도보 경로 계산 API (Valhalla)
router.get('/walking-route', async (req, res) => {
    try {
        const required = ['startLon', 'startLat', 'endLon', 'endLat'];

        if (required.some(key => !req.query[key])) {
            return res.status(400).json({
                error: '출발지와 도착지 좌표가 필요합니다.'
            });
        }

        const startLon = Number(req.query.startLon);
        const startLat = Number(req.query.startLat);
        const endLon = Number(req.query.endLon);
        const endLat = Number(req.query.endLat);

        const valid =
            [startLon, startLat, endLon, endLat].every(Number.isFinite) &&
            Math.abs(startLon) <= 180 &&
            Math.abs(endLon) <= 180 &&
            Math.abs(startLat) <= 90 &&
            Math.abs(endLat) <= 90;

        if (!valid) {
            return res.status(400).json({
                error: '올바른 좌표를 입력해주세요.'
            });
        }

        const routeRequest = {
            locations: [
                { lat: startLat, lon: startLon },
                { lat: endLat, lon: endLon }
            ],
            costing: 'pedestrian',
            units: 'kilometers',
            directions_options: {
                units: 'kilometers'
            }
        };

        console.log('[Valhalla] 도보 경로 요청 시작');

        const url = new URL('https://valhalla1.openstreetmap.de/route');
        url.searchParams.set('json', JSON.stringify(routeRequest));

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(20000)
        });

        const responseText = await response.text();

        console.log('[Valhalla 응답 상태]', response.status);

        let data;

        try {
            data = JSON.parse(responseText);
        } catch (err) {
            return res.status(502).json({
                error: 'Valhalla에서 JSON 응답을 받지 못했습니다.',
                upstreamStatus: response.status
            });
        }

        if (!response.ok || !data.trip || !data.trip.legs) {
            return res.status(502).json({
                error: 'Valhalla 도보 경로 계산에 실패했습니다.',
                details: data.error || data.error_code || data.status_message
            });
        }

        // Valhalla는 경로를 인코딩된 polyline으로 반환합니다.
        // 아래 함수로 위도/경도 좌표 배열로 변환합니다.
        function decodePolyline(encoded) {
            let index = 0;
            let lat = 0;
            let lon = 0;
            const coordinates = [];

            while (index < encoded.length) {
                let shift = 0;
                let result = 0;
                let byte;

                do {
                    byte = encoded.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);

                lat += (result & 1) ? ~(result >> 1) : (result >> 1);

                shift = 0;
                result = 0;

                do {
                    byte = encoded.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);

                lon += (result & 1) ? ~(result >> 1) : (result >> 1);

                // Valhalla는 정밀도 6을 사용합니다.
                coordinates.push([lon / 1e6, lat / 1e6]);
            }

            return coordinates;
        }

        const coordinates = [];

        for (const leg of data.trip.legs) {
            const legCoordinates = decodePolyline(leg.shape);

            if (coordinates.length > 0 && legCoordinates.length > 0) {
                legCoordinates.shift();
            }

            coordinates.push(...legCoordinates);
        }

        if (coordinates.length < 2) {
            return res.status(502).json({
                error: '경로 좌표를 생성하지 못했습니다.'
            });
        }

        res.json({
            coordinates,
            distanceMeter: data.trip.summary.length * 1000,
            durationSeconds: data.trip.summary.time
        });

    } catch (err) {
        console.error('[API /walking-route] 오류:', err.message);

        res.status(502).json({
            error: '도보 경로 서비스를 이용할 수 없습니다.',
            details: err.message
        });
    }
});

// 기상청 초단기실황 조회 API
// 위도·경도를 기상청 격자 좌표(nx, ny)로 변환
function convertToKmaGrid(lat, lon) {
    const RE = 6371.00877;
    const GRID = 5.0;
    const SLAT1 = 30.0;
    const SLAT2 = 60.0;
    const OLON = 126.0;
    const OLAT = 38.0;
    const XO = 43;
    const YO = 136;

    const DEGRAD = Math.PI / 180.0;

    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD;
    const slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD;
    const olat = OLAT * DEGRAD;

    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
             Math.tan(Math.PI * 0.25 + slat1 * 0.5);

    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);

    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;

    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = re * sf / Math.pow(ro, sn);

    let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
    ra = re * sf / Math.pow(ra, sn);

    let theta = lon * DEGRAD - olon;

    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;

    theta *= sn;

    return {
        nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
        ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)
    };
}
router.get('/weather', async (req, res) => {
    try {
        const apiKey = process.env.KMA_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                error: '기상청 API 키가 설정되지 않았습니다.'
            });
        }

        // 출발지 좌표 받기
const lon = Number(req.query.lon);
const lat = Number(req.query.lat);

// 좌표가 없으면 기존 마포구청역 좌표 사용
const hasCoordinates =
    req.query.lon !== undefined &&
    req.query.lat !== undefined;

if (
    hasCoordinates &&
    (!Number.isFinite(lon) || !Number.isFinite(lat) ||
     lon < 124 || lon > 132 || lat < 33 || lat > 39)
) {
    return res.status(400).json({
        error: '올바른 국내 위도·경도를 입력해주세요.'
    });
}

const grid = hasCoordinates
    ? convertToKmaGrid(lat, lon)
    : { nx: 59, ny: 127 };

const nx = grid.nx;
const ny = grid.ny;

console.log('[Dogwalk] 날씨 조회 격자:', { nx, ny });

        // 기상청 발표 기준 시각 계산 (매시 40분 이후 발표)
        const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const base = new Date(now);

        if (base.getUTCMinutes() < 40) {
            base.setUTCHours(base.getUTCHours() - 1);
        }

        const baseDate =
            base.getUTCFullYear().toString() +
            String(base.getUTCMonth() + 1).padStart(2, '0') +
            String(base.getUTCDate()).padStart(2, '0');

        const baseTime =
            String(base.getUTCHours()).padStart(2, '0') + '00';

        const params = new URLSearchParams({
            serviceKey: apiKey,
            pageNo: '1',
            numOfRows: '100',
            dataType: 'JSON',
            base_date: baseDate,
            base_time: baseTime,
            nx: String(nx),
            ny: String(ny)
        });

        const url =
            'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?' +
            params.toString();

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('기상청 API HTTP 오류: ' + response.status);
        }

        const data = await response.json();

        const header = data.response?.header;

        if (header?.resultCode !== '00') {
            throw new Error(
                header?.resultMsg || '기상청 API 응답 오류'
            );
        }

        const items = data.response?.body?.items?.item || [];

        const getValue = (category) =>
            items.find(item => item.category === category)?.obsrValue ?? null;

        res.json({
            region: hasCoordinates
    ? `출발지 주변 (기상청 격자 ${nx}, ${ny})`
    : '마포구청역 인근',
            baseDate,
            baseTime,
            temperature: getValue('T1H'),
            humidity: getValue('REH'),
            rainfall: getValue('RN1'),
            windSpeed: getValue('WSD')
        });

    } catch (error) {
        console.error('[API /weather] 오류:', error.message);

        res.status(500).json({
            error: '날씨 정보를 불러오지 못했습니다.',
            details: error.message
        });
    }
});
module.exports = router;

