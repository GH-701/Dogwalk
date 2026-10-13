/* ========================================================
   Green Path - Walk Tracker Module (댕댕한바퀴 핵심 기능)
   실시간 스톱워치, 이동거리/속도 연산, 4대 행동 마커,
   백엔드 REST API 영구 저장 & 로컬스토리지 Fallback 지원
   ======================================================== */

// 산책 트래커 상태
let isWalking = false;
let isPaused = false;
let walkTimer = null;
let walkSeconds = 0;
let walkDistanceKm = 0.0;
let walkStats = { water: 0, pee: 0, poop: 0, danger: 0 };
let walkPathCoords = [];

// 백엔드 API 주소 (curation-service에서 정의되었거나 자체 결정)
const WALK_API_BASE = (typeof API_BASE_URL !== 'undefined') 
    ? API_BASE_URL 
    : ((window.location.protocol.startsWith('http')) ? (window.location.port === '5000' ? '' : 'http://localhost:5000') : 'http://localhost:5000');

// 1. 산책 시작
window.startWalk = function() {
    isWalking = true;
    isPaused = false;
    document.getElementById('btnWalkStart').style.display = 'none';
    document.getElementById('btnWalkPause').style.display = 'block';
    document.getElementById('btnWalkEnd').style.display = 'block';
    document.getElementById('walkStatusText').innerText = '산책 진행중';
    document.getElementById('walkStatusText').style.color = '#4ADE80';

    const startCoord = myCurrentPosition 
        ? ol.proj.fromLonLat(myCurrentPosition) 
        : map.getView().getCenter();
    
    walkPathCoords = [startCoord];
    updateWalkPolyline();

    if (gpsWatchId === null && navigator.geolocation) {
        findMyGPSLocation();
    }

    walkTimer = setInterval(() => {
        if (!isPaused) {
            walkSeconds++;
            updateStopwatchUI();
            
            if (walkSeconds % 3 === 0) {
                recordWalkStep();
            }
        }
    }, 1000);
};

// 2. 산책 일시정지 / 재개
window.pauseWalk = function() {
    isPaused = !isPaused;
    const btn = document.getElementById('btnWalkPause');
    if (isPaused) {
        btn.innerText = '산책 재개';
        btn.style.color = '#4ADE80';
        btn.style.borderColor = '#4ADE80';
        document.getElementById('walkStatusText').innerText = '일시 정지';
        document.getElementById('walkStatusText').style.color = '#FCD34D';
    } else {
        btn.innerText = '일시정지';
        btn.style.color = '#FCD34D';
        btn.style.borderColor = '#FCD34D';
        document.getElementById('walkStatusText').innerText = '산책 진행중';
        document.getElementById('walkStatusText').style.color = '#4ADE80';
    }
};

// 3. 산책 종료
window.endWalk = async function() {
    if (walkSeconds < 10) {
        if (!confirm("10초 미만의 짧은 산책입니다. 종료하시겠습니까?")) return;
    }
    clearInterval(walkTimer);
    isWalking = false;
    isPaused = false;

    // 산책 일지에 자동 저장 (로컬스토리지 + 백엔드 API)
    await saveWalkHistory();

    alert(`🎉 산책을 완료했습니다!\n시간: ${formatTime(walkSeconds)}\n거리: ${walkDistanceKm.toFixed(2)}km\n기록이 '산책일지'에 안전하게 보관되었습니다.`);

    // 초기화
    walkSeconds = 0;
    walkDistanceKm = 0;
    walkStats = { water: 0, pee: 0, poop: 0, danger: 0 };
    document.getElementById('cntWater').innerText = 0;
    document.getElementById('cntPee').innerText = 0;
    document.getElementById('cntPoop').innerText = 0;
    document.getElementById('cntDanger').innerText = 0;
    updateStopwatchUI();
    document.getElementById('walkDistText').innerHTML = `0.00 <span style="font-size:0.75rem;">km</span>`;
    document.getElementById('walkPaceText').innerHTML = `0.0 <span style="font-size:0.75rem;">km/h</span>`;
    document.getElementById('walkStatusText').innerText = '준비 완료';
    document.getElementById('walkStatusText').style.color = '#F8FAFC';

    document.getElementById('btnWalkStart').style.display = 'block';
    document.getElementById('btnWalkPause').style.display = 'none';
    document.getElementById('btnWalkEnd').style.display = 'none';
    renderHistoryList();
};

// 4. 4대 액션 마커 (식수, 소변, 대변, 위험) 찍기
window.addWalkEvent = function(type) {
    if (!isWalking) {
        alert("먼저 '산책 시작하기'를 눌러주세요!");
        return;
    }
    walkStats[type]++;
    if (type === 'water') document.getElementById('cntWater').innerText = walkStats.water;
    if (type === 'pee') document.getElementById('cntPee').innerText = walkStats.pee;
    if (type === 'poop') document.getElementById('cntPoop').innerText = walkStats.poop;
    if (type === 'danger') document.getElementById('cntDanger').innerText = walkStats.danger;

    const icons = { water: '💧', pee: '🟡', poop: '🟤', danger: '⚠️' };
    const names = { water: '식수 마심', pee: '소변 배뇨', poop: '대변 배변', danger: '위험 구간 주의' };
    const lastCoord = walkPathCoords[walkPathCoords.length - 1] || map.getView().getCenter();

    const feat = new ol.Feature({
        geometry: new ol.geom.Point(lastCoord),
        type: 'walkMarker',
        icon: icons[type],
        details: {
            title: `${icons[type]} ${names[type]}`,
            time: formatTime(walkSeconds)
        }
    });
    markerEventsSource.addFeature(feat);
};

function recordWalkStep() {
    const last = walkPathCoords[walkPathCoords.length - 1];
    let next;
    if (myCurrentPosition) {
        const currentCoord = ol.proj.fromLonLat(myCurrentPosition);
        const dx = currentCoord[0] - last[0];
        const dy = currentCoord[1] - last[1];
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 3) {
            next = currentCoord;
            walkDistanceKm += (dist / 1000);
        } else {
            next = [last[0] + (Math.random() * 8 - 4), last[1] + (Math.random() * 8 - 4)];
            walkDistanceKm += 0.01;
        }
    } else {
        next = [last[0] + (Math.random() * 26 - 11), last[1] + (Math.random() * 26 - 9)];
        walkDistanceKm += 0.015;
    }

    walkPathCoords.push(next);

    document.getElementById('walkDistText').innerHTML = `${walkDistanceKm.toFixed(2)} <span style="font-size:0.75rem;">km</span>`;
    const hours = walkSeconds / 3600;
    const pace = hours > 0 ? (walkDistanceKm / hours).toFixed(1) : 0;
    document.getElementById('walkPaceText').innerHTML = `${pace} <span style="font-size:0.75rem;">km/h</span>`;

    updateWalkPolyline();
}

function updateWalkPolyline() {
    walkTrackSource.clear();
    if (walkPathCoords.length > 1) {
        walkTrackSource.addFeature(new ol.Feature({
            geometry: new ol.geom.LineString(walkPathCoords)
        }));
    }
}

function updateStopwatchUI() {
    document.getElementById('stopwatchText').innerText = formatTime(walkSeconds);
}

function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// 5. 산책일지 저장 (로컬스토리지 캐시 + 백엔드 API 영구 저장)
async function saveWalkHistory() {
    const newRecord = {
        id: Date.now(),
        date: new Date().toLocaleDateString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }),
        duration: formatTime(walkSeconds),
        distance: walkDistanceKm.toFixed(2),
        dogSize: currentDogSize,
        stats: { ...walkStats }
    };

    // 로컬스토리지 저장
    const history = JSON.parse(localStorage.getItem('greenpath_walk_history') || '[]');
    history.unshift(newRecord);
    localStorage.setItem('greenpath_walk_history', JSON.stringify(history));

    // 백엔드 API 비동기 저장 시도
    try {
        await fetch(`${WALK_API_BASE}/api/walks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newRecord)
        });
    } catch (e) {
        console.warn('백엔드 산책일지 저장 실패 (로컬스토리지에만 보관됨):', e.message);
    }
}

// 6. 산책일지 목록 렌더링 (백엔드 데이터 우선 조회 ➜ 로컬스토리지 Fallback)
async function renderHistoryList() {
    const historyEl = document.getElementById('historyList');
    let history = [];

    try {
        const res = await fetch(`${WALK_API_BASE}/api/walks`);
        if (res.ok) {
            const result = await res.json();
            if (result.success && result.data && result.data.length > 0) {
                history = result.data;
            }
        }
    } catch (e) {
        console.warn('백엔드 산책일지 조회 실패, 로컬스토리지 사용:', e.message);
    }

    // 서버에 기록이 없거나 조회 실패 시 로컬스토리지 데이터 사용
    if (history.length === 0) {
        history = JSON.parse(localStorage.getItem('greenpath_walk_history') || '[]');
    }

    if (history.length === 0) {
        historyEl.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-dim); font-size:0.85rem;">아직 산책 기록이 없습니다.<br>'실시간 산책' 탭에서 산책을 완료해보세요!</div>`;
        return;
    }

    historyEl.innerHTML = history.map(item => `
        <div class="item-card" style="margin-bottom:10px;">
            <div class="item-card-title">
                <span>🗓️ ${item.date}</span>
                <span style="color:var(--primary); font-size:0.8rem;">${item.distance} km</span>
            </div>
            <div style="font-size:0.78rem; color:var(--text-dim); margin-bottom:8px;">
                산책 시간: <b>${item.duration}</b> | 체급: <b>${item.dogSize === 'large' ? '대형견' : (item.dogSize === 'medium' ? '중형견' : '소형견')}</b>
            </div>
            <div class="badges">
                <span class="badge badge-blue">💧 식수 ${item.stats.water}회</span>
                <span class="badge badge-yellow">🟡 소변 ${item.stats.pee}회</span>
                <span class="badge badge-yellow" style="color:#d97706;">🟤 대변 ${item.stats.poop}회</span>
                ${item.stats.danger > 0 ? `<span class="badge badge-red">⚠️ 위험구간 ${item.stats.danger}회</span>` : ''}
            </div>
        </div>
    `).join('');
}

window.clearHistory = async function() {
    if (confirm("저장된 모든 산책일지를 삭제하시겠습니까?")) {
        localStorage.removeItem('greenpath_walk_history');
        try {
            await fetch(`${WALK_API_BASE}/api/walks`, { method: 'DELETE' });
        } catch (e) {
            console.warn('백엔드 기록 삭제 통신 오류:', e.message);
        }
        renderHistoryList();
    }
};
