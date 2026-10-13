const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const walksFilePath = path.join(dataDir, 'walks.json');

// 데이터 디렉토리 및 파일 초기화 보조 함수
function ensureDataFile() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(walksFilePath)) {
        fs.writeFileSync(walksFilePath, JSON.stringify([], null, 2), 'utf-8');
    }
}

function readWalks() {
    ensureDataFile();
    try {
        const content = fs.readFileSync(walksFilePath, 'utf-8');
        return JSON.parse(content || '[]');
    } catch (err) {
        console.error('walks.json 읽기 오류:', err);
        return [];
    }
}

function writeWalks(data) {
    ensureDataFile();
    fs.writeFileSync(walksFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

// 1. 산책 기록 목록 조회
router.get('/', (req, res) => {
    const list = readWalks();
    res.json({ success: true, count: list.length, data: list });
});

// 2. 신규 산책 기록 저장
router.post('/', (req, res) => {
    try {
        const { date, duration, distance, dogSize, stats, pathCoords } = req.body;
        const list = readWalks();

        const newRecord = {
            id: Date.now(),
            date: date || new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            duration: duration || '00:00:00',
            distance: distance || '0.00',
            dogSize: dogSize || 'small',
            stats: stats || { water: 0, pee: 0, poop: 0, danger: 0 },
            pathCoords: pathCoords || [],
            createdAt: new Date().toISOString()
        };

        list.unshift(newRecord);
        writeWalks(list);

        res.status(201).json({ success: true, message: '산책 기록이 서버에 저장되었습니다.', data: newRecord });
    } catch (err) {
        res.status(500).json({ success: false, error: '산책 기록 저장에 실패했습니다.', details: err.message });
    }
});

// 3. 전체 산책 기록 삭제
router.delete('/', (req, res) => {
    writeWalks([]);
    res.json({ success: true, message: '모든 산책 기록이 삭제되었습니다.' });
});

// 4. 특정 산책 기록 삭제
router.delete('/:id', (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    const list = readWalks();
    const filtered = list.filter(item => item.id !== targetId);
    writeWalks(filtered);
    res.json({ success: true, message: `기록 (ID: ${targetId})이 삭제되었습니다.` });
});

module.exports = router;
