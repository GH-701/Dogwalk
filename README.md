# 🐾 Green Path & 댕댕한바퀴 - 반려견 안심 산책 플랫폼

> **공공데이터(서울시 공원·한국문화정보원·식약처) 융합 큐레이션, 실시간 GPS 보행 기록 & 차도 회피 안전도 AI 평가 플랫폼**

---

## 📖 프로젝트 개요

**Green Path**는 도심 속 반려견과 보호자가 차도와 위험 요소를 피해 쾌적하고 안전하게 산책할 수 있도록 돕는 풀스택 웹 플랫폼입니다.

* **실시간 산책 트래커**: 스톱워치, 이동 거리(km), 보행 속도(km/h) 측정
* **4대 행동 마커**: 산책 중 식수(💧), 소변(🟡), 대변(🟤), 위험구간(⚠️) 위치를 지도에 실시간 마킹
* **공공데이터 3종 융합**: 서울시 133개 공원 둘레길, 문화정보원 동반 문화시설(7만건), 식약처 인증 안심 식당
* **차도 회피 안심 산책로 AI 평가**: 맨해튼 격자 도로망 & 서울 녹지 코리더(한강/청계천/양재천) 기반 안전도(100점) 산출
* **체급별 맞춤 필터**: 소형견 / 중형견 / 대형견 맞춤 보행로 폭 및 입장 제한 시설 실시간 분석
* **산책일지 영구 보관**: 브라우저 로컬스토리지 및 백엔드 REST API 이중 영구 보관

---

## 🛠️ 기술 스택 (Tech Stack)

### Frontend
* **Core**: HTML5, Vanilla JavaScript (ES6+ Modules)
* **Styling**: Vanilla CSS (CSS Custom Properties, Glassmorphism, Responsive Dark Mode)
* **GIS / Map**: OpenLayers 8.1.0, 국토교통부 브이월드(VWorld) 2D/위성/하이브리드 타일

### Backend
* **Runtime**: Node.js (v18+)
* **Framework**: Express.js 4.x
* **Security & Proxy**: Dotenv (환경변수 관리), CORS, RESTful API Proxy

---

## 📁 디렉토리 구조

```
프로젝트/
├── 📁 frontend/                   # 웹 프론트엔드 모듈
│   ├── 📄 index.html              # 메인 웹 페이지 마크업
│   ├── 📁 css/
│   │   └── 🎨 style.css           # 디자인 시스템 & 레이아웃 스타일시트
│   ├── 📁 js/
│   │   ├── 🧭 data-dict.js        # 서울 거점 좌표 사전 & 녹지 코리더 데이터
│   │   ├── 🗺️ map-service.js      # OpenLayers 지도, 브이월드 3종 레이어, 팝업 제어
│   │   ├── 🎯 gps-service.js      # Geolocation 실시간 GPS 위치 추적 & 데모 모드
│   │   ├── 🐕 walk-tracker.js    # 실시간 산책 트래커, 4대 액션 마커, 산책일지 연동
│   │   ├── 🌳 curation-service.js # 공공데이터 3종 로딩 & 공원 둘레길 선형 생성
│   │   ├── 🛡️ routing-service.js  # 도로명 지오코딩 & 차도 회피 안전도 AI 평가
│   │   └── 🚀 app.js              # 전역 상태, 탭 전환, 앱 초기화 엔트리
│   └── 📁 data/
│       └── 📊 seoul_parks.json    # 공원 오프라인 백업 데이터
│
├── 📁 backend/                    # 백엔드 API 프록시 & 영구 저장 서버
│   ├── 📄 server.js               # Express 서버 엔트리 & 정적 파일 호스팅
│   ├── 📄 package.json            # 백엔드 의존성 및 실행 스크립트
│   ├── 📄 .env                    # 실제 인증키 보관 (Git 제외 대상)
│   ├── 📄 .env.example            # 환경변수 템플릿
│   ├── 📁 routes/
│   │   ├── 📡 api.js              # 공공데이터 및 Nominatim 프록시 라우터
│   │   └── 💾 walks.js            # 산책 기록 저장/조회 REST API
│   └── 📁 data/
│       └── 📊 walks.json          # 산책일지 JSON 로컬 DB
│
├── 📄 package.json                # 루트 실행 스크립트
├── 📄 .gitignore                  # Git 추적 제외 목록 (.env, node_modules 등)
└── 📄 README.md                   # 프로젝트 전체 가이드
```

---

## 🚀 빠른 시작 (Getting Started)

### 1. 백엔드 포함 전체 풀스택 실행 (권장)

터미널(PowerShell 또는 Bash)에서 다음 명령어를 실행합니다:

```bash
# 1. 백엔드 패키지 설치 (최초 1회)
cd backend
npm install
cd ..

# 2. 서버 실행
npm start
```

서버가 구동되면 웹 브라우저에서 **`http://localhost:5000`** 으로 접속합니다.  
(프론트엔드 화면과 백엔드 API가 단일 포트로 자동 연결됩니다.)

---

### 2. 프론트엔드만 단독 실행할 경우 (초간단 모드)

백엔드 서버 없이도 모든 기능이 동작하도록 설계되어 있습니다.
* `frontend/index.html` 파일을 더블 클릭하여 브라우저에서 바로 열거나,
* VS Code의 **Live Server** 확장 프로그램을 사용하여 실행할 수 있습니다.
*(백엔드가 꺼져 있는 경우, 프론트엔드가 자동으로 클라이언트 직접 호출 및 로컬스토리지 모드로 자동 전환됩니다.)*

---

## 🔑 환경 변수 (.env) 설정

`backend/.env.example` 파일을 복사하여 `backend/.env`를 생성하고 본인의 API 키를 입력합니다:

```env
PORT=5000

PORT=5000

SEOUL_API_KEY=YOUR_SEOUL_API_KEY
PUBLIC_DATA_KEY=YOUR_PUBLIC_DATA_KEY
FOOD_SAFETY_KEY=YOUR_FOOD_SAFETY_KEY
---

## 📤 GitHub에 업로드(저장)하는 방법

터미널에서 아래 명령어로 GitHub에 업로드할 수 있습니다:

```bash
# 1. git 초기화 (아직 안 되어 있는 경우)
git init

# 2. 파일 추가 및 커밋
git add .
git commit -m "feat: Green Path & 댕댕한바퀴 풀스택(Frontend + Backend) 아키텍처 구축"

# 3. GitHub 원격 저장소 연결 (본인 레포지토리 주소 입력)
git branch -M main
git remote add origin <본인의_깃허브_레포지토리_URL>

# 4. 푸시
git push -u origin main
```
