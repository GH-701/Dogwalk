/* ========================================================
   Green Path - GPS Service Module
   HTML5 Geolocation API 실시간 위치 추적 및 데모 모드 Fallback
   ======================================================== */

let gpsWatchId = null;
let myCurrentPosition = null; // [lon, lat]

window.findMyGPSLocation = function() {
    if (!navigator.geolocation) {
        alert('사용 중인 브라우저에서 GPS 위치 서비스를 지원하지 않습니다.');
        return;
    }

    const btn = document.getElementById('btnGpsTrack');
    const btnText = document.getElementById('gpsBtnText');

    if (gpsWatchId !== null) {
        // 이미 추적 중이면 끄기
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
        btn.classList.remove('tracking');
        btnText.innerText = '내 GPS 위치';
        return;
    }

    btnText.innerText = 'GPS 수신중...';

    // 즉시 1회 위치 요청 및 지속적 watchPosition 등록
    gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
            const lon = pos.coords.longitude;
            const lat = pos.coords.latitude;
            const accuracy = pos.coords.accuracy;
            myCurrentPosition = [lon, lat];

            const center3857 = ol.proj.fromLonLat([lon, lat]);

            // GPS 마커 갱신
            gpsLocationSource.clear();
            
            // 정확도 반경 원
            gpsLocationSource.addFeature(new ol.Feature({
                geometry: new ol.geom.Circle(center3857, accuracy || 30),
                type: 'accuracy'
            }));
            
            // 위치 점 마커
            gpsLocationSource.addFeature(new ol.Feature({
                geometry: new ol.geom.Point(center3857),
                type: 'myLocation',
                details: {
                    name: '📍 현재 내 위치',
                    addr: `정확도 ±${Math.round(accuracy)}m 이내`,
                    time: new Date().toLocaleTimeString('ko-KR')
                }
            }));

            btn.classList.add('tracking');
            btnText.innerText = '내 위치 추적중';

            // 지도를 내 위치 중심으로 부드럽게 이동
            map.getView().animate({ center: center3857, zoom: 16, duration: 700 });
        },
        (err) => {
            console.warn("GPS 수신 오류:", err.message);
            btnText.innerText = '내 GPS 위치';
            btn.classList.remove('tracking');
            if (err.code === 1) {
                alert('브라우저 위치 권한 허용이 필요합니다.\n주소창 좌측 사이트 설정에서 위치 권한을 허용해주세요.');
            } else {
                // 모의 GPS 서울시청/남산 데모 위치 지원
                alert(`GPS 신호를 받아오지 못했습니다 (${err.message}).\n서울 중심 기준 위치로 전환합니다.`);
                const demoCoords = [126.9780, 37.5665];
                const center3857 = ol.proj.fromLonLat(demoCoords);
                myCurrentPosition = demoCoords;
                gpsLocationSource.clear();
                gpsLocationSource.addFeature(new ol.Feature({
                    geometry: new ol.geom.Point(center3857),
                    type: 'myLocation',
                    details: { name: '📍 기준 위치 (데모 모드)', addr: '서울 시청 주변 보행로', time: '실시간' }
                }));
                map.getView().animate({ center: center3857, zoom: 16, duration: 600 });
            }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};
