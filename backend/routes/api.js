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
// 기본 도보 경로와 녹지 경유 경로 비교

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

        const start = [startLon, startLat];
        const end = [endLon, endLat];

        // 녹지 경유 후보 좌표
        const greenWaypoints = [
            { name: '경의선숲길', coords: [126.92320, 37.55890] },
            { name: '청계천', coords: [126.98000, 37.56910] },
            { name: '서울숲', coords: [127.04160, 37.54550] },
            { name: '여의도한강공원', coords: [126.93280, 37.52840] },
            { name: '석촌호수', coords: [127.10250, 37.50900] },
            { name: '올림픽공원', coords: [127.12150, 37.52060] },
            { name: '양재시민의숲', coords: [127.03850, 37.47050] },
            { name: '망원한강공원', coords: [126.89810, 37.55390] },
            { name: '보라매공원', coords: [126.91980, 37.49320] },
            { name: '선유도공원', coords: [126.90150, 37.54320] }
        ];

        // 두 좌표 사이 직선거리 계산 (미터)
        function distanceMeters(a, b) {
            const R = 6371000;
            const toRad = deg => deg * Math.PI / 180;

            const dLat = toRad(b[1] - a[1]);
            const dLon = toRad(b[0] - a[0]);

            const h =
                Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(a[1])) *
                Math.cos(toRad(b[1])) *
                Math.sin(dLon / 2) ** 2;

            return 2 * R * Math.asin(Math.sqrt(h));
        }

        const directDistance = distanceMeters(start, end);

        // 출발지와 도착지 사이에 있는 녹지 후보 선택
        const candidates = greenWaypoints
            .map(item => ({
                ...item,
                viaDistance:
                    distanceMeters(start, item.coords) +
                    distanceMeters(item.coords, end)
            }))
            .filter(item =>
                directDistance > 100 &&
                item.viaDistance <= directDistance * 1.25 &&
                distanceMeters(start, item.coords) > 100 &&
                distanceMeters(end, item.coords) > 100
            )
            .sort((a, b) => a.viaDistance - b.viaDistance);

        // Valhalla polyline6 좌표 변환
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

                lat += (result & 1)
                    ? ~(result >> 1)
                    : (result >> 1);

                shift = 0;
                result = 0;

                do {
                    byte = encoded.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);

                lon += (result & 1)
                    ? ~(result >> 1)
                    : (result >> 1);

                coordinates.push([lon / 1e6, lat / 1e6]);
            }

            return coordinates;
        }

        // Valhalla 보행 도로망 경로 요청
        async function requestWalkingRoute(points) {
            const routeRequest = {
                locations: points.map(point => ({
                    lon: point[0],
                    lat: point[1]
                })),
                costing: 'pedestrian',
                costing_options: {
                    pedestrian: {
                        use_ferry: 0,
                        use_living_streets: 1,
                        use_tracks: 1,
                        use_hills: 0.3
                    }
                },
                units: 'kilometers',
                directions_options: {
                    units: 'kilometers'
                }
            };

            const url = new URL(
                'https://valhalla1.openstreetmap.de/route'
            );

            url.searchParams.set(
                'json',
                JSON.stringify(routeRequest)
            );

            const response = await fetch(url, {
                headers: {
                    Accept: 'application/json'
                },
                signal: AbortSignal.timeout(20000)
            });

            const responseText = await response.text();

            let data;

            try {
                data = JSON.parse(responseText);
            } catch (error) {
                throw new Error(
                    'Valhalla에서 JSON 응답을 받지 못했습니다. HTTP ' +
                    response.status
                );
            }

            if (!response.ok || !data.trip?.legs?.length) {
                throw new Error(
                    data.error ||
                    data.status_message ||
                    'Valhalla 도보 경로 계산 실패'
                );
            }

            const coordinates = [];

            for (const leg of data.trip.legs) {
                const legCoordinates = decodePolyline(leg.shape);

                if (coordinates.length && legCoordinates.length) {
                    legCoordinates.shift();
                }

                coordinates.push(...legCoordinates);
            }

            if (coordinates.length < 2) {
                throw new Error('경로 좌표 생성 실패');
            }

            return {
                coordinates,
                distanceMeter: data.trip.summary.length * 1000,
                durationSeconds: data.trip.summary.time
            };
        }

        // 1. 기본 도보 경로 계산
        const basicRoute = await requestWalkingRoute([start, end]);

        let selectedRoute = basicRoute;
        let selectedGreen = null;

        // 2. 녹지 경유 경로 계산
        if (candidates.length > 0) {
            const candidate = candidates[0];

            try {
                const greenRoute = await requestWalkingRoute([
                    start,
                    candidate.coords,
                    end
                ]);

                // 실제 도보 거리 기준 30% 이내 우회만 허용
                if (
                    greenRoute.distanceMeter <=
                    basicRoute.distanceMeter * 1.3
                ) {
                    selectedRoute = greenRoute;
                    selectedGreen = candidate.name;
                }
            } catch (greenError) {
                console.warn(
                    '[Valhalla] 녹지 경유 실패, 기본 경로 사용:',
                    greenError.message
                );
            }
        }

        console.log('[Valhalla] 경로 선택:', {
            greenWaypoint: selectedGreen,
            distanceMeter: selectedRoute.distanceMeter
        });

                 // 기존 응답 + 경로 비교 정보
        res.json({
            coordinates: selectedRoute.coordinates,
            distanceMeter: selectedRoute.distanceMeter,
            durationSeconds: selectedRoute.durationSeconds,
            routeType: selectedGreen ? 'green' : 'basic',
            greenWaypoint: selectedGreen,

            basicRoute: {
                coordinates: basicRoute.coordinates,
                distanceMeter: basicRoute.distanceMeter,
                durationSeconds: basicRoute.durationSeconds
            },

            greenRoute: selectedGreen ? {
                coordinates: selectedRoute.coordinates,
                distanceMeter: selectedRoute.distanceMeter,
                durationSeconds: selectedRoute.durationSeconds
            } : null,

            extraDistanceMeter: selectedGreen
                ? Math.max(0, selectedRoute.distanceMeter - basicRoute.distanceMeter)
                : 0,

            extraDurationSeconds: selectedGreen
                ? Math.max(0, selectedRoute.durationSeconds - basicRoute.durationSeconds)
                : 0
        });

    } catch (err) {
        console.error('[API /walking-route] 오류:', err.message);

        res.status(502).json({
            error: '도보 경로 서비스를 이용할 수 없습니다.',
            details: err.message
        });
    }
});

// OSM green polygons: persistent cache and rate-limit-aware proxy.
const fsGreen = require('node:fs');
const pathGreen = require('node:path');
const greenCacheDir = pathGreen.join(__dirname, '..', 'cache', 'green-areas');
const greenCooldown = new Map();
const greenInflight = new Map();
const greenServers = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter'
];

router.get('/green-areas', async (req, res) => {
    const names = ['south', 'west', 'north', 'east'];
    if (names.some(name => req.query[name] === undefined || req.query[name] === '')) {
        return res.status(400).json({ error: 'south, west, north, east 값이 필요합니다.' });
    }
    const [south, west, north, east] = names.map(name => Number(req.query[name]));
    if (![south, west, north, east].every(Number.isFinite) ||
        south < 33 || north > 39 || west < 124 || east > 132 ||
        south >= north || west >= east ||
        north - south > 0.06 || east - west > 0.06) {
        return res.status(400).json({ error: '국내 0.06도 이내의 올바른 bbox가 필요합니다.' });
    }

    const bbox = [south, west, north, east].map(v => v.toFixed(5)).join(',');
    const cacheFile = pathGreen.join(greenCacheDir, bbox.replaceAll(',', '_') + '.json');
    // A successful OSM response is saved to disk and reused across restarts.
    try {
        const saved = JSON.parse(fsGreen.readFileSync(cacheFile, 'utf8'));
        if (Array.isArray(saved.elements)) return res.json({ ...saved, cached: true });
    } catch (_) { /* No cache yet. */ }

    const query = `[out:json][timeout:15];(way["leisure"~"^(park|garden|nature_reserve)$"](${bbox});relation["leisure"~"^(park|garden|nature_reserve)$"](${bbox});way["landuse"~"^(forest|grass|meadow|recreation_ground)$"](${bbox});relation["landuse"~"^(forest|grass|meadow|recreation_ground)$"](${bbox});way["natural"~"^(wood|grassland|scrub)$"](${bbox});relation["natural"~"^(wood|grassland|scrub)$"](${bbox}););out geom;`;
    if (!greenInflight.has(bbox)) {
        const pending = (async () => {
            const errors = [];
            for (const server of greenServers) {
                const until = greenCooldown.get(server) || 0;
                if (until > Date.now()) {
                    errors.push(`${new URL(server).hostname}: 요청 제한 대기 중`);
                    continue;
                }
                try {
                    const response = await fetch(server, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
                        body: new URLSearchParams({ data: query }).toString(),
                        signal: AbortSignal.timeout(18000)
                    });
                    if (response.status === 429 || response.status === 503) {
                        const retrySeconds = Number(response.headers.get('retry-after'));
                        const waitMs = Number.isFinite(retrySeconds) && retrySeconds > 0
                            ? Math.min(retrySeconds * 1000, 3600000) : 300000;
                        greenCooldown.set(server, Date.now() + waitMs);
                        throw new Error(`HTTP ${response.status} (요청 제한)`);
                    }
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const data = await response.json();
                    if (!Array.isArray(data.elements)) throw new Error('잘못된 OSM 응답');
                    const result = { elements: data.elements, source: 'OpenStreetMap', bbox };
                    try {
                        fsGreen.mkdirSync(greenCacheDir, { recursive: true });
                        fsGreen.writeFileSync(cacheFile, JSON.stringify(result));
                    } catch (saveError) {
                        console.warn('[green-areas] 캐시 저장 실패:', saveError.message);
                    }
                    return result;
                } catch (error) {
                    errors.push(`${new URL(server).hostname}: ${error.message}`);
                }
            }
            throw Object.assign(new Error('OSM 녹지 경계 조회 실패'), { details: errors });
        })();
        greenInflight.set(bbox, pending);
        pending.finally(() => greenInflight.delete(bbox)).catch(() => {});
    }
    try {
        return res.json(await greenInflight.get(bbox));
    } catch (error) {
        console.error('[API /green-areas]', error.details);
        return res.status(503).json({ error: error.message, details: error.details, retryLater: true });
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

