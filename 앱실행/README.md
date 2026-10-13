# 🐾 Green Path & 댕댕한바퀴 - Frontend 아키텍처 가이드

본 프로젝트는 반려견 안심 산책, 실시간 GPS 트래킹 및 보행 행동 기록, 공공데이터(서울시 공원·한국문화정보원·식약처) 융합 큐레이션, 차도 회피 안전도 AI 평가 알고리즘을 제공하는 웹 프론트엔드 애플리케이션입니다.

기존 1,600여 라인의 단일 `index.html` 파일을 프론트엔드 표준 아키텍처에 맞춰 **구조화(HTML / CSS / JavaScript Modules)** 하였습니다.

---

## 📁 디렉토리 및 파일 구조

```
frontend/ (또는 앱실행/)
├── 📄 index.html                  # 시맨틱 마크업 및 모듈 로더
├── 📁 css/
│   └── 🎨 style.css               # 디자인 시스템, 다크 모드, 사이드바/트래커/지도 UI 스타일
├── 📁 js/
│   ├── 🧭 data-dict.js            # 서울 핫플레이스 사전, 보행축 웨이포인트, 녹지 코리더 데이터
│   ├── 🗺️ map-service.js          # OpenLayers 지도 초기화, 브이월드(VWorld) 레이어 3종, 팝업 제어
│   ├── 🎯 gps-service.js          # HTML5 Geolocation 실시간 위치 추적 & 모의 GPS fallback
│   ├── 🐕 walk-tracker.js        # 실시간 스톱워치, 이동거리/페이스, 4대 액션 마커, 산책일지(LocalStorage)
│   ├── 🌳 curation-service.js     # 공공데이터 3종 실시간 로딩, 공원 둘레길 선형 생성, 체급별 필터링
│   ├── 🛡️ routing-service.js      # 도로명/지명 지오코딩, 격자 도로망/녹지축 회피 경로 분석, 안전도 AI 점수 산출
│   └── 🚀 app.js                  # 전역 상태(체급), 탭 전환, 프리셋 이벤트, 앱 라이프사이클 구동
└── 📁 data/
    └── 📊 seoul_parks.json        # 서울시 공원 오프라인 백업 데이터
```

---

## 🧩 모듈별 세부 역할

### 1. `css/style.css`
- **Design Tokens**: `--primary: #4ADE80`, `--bg-dark: #0a0f1d`, `--panel-bg: rgba(15,23,42,0.9)` 등 HSL/RGB 기반 현대적 다크 테마 팔레트.
- **Glassmorphism**: 사이드바 및 컨트롤러의 블러(`backdrop-filter: blur(20px)`) 효과.
- **Micro-interactions**: 버튼 호버/액티브 애니메이션, 타이머 네온 글로우 텍스트 섀도우.

### 2. `js/data-dict.js`
- `localGeoDictionary`: 마포, 도심(종로/용산), 여의도, 성수, 강남/잠실 등 서울 주요 거점 정밀 좌표 사전.
- `pedestrianNetworkWaypoints`: 마포구청역-홍대입구역, 서울숲-뚝섬 등 실제 보행 전용 노드.
- `seoulGreenCorridors`: 청계천, 한강 북/남단, 양재천, 중랑천, 안양천, 경의선숲길 등 녹지·수변 보행 코리더 노드.

### 3. `js/map-service.js`
- 국토교통부 **브이월드(VWorld)** 위성지도(`Satellite`), 하이브리드(`Hybrid`), 일반 2D(`Base`) 동적 전환.
- 8개 오픈레이어스 벡터 레이어 및 맞춤형 네온/글로우 스타일 매핑.
- 오버레이 팝업 시스템 (피처 타입별 맞춤형 상세 정보 제공).

### 4. `js/gps-service.js`
- `navigator.geolocation.watchPosition`을 이용한 실시간 위치 수신 및 정확도 반경 원 시각화.
- 브라우저 위치 권한 미허용 또는 PC 환경 대비 서울 중심(시청) 데모 모드 자동 전환.

### 5. `js/walk-tracker.js` (댕댕한바퀴 핵심 기능)
- 산책 스톱워치(초/분/시), 이동 거리(km) 및 실시간 보행 페이스(km/h) 측정.
- **4대 액션 마커**: 💧 식수 마심, 🟡 소변, 🟤 대변, ⚠️ 위험 구간을 지도상 현재 위치에 즉시 핀 등록.
- **산책일지**: 별도 회원가입 없이 브라우저 `localStorage`에 자동 저장 및 히스토리 카드 렌더링.

### 6. `js/curation-service.js`
- 공공데이터포털/서울시/식약처 API 비동기 실시간 페칭.
- 단순 지점이 아닌 **공원 둘레길 순환 보행로(Polyline)** 선형 자동 생성.
- 소형견 / 중형견 / 대형견 체급별 동반 허용 시설 실시간 필터링.

### 7. `js/routing-service.js`
- 출발지/도착지 정밀 지오코딩 (로컬 사전 + Nominatim OpenStreetMap 실제 도로 선형 GeoJSON 추출).
- 도심 격자망(Manhattan Grid) 분할 알고리즘을 통한 도로 이탈 방지.
- 녹지율, 차도 위험도, 주변 편의시설 연계성을 반영한 **100점 만점 안전도 AI 산출**.

### 8. `js/app.js`
- 앱 초기화 및 이벤트 리스너 통합 바인딩.
- 서울 권역별 원클릭 산책로 프리셋 제공.

---

## 🚀 실행 방법

### 방법 1. 브라우저에서 바로 열기 (가장 간편한 방법)
- [index.html](file:///c:/Users/user/Desktop/프로젝트/frontend/index.html) 또는 [앱실행/index.html](file:///c:/Users/user/Desktop/프로젝트/앱실행/index.html)을 더블 클릭하여 크롬/엣지 브라우저에서 바로 실행합니다.
- 외부 의존성(OpenLayers, 폰트)은 CDN으로 자동 로드되며, 로컬 모듈도 즉시 작동합니다.

### 방법 2. 로컬 웹 서버로 실행 (VS Code Live Server 등)
- VS Code 또는 터미널에서 로컬 서버 실행:
  ```bash
  # Python 내장 서버 예시
  cd frontend
  python -m http.server 8080
  ```
  브라우저에서 `http://localhost:8080` 접속.
