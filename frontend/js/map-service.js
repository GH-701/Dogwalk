/* ========================================================
   Green Path - Map Service Module
   OpenLayers 8.x 지도 초기화, 브이월드(VWorld) 레이어,
   벡터 피처 레이어 스타일, 마커 팝업 오버레이
   ======================================================== */

// 1. 지도 팝업 오버레이 설정
const popupContainer = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const popupCloser = document.getElementById('popup-closer');

const overlay = new ol.Overlay({
    element: popupContainer,
    autoPan: { animation: { duration: 250 } }
});

popupCloser.onclick = () => { 
    overlay.setPosition(undefined); 
    return false; 
};

// 2. 브이월드(VWorld) 배경지도 레이어 3종 구성
const vworldBaseLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png',
        attributions: '© 국토교통부 브이월드(VWorld)'
    }),
    visible: false
});

const vworldSatLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://xdworld.vworld.kr/2d/Satellite/service/{z}/{x}/{y}.jpeg',
        attributions: '© 국토교통부 브이월드(VWorld) 위성지도'
    }),
    visible: true
});

const vworldHybridLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
        url: 'https://xdworld.vworld.kr/2d/Hybrid/service/{z}/{x}/{y}.png',
        attributions: '© 국토교통부 브이월드(VWorld)'
    }),
    visible: true
});

// 지도 종류 변경 함수
window.changeMapType = function(type) {
    document.querySelectorAll('.map-type-btn').forEach(btn => btn.classList.remove('active'));
    if (type === 'satellite') {
        document.getElementById('btnMapSat').classList.add('active');
        vworldSatLayer.setVisible(true);
        vworldHybridLayer.setVisible(false);
        vworldBaseLayer.setVisible(false);
    } else if (type === 'hybrid') {
        document.getElementById('btnMapHybrid').classList.add('active');
        vworldSatLayer.setVisible(true);
        vworldHybridLayer.setVisible(true);
        vworldBaseLayer.setVisible(false);
    } else {
        document.getElementById('btnMapBase').classList.add('active');
        vworldSatLayer.setVisible(false);
        vworldHybridLayer.setVisible(false);
        vworldBaseLayer.setVisible(true);
    }
};

// 3. 기능별 벡터 소스 인스턴스
const parkSource = new ol.source.Vector();
const cultureSource = new ol.source.Vector();
const foodSource = new ol.source.Vector();
const walkTrackSource = new ol.source.Vector();
const markerEventsSource = new ol.source.Vector();
const evalRouteSource = new ol.source.Vector();
const courseLineSource = new ol.source.Vector(); // 추천 코스 연결 산책 라인
const gpsLocationSource = new ol.source.Vector(); // 내 GPS 실시간 위치 마커 & 정확도 반경

// 4. OpenLayers 지도 메인 인스턴스 생성
const map = new ol.Map({
    target: 'map',
    overlays: [overlay],
    layers: [
        vworldBaseLayer,
        vworldSatLayer,
        vworldHybridLayer,
        // 추천 코스 라인 (반려견 친화 에메랄드/그린 네온 스트로크)
        new ol.layer.Vector({
            source: courseLineSource,
            style: (feature) => {
                const color = feature.get('color') || '#4ADE80';
                return [
                    new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(74, 222, 128, 0.35)', width: 10, lineCap: 'round' }) }),
                    new ol.style.Style({ stroke: new ol.style.Stroke({ color: color, width: 4, lineCap: 'round' }) })
                ];
            }
        }),
        // 평가 경로 라인 (안전도 색상별 글로우 선형 시각화)
        new ol.layer.Vector({
            source: evalRouteSource,
            style: (feature) => {
                const color = feature.get('color') || '#38BDF8';
                const glowColor = feature.get('glowColor') || 'rgba(56, 189, 248, 0.35)';
                return [
                    new ol.style.Style({ stroke: new ol.style.Stroke({ color: glowColor, width: 12, lineCap: 'round' }) }),
                    new ol.style.Style({ stroke: new ol.style.Stroke({ color: color, width: 5, lineDash: [10, 6], lineCap: 'round' }) })
                ];
            }
        }),
        // 산책 경로 실시간 트래킹 라인 (오렌지/골드 글로우)
        new ol.layer.Vector({
            source: walkTrackSource,
            style: [
                new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(252, 211, 77, 0.4)', width: 12, lineCap: 'round' }) }),
                new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#FCD34D', width: 4, lineCap: 'round' }) })
            ]
        }),
        // 4대 행동 마커 레이어 (이모지 마커)
        new ol.layer.Vector({
            source: markerEventsSource,
            style: (feature) => new ol.style.Style({
                text: new ol.style.Text({
                    text: feature.get('icon'),
                    font: '20px sans-serif',
                    offsetY: -5
                })
            })
        }),
        // 서울시 공원 레이어
        new ol.layer.Vector({
            source: parkSource,
            style: new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({ color: '#4ADE80' }),
                    stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 })
                })
            })
        }),
        // 문화정보원 동반시설 레이어
        new ol.layer.Vector({
            source: cultureSource,
            style: new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 6,
                    fill: new ol.style.Fill({ color: '#38BDF8' }),
                    stroke: new ol.style.Stroke({ color: '#ffffff', width: 1.5 })
                })
            })
        }),
        // 식약처 음식점 레이어
        new ol.layer.Vector({
            source: foodSource,
            style: new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 5,
                    fill: new ol.style.Fill({ color: '#FB923C' }),
                    stroke: new ol.style.Stroke({ color: '#ffffff', width: 1.5 })
                })
            })
        }),
        // 내 실시간 GPS 위치 레이어 (펄스 애니메이션 마커 효과)
        new ol.layer.Vector({
            source: gpsLocationSource,
            style: (feature) => {
                if (feature.get('type') === 'accuracy') {
                    return new ol.style.Style({
                        fill: new ol.style.Fill({ color: 'rgba(56, 189, 248, 0.15)' }),
                        stroke: new ol.style.Stroke({ color: 'rgba(56, 189, 248, 0.5)', width: 1 })
                    });
                }
                return [
                    new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 12,
                            fill: new ol.style.Fill({ color: 'rgba(56, 189, 248, 0.35)' })
                        })
                    }),
                    new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 7,
                            fill: new ol.style.Fill({ color: '#38BDF8' }),
                            stroke: new ol.style.Stroke({ color: '#ffffff', width: 2.5 })
                        })
                    })
                ];
            }
        })
    ],
    view: new ol.View({ 
        center: ol.proj.fromLonLat([126.9780, 37.5665]), 
        zoom: 13 
    })
});

// 5. 지도 마커 및 코스 라인 클릭 팝업 핸들러
map.on('singleclick', function (evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
    if (feature && feature.get('details')) {
        const item = feature.get('details');
        const type = feature.get('type');
        let info = '';

        if (type === 'park') {
            info = `🌳 <b>서울시 도시공원</b><br>반려견 동반 산책 코스`;
        } else if (type === 'courseTrail') {
            info = `🌿 <b>추천 산책로 코스</b><br>${item.trailDesc || '녹지 보행로'}<br>📏 거리: <b>${item.dist || '순환로'}</b>`;
        } else if (type === 'evalLine') {
            info = `🛣️ <b>안전도 평가 경로 (선형 안내)</b><br>${item.time || ''}<br>🟢 차도 분리 및 보행 네트워크 안전 추천`;
        } else if (type === 'evalPoint') {
            info = `📍 <b>경로 안내 포인트</b><br>${item.addr || ''}`;
        } else if (type === 'culture') {
            info = `🏷️ <b>${item.cat2 || '문화시설'}</b> | ${item.cat3 || ''}<br>🐾 입장크기: <b>${item.allowSize || '모두 가능'}</b>`;
        } else if (type === 'food') {
            info = `🍽️ <b>식약처 인증 음식점</b><br>업종: ${item.induty || '식품접객업'}`;
        } else if (type === 'walkMarker') {
            info = `📍 <b>산책 기록</b>: ${item.title}<br>시간: ${item.time}`;
        } else if (type === 'myLocation') {
            info = `🎯 <b>실시간 내 위치</b><br>${item.addr}<br>수신시각: ${item.time}`;
        }

        popupContent.innerHTML = `
            <div style="font-size:0.95rem; font-weight:700; margin-bottom:4px; color:#4ADE80;">${item.name || item.title}</div>
            <div style="font-size:0.78rem; color:#94A3B8; margin-bottom:6px;">${item.addr || ''}</div>
            <div style="font-size:0.75rem; background:rgba(255,255,255,0.06); padding:6px; border-radius:6px;">${info}</div>
        `;
        overlay.setPosition(evt.coordinate);
    } else {
        overlay.setPosition(undefined);
    }
});
