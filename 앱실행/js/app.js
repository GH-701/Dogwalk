/* ========================================================
   Green Path - Main Application Entry (App.js)
   전역 상태 초기화, 탭 내비게이션 제어, 체급 필터 이벤트 바인딩,
   경로 프리셋 버튼 이벤트, 앱 라이프사이클 구동
   ======================================================== */

// 전역 상태: 현재 선택된 반려견 체급 (small, medium, large)
let currentDogSize = 'small';

// 1. 탭 전환 이벤트 핸들러
window.switchTab = function(tabId) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    } else {
        const foundTab = Array.from(document.querySelectorAll('.nav-tab')).find(t => t.getAttribute('onclick')?.includes(tabId));
        if (foundTab) foundTab.classList.add('active');
    }

    const targetContent = document.getElementById(tabId);
    if (targetContent) targetContent.classList.add('active');

    if (tabId === 'tab-history') {
        renderHistoryList();
    }
};

// 2. 원클릭 산책로 프리셋 설정 함수
window.setRoutePreset = function(start, end) {
    document.getElementById('startPoint').value = start;
    document.getElementById('endPoint').value = end;
    evaluateRoute();
};

// 3. 앱 초기화 및 이벤트 리스너 바인딩
document.addEventListener('DOMContentLoaded', () => {
    // 체급 필터 버튼 클릭 리스너 바인딩
    document.querySelectorAll('#dogSizeGroup .size-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#dogSizeGroup .size-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentDogSize = e.target.getAttribute('data-size');
            
            const lbl = document.getElementById('petSizeLabel');
            if (currentDogSize === 'small') {
                lbl.innerText = '소형견(10kg 미만) 맞춤 분석';
            } else if (currentDogSize === 'medium') {
                lbl.innerText = '중형견(10~25kg) 맞춤 필터';
            } else {
                lbl.innerText = '대형견(25kg 이상) 광폭 보행로 우선';
            }

            renderCurationList();
        });
    });

    // 지도 기본 모드: 브이월드 위성+하이브리드 모드로 시작
    changeMapType('hybrid');

    // 공공데이터 비동기 로딩 시작
    loadPublicData();

    // 저장된 산책 기록 목록 렌더링
    renderHistoryList();

    console.log("Green Path & 댕댕한바퀴 웹 애플리케이션 초기화 완료");
});
