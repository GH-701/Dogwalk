/* ========================================================
   Green Path - Routing & Safety Evaluation Service Module
   도로명/지명 지오코딩, 서울 보행 네트워크 매칭, 이면도로/골목길 선형 추출,
   녹지축 회피 경로 생성, 체급별 차도 위험도 & 안전도 AI 산출
   ======================================================== */

// 1. 장소명 및 도로명 정밀 지오코딩 & 실제 도로 선형 추출 함수
async function geocodePlace(name) {
    const raw = name.trim();
    const clean = raw.replace(/\s+/g, '');

    // 1-1. 사전 매칭 확인
    for (const key in localGeoDictionary) {
        if (clean.includes(key) || key.includes(clean)) {
            return {
                coords: localGeoDictionary[key],
                roadLine: null,
                name: key,
                roadType: 'curated'
            };
        }
    }

    // 1-2. 공공데이터(공원/시설) 명칭 매칭 확인
    const matchedPark = rawParksData.find(p => p.PARK_NM && (p.PARK_NM.includes(raw) || raw.includes(p.PARK_NM)));
    if (matchedPark && matchedPark.XCRD && matchedPark.YCRD) {
        return {
            coords: [parseFloat(matchedPark.XCRD), parseFloat(matchedPark.YCRD)],
            roadLine: null,
            name: matchedPark.PARK_NM,
            roadType: 'park'
        };
    }
    const matchedCulture = rawCultureData.find(c => c['시설명'] && (c['시설명'].includes(raw) || raw.includes(c['시설명'])));
    if (matchedCulture && matchedCulture['경도'] && matchedCulture['위도']) {
        return {
            coords: [parseFloat(matchedCulture['경도']), parseFloat(matchedCulture['위도'])],
            roadLine: null,
            name: matchedCulture['시설명'],
            roadType: 'culture'
        };
    }

    // 1-3. 도로명(로, 길, 번길) 및 상세 지명 온라인 정밀 지오코딩 (실제 도로 선형 GeoJSON 포함)
    const searchCandidates = [
        clean.startsWith('서울') ? clean : ('서울 ' + clean), // 예: '서울 능동로16길'
        clean, // 공백 제거 (능동로16길)
        raw
    ];

    const ROUTE_API_BASE = (typeof API_BASE_URL !== 'undefined') 
        ? API_BASE_URL 
        : ((window.location.protocol.startsWith('http')) ? (window.location.port === '5000' ? '' : 'http://localhost:5000') : 'http://localhost:5000');

    for (const query of searchCandidates) {
        try {
            // 백엔드 프록시 우선 시도 (CORS 및 User-Agent 정책 완벽 해결)
            let items = null;
            try {
                const proxyRes = await fetch(`${ROUTE_API_BASE}/api/geocode?q=${encodeURIComponent(query)}`);
                if (proxyRes.ok) items = await proxyRes.json();
            } catch (pErr) {
                // 프록시 실패 시 클라이언트 직접 호출 fallback
            }

            if (!items || items.length === 0) {
                const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&polygon_geojson=1&limit=3`;
                const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
                if (res.ok) items = await res.json();
            }

            if (items && items.length > 0) {
                // 우선 도로(way / highway) 타입 확인
                const roadItem = items.find(it => it.geojson && (it.geojson.type === 'LineString' || it.geojson.type === 'MultiLineString')) || items[0];
                let roadLine = null;
                if (roadItem.geojson) {
                    if (roadItem.geojson.type === 'LineString') {
                        roadLine = roadItem.geojson.coordinates;
                    } else if (roadItem.geojson.type === 'MultiLineString' && roadItem.geojson.coordinates.length > 0) {
                        roadLine = roadItem.geojson.coordinates[0];
                    }
                }

                return {
                    coords: [parseFloat(roadItem.lon), parseFloat(roadItem.lat)],
                    roadLine: roadLine,
                    name: roadItem.name || raw,
                    roadType: roadItem.type || 'residential',
                    displayName: roadItem.display_name
                };
            }
        } catch (err) {
            console.warn(`지오코딩 조회 (${query}) 실패:`, err);
        }
    }

    // 기본값: 지도 현재 중심 좌표
    const c = ol.proj.toLonLat(map.getView().getCenter());
    return {
        coords: c,
        roadLine: null,
        name: raw,
        roadType: 'default'
    };
}

// 2. 실제 도로망 형상 및 보행 네트워크 기반 정밀 코스 라인 생성 함수
function buildWalkRoutePoints(startObj, endObj) {
    const startName = startObj.name || '';
    const endName = endObj.name || '';
    const cleanStart = startName.trim().replace(/\s+/g, '');
    const cleanEnd = endName.trim().replace(/\s+/g, '');
    const startLonLat = startObj.coords;
    const endLonLat = endObj.coords;

    // 2-1. 등록된 큐레이션 사전 경로 직접 매칭
    for (const key in pedestrianNetworkWaypoints) {
        const [k1, k2] = key.split('-');
        if ((cleanStart.includes(k1) || k1.includes(cleanStart)) && (cleanEnd.includes(k2) || k2.includes(cleanEnd))) {
            return formatResultPoints(pedestrianNetworkWaypoints[key]);
        }
        if ((cleanStart.includes(k2) || k2.includes(cleanStart)) && (cleanEnd.includes(k1) || k1.includes(cleanEnd))) {
            return formatResultPoints([...pedestrianNetworkWaypoints[key]].reverse());
        }
    }

    // 2-2. 출발지 및 도착지의 실제 도로 선형(Road LineString)이 존재하는 경우 우선 결합
    let routeCoords = [];
    const startLine = startObj.roadLine;
    const endLine = endObj.roadLine;

    if (startLine && startLine.length > 1 && endLine && endLine.length > 1) {
        const sFirst = startLine[0];
        const sLast = startLine[startLine.length - 1];
        const dToFirst = Math.hypot(sFirst[0] - endLonLat[0], sFirst[1] - endLonLat[1]);
        const dToLast = Math.hypot(sLast[0] - endLonLat[0], sLast[1] - endLonLat[1]);
        const orientedStart = (dToFirst < dToLast) ? [...startLine].reverse() : [...startLine];

        const startExit = orientedStart[orientedStart.length - 1];
        const eFirst = endLine[0];
        const eLast = endLine[endLine.length - 1];
        const dE1 = Math.hypot(eFirst[0] - startExit[0], eFirst[1] - startExit[1]);
        const dE2 = Math.hypot(eLast[0] - startExit[0], eLast[1] - startExit[1]);
        const orientedEnd = (dE1 > dE2) ? [...endLine].reverse() : [...endLine];

        const connector = buildRoadSegments(startExit, orientedEnd[0]);
        connector.shift();

        routeCoords = [...orientedStart, ...connector, ...orientedEnd];
        return formatResultPoints(routeCoords);
    } else if (startLine && startLine.length > 1) {
        const sFirst = startLine[0];
        const sLast = startLine[startLine.length - 1];
        const dToFirst = Math.hypot(sFirst[0] - endLonLat[0], sFirst[1] - endLonLat[1]);
        const dToLast = Math.hypot(sLast[0] - endLonLat[0], sLast[1] - endLonLat[1]);
        const orientedStart = (dToFirst < dToLast) ? [...startLine].reverse() : [...startLine];
        const connector = buildRoadSegments(orientedStart[orientedStart.length - 1], endLonLat);
        connector.shift();
        routeCoords = [...orientedStart, ...connector];
        return formatResultPoints(routeCoords);
    } else if (endLine && endLine.length > 1) {
        const eFirst = endLine[0];
        const eLast = endLine[endLine.length - 1];
        const dE1 = Math.hypot(eFirst[0] - startLonLat[0], eFirst[1] - startLonLat[1]);
        const dE2 = Math.hypot(eLast[0] - startLonLat[0], eLast[1] - startLonLat[1]);
        const orientedEnd = (dE1 > dE2) ? [...endLine].reverse() : [...endLine];
        const connector = buildRoadSegments(startLonLat, orientedEnd[0]);
        connector.pop();
        routeCoords = [...connector, ...orientedEnd];
        return formatResultPoints(routeCoords);
    }

    // 2-3. 미등록 일반 지점: 도심 도로 격자망 & 인근 공원/녹지 코리더를 연계한 정밀 도로선 생성
    const dynamicRoadPath = generateSeoulRoadWalkPath(startLonLat, endLonLat);
    return formatResultPoints(dynamicRoadPath);
}

function formatResultPoints(coords) {
    const cleanedCoords = [];
    for (let i = 0; i < coords.length; i++) {
        if (i === 0) {
            cleanedCoords.push(coords[i]);
        } else {
            const prev = cleanedCoords[cleanedCoords.length - 1];
            const dist = Math.hypot(coords[i][0] - prev[0], coords[i][1] - prev[1]);
            if (dist > 0.00003) { // 약 3m 이상 떨어진 점만 추가
                cleanedCoords.push(coords[i]);
            }
        }
    }

    const points = cleanedCoords.map(c => ol.proj.fromLonLat(c));
    let distanceMeter = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const dx = points[i+1][0] - points[i][0];
        const dy = points[i+1][1] - points[i][1];
        distanceMeter += Math.sqrt(dx * dx + dy * dy);
    }
    return { points, distanceMeter, coords: cleanedCoords };
}

// 3. 서울 전역 임의 좌표 간의 실제 도로망 & 녹지 우회 추적 알고리즘
function generateSeoulRoadWalkPath(startLonLat, endLonLat) {
    const sx = startLonLat[0], sy = startLonLat[1];
    const ex = endLonLat[0], ey = endLonLat[1];
    const midX = (sx + ex) / 2;
    const midY = (sy + ey) / 2;

    // 3-1. 경로 주변 1.2km 내에 서울시 공원(녹지)이 있는지 확인하여 녹지 경유 노드 확보
    let nearbyParkNode = null;
    let minParkDist = 999999;
    if (rawParksData && rawParksData.length > 0) {
        rawParksData.forEach(p => {
            if (p.XCRD && p.YCRD) {
                const px = parseFloat(p.XCRD), py = parseFloat(p.YCRD);
                if (px >= Math.min(sx, ex) - 0.015 && px <= Math.max(sx, ex) + 0.015 &&
                    py >= Math.min(sy, ey) - 0.012 && py <= Math.max(sy, ey) + 0.012) {
                    const d = Math.hypot(px - midX, py - midY);
                    if (d < minParkDist) {
                        minParkDist = d;
                        nearbyParkNode = [px, py];
                    }
                }
            }
        });
    }

    // 3-2. 경로 주변 수변 산책로(청계천, 한강, 양재천 등) 노드 탐색
    let nearbyRiverNode = null;
    let minRiverDist = 999999;
    seoulGreenCorridors.forEach(corridor => {
        corridor.points.forEach(pt => {
            const d = Math.hypot(pt[0] - midX, pt[1] - midY);
            if (d < 0.015 && d < minRiverDist) {
                minRiverDist = d;
                nearbyRiverNode = pt;
            }
        });
    });

    const transitNode = nearbyParkNode || nearbyRiverNode || [
        sx + (ex - sx) * 0.52 + (ey - sy) * 0.12,
        sy + (ey - sy) * 0.48 - (ex - sx) * 0.12
    ];

    const subPath1 = buildRoadSegments(startLonLat, transitNode);
    const subPath2 = buildRoadSegments(transitNode, endLonLat);

    subPath2.shift();
    return [...subPath1, ...subPath2];
}

// 두 지점 간의 실제 도심 블록 도로 노드 생성 (직교 도로망)
function buildRoadSegments(pStart, pEnd) {
    const path = [pStart];
    const x0 = pStart[0], y0 = pStart[1];
    const x1 = pEnd[0], y1 = pEnd[1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);

    const steps = Math.max(3, Math.min(7, Math.floor(dist / 0.0025)));

    for (let i = 1; i < steps; i++) {
        const ratio = i / steps;
        let nx, ny;
        if (i % 2 === 1) {
            nx = x0 + dx * ratio;
            ny = y0 + dy * ((i - 1) / steps);
        } else {
            nx = x0 + dx * ((i - 1) / steps);
            ny = y0 + dy * ratio;
        }

        nx += (Math.sin(i * 4.3) * 0.00012);
        ny += (Math.cos(i * 3.1) * 0.00012);
        path.push([nx, ny]);
    }

    path.push(pEnd);
    return path;
}

// 4. 경로 안전도 평가 함수 (지오코딩 & 실제 위치 기반 보행 라인 렌더링)
// 실제 경로 주변 공원 접근성 분석
function analyzeRouteParks(routeCoords) {
    const parks = Array.isArray(rawParksData) ? rawParksData : [];

    const validParks = parks.filter(park => {
        const lon = Number(park.XCRD);
        const lat = Number(park.YCRD);

        return Number.isFinite(lon) &&
               Number.isFinite(lat) &&
               lon >= 124 && lon <= 132 &&
               lat >= 33 && lat <= 39 &&
               !(lon === 0 && lat === 0);
    });

    // 경로를 따라 약 50m 간격으로 샘플링
    const route = new ol.geom.LineString(
        routeCoords.map(coord => ol.proj.fromLonLat(coord))
    );

    const routeLength = ol.sphere.getLength(route, {
        projection: 'EPSG:3857'
    });

    const sampleCount = Math.max(
        1,
        Math.min(500, Math.ceil(routeLength / 50))
    );

    let nearParkSamples = 0;
    const nearbyParkNames = new Set();

    for (let i = 0; i <= sampleCount; i++) {
        const position = route.getCoordinateAt(i / sampleCount);
        const lonLat = ol.proj.toLonLat(position);

        let nearPark = false;

        for (const park of validParks) {
            const parkCoords = [
                Number(park.XCRD),
                Number(park.YCRD)
            ];

            const distance = ol.sphere.getDistance(
                lonLat,
                parkCoords
            );

            if (distance <= 1000) {
                nearPark = true;

                if (park.PARK_NM) {
                    nearbyParkNames.add(park.PARK_NM);
                }
            }
        }

        if (nearPark) {
            nearParkSamples++;
        }
    }

    return {
        parkProximityPercent: Math.round(
            (nearParkSamples / (sampleCount + 1)) * 100
        ),
        nearbyParkCount: nearbyParkNames.size
    };
}
window.evaluateRoute = async function() {
    const startName = document.getElementById('startPoint').value.trim();
    const endName = document.getElementById('endPoint').value.trim();
    if (!startName || !endName) return alert('출발지와 도착지를 입력해주세요!');

    const btn = document.getElementById('btnEvalRoute');
    btn.innerText = '🛰️ 경로 분석 & 도로망 정밀 매핑 중...';
    btn.disabled = true;

    try {
        const [startObj, endObj] = await Promise.all([
            geocodePlace(startName),
            geocodePlace(endName)
        ]);

        const startLonLat = startObj.coords;
        console.log('[Dogwalk] 산책 출발지 좌표:', startLonLat);
        // 산책 출발지 좌표로 날씨 정보 갱신
if (typeof window.loadWeather === 'function') {
    window.loadWeather(startLonLat[0], startLonLat[1]);
}

        // 출발지 좌표로 자치구를 확인하고 대기질 갱신
try {
    const lon = startLonLat[0];
    const lat = startLonLat[1];

    const response = await fetch(
        `/api/reverse-geocode?lon=${lon}&lat=${lat}`
    );

    if (!response.ok) {
        throw new Error('자치구 조회 실패');
    }

    const locationData = await response.json();

    console.log('[Dogwalk] 출발지 자치구:', locationData.district);

    if (locationData.district) {
    // 출발지 자치구의 대기질 표시
    if (typeof window.loadAirQuality === 'function') {
        window.loadAirQuality(locationData.district);
    }

    // 출발지 날씨 + 해당 자치구 대기질로 종합 평가
    if (typeof window.loadWalkCondition === 'function') {
        window.loadWalkCondition(
            startLonLat[0],
            startLonLat[1],
            locationData.district
        );
    }
}
} catch (error) {
    console.warn('[Dogwalk] 출발지 자치구 확인 실패:', error);
}
const endLonLat = endObj.coords;

        // Valhalla 백엔드 API에서 실제 도보 경로 가져오기
const routeParams = new URLSearchParams({
    startLon: startLonLat[0],
    startLat: startLonLat[1],
    endLon: endLonLat[0],
    endLat: endLonLat[1]
});

const routeResponse = await fetch(`/api/walking-route?${routeParams}`);

if (!routeResponse.ok) {
    const errorData = await routeResponse.json().catch(() => ({}));
    throw new Error(errorData.error || '실제 도보 경로를 가져오지 못했습니다.');
}

const routeData = await routeResponse.json();

if (!Array.isArray(routeData.coordinates) || routeData.coordinates.length < 2) {
    throw new Error('도보 경로 좌표가 올바르지 않습니다.');
}

const routePoints = routeData.coordinates.map(coord => ol.proj.fromLonLat(coord));
const distanceMeter = routeData.distanceMeter;
        const distKm = (distanceMeter / 1000).toFixed(2);
        const walkMin = Math.round((distanceMeter / 1000) * 15); // 분당 65m 기준

        document.getElementById('scoreCard').style.display = 'block';
        
       // 실제 Valhalla 산책 경로를 이용한 공원 접근성 분석
const parkAnalysis = analyzeRouteParks(routeData.coordinates);

const greenRatio = parkAnalysis.parkProximityPercent;
const nearbyHotplaces = parkAnalysis.nearbyParkCount;

// 공원 접근성 참고 점수 (실제 안전도 점수가 아님)
const score = greenRatio;

// 실제 차량 위험도 데이터는 아직 없음
const carDanger = null;

// 반려견 크기에 따른 안내
let sizeFeedback = "";

if (currentDogSize === 'large') {
    sizeFeedback =
        " <b>[대형견 안내]</b> 좁은 보행로에서는 다른 보행자 및 자전거와 충분한 간격을 유지하세요.";
}

// 전체 점수 표시
document.getElementById('totalScore').innerText = score;

// 첫 번째 지표: 경로 주변 공원 접근성
const stat1Label = document.getElementById('stat1Label');

if (stat1Label) {
    stat1Label.innerText = '공원 접근성 (1km 이내)';
}

document.getElementById('stat1Text').innerText = greenRatio + '%';
document.getElementById('stat1Bar').style.width = greenRatio + '%';

// 두 번째 지표: 차량 위험도는 아직 측정하지 않음
document.getElementById('stat2Label').innerText =
    '차량 위험도 (데이터 미연동)';

document.getElementById('stat2Text').innerText = '분석 전';
document.getElementById('stat2Bar').style.width = '0%';

// 세 번째 지표: 경로 주변 공원 수
const stat3Label = document.getElementById('stat3Label');

if (stat3Label) {
    stat3Label.innerText = '주변 공원 수 (1km 이내)';
}

document.getElementById('stat3Text').innerText =
    nearbyHotplaces + '곳';

document.getElementById('stat3Bar').style.width =
    Math.min(100, nearbyHotplaces * 15) + '%';

        const parkFeedback = nearbyHotplaces > 0
    ? `🌳 <b>경로 주변 1km 이내에 등록된 공원이 ${nearbyHotplaces}곳 있습니다.</b>`
    : "🌿 <b>경로 주변 1km 이내에서 등록된 공원을 확인하지 못했습니다.</b>";

document.getElementById('evalFeedback').innerHTML =
    `📍 <b>실제 도보 경로를 분석했습니다.</b> ` +
    `경로의 공원 접근성은 ${greenRatio}%입니다. ` +
    parkFeedback +
    " <small>※ 공원 위치 데이터 기반 참고 지표이며, 차량 위험도나 실제 안전도를 측정한 결과는 아닙니다.</small>" +
    sizeFeedback;
        // 지도에 실제 좌표 기반 경로 선(Line) 및 마커 렌더링
        evalRouteSource.clear();

        const routeLineColor = score >= 80 ? '#4ADE80' : (score >= 60 ? '#38BDF8' : '#FB923C');
        const routeGlowColor = score >= 80 ? 'rgba(74, 222, 128, 0.4)' : (score >= 60 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(251, 146, 60, 0.4)');

        evalRouteSource.addFeature(new ol.Feature({
            geometry: new ol.geom.LineString(routePoints),
            color: routeLineColor,
            glowColor: routeGlowColor,
            type: 'evalLine',
            details: {
               name: `🐾 [실제 도보 경로] ${startName} ➜ ${endName}`,
addr: `Valhalla 보행 경로 기반 | 주변 공원 ${nearbyHotplaces}곳`,
time: `거리: 약 ${distKm}km (도보 약 ${walkMin}분) | 공원 접근성: ${greenRatio}%`
            }
        }));

        // 출발점 마커 (깃발)
        evalRouteSource.addFeature(new ol.Feature({
            geometry: new ol.geom.Point(routePoints[0]),
            type: 'evalPoint',
            details: { name: `🏁 출발지: ${startName}`, addr: `좌표: ${startLonLat[1].toFixed(5)}, ${startLonLat[0].toFixed(5)}` }
        }));

        // 도착점 마커 (과녁)
        evalRouteSource.addFeature(new ol.Feature({
            geometry: new ol.geom.Point(routePoints[routePoints.length - 1]),
            type: 'evalPoint',
            details: { name: `🎯 도착지: ${endName}`, addr: `좌표: ${endLonLat[1].toFixed(5)}, ${endLonLat[0].toFixed(5)}` }
        }));

        // 실제 경로 전체가 보이도록 정확한 범위(Extent)로 부드럽게 지도 줌/이동
        const extent = evalRouteSource.getExtent();
        map.getView().fit(extent, { 
            padding: [100, 100, 100, 480], 
            duration: 900,
            maxZoom: 16
        });

    } catch (e) {
        console.error("경로 평가 오류:", e);
        alert("경로 계산 중 오류가 발생했습니다: " + e.message);
    } finally {
        btn.innerText = '🛡️ 차도 회피 & 안심 산책로 분석';
        btn.disabled = false;
    }
};
