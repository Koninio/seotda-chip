const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let players = [];
let hostId = null;
let gameState = 'waiting'; // waiting, participating, playing
let pot = 0;
let currentMaxBet = 0;
const BASE_ANTE = 10000; // 기본금 1만 칩
let roundPlayers = [];
let turnIndex = 0;

io.on('connection', (socket) => {
    
    // 유저 접속
    socket.on('join', ({ nickname, isHost }) => {
        const player = {
            id: socket.id,
            nickname: nickname,
            money: 10000000, // 천만 칩 시작
            isHost: isHost,
            folded: false,
            currentBet: 0
        };
        
        players.push(player);
        if (isHost) hostId = socket.id;

        io.emit('updatePlayers', players);
        socket.emit('joined', player);
    });

    // 호스트가 참가 모집 시작 (팝업 띄우기)
    socket.on('recruitPlayers', () => {
        if (socket.id === hostId) {
            gameState = 'participating';
            roundPlayers = [];
            pot = 0;
            currentMaxBet = BASE_ANTE;
            io.emit('showParticipatePopup', BASE_ANTE);
        }
    });

    // 게스트가 참가 버튼 클릭 (기본금 지불)
    socket.on('participate', () => {
        const p = players.find(p => p.id === socket.id);
        if (p && gameState === 'participating') {
            p.money -= BASE_ANTE;
            p.currentBet = BASE_ANTE;
            pot += BASE_ANTE;
            p.folded = false;
            roundPlayers.push(p);
            
            io.emit('updatePlayers', players);
            io.emit('updatePot', pot);
        }
    });

    // 호스트가 배팅 턴 시작
    socket.on('startBetting', () => {
        if (socket.id === hostId && roundPlayers.length > 0) {
            gameState = 'playing';
            turnIndex = 0;
            io.emit('gameStarted');
            sendTurn();
        }
    });

    // 배팅 액션 처리 (삥, 하프, 콜, 따당, 다이)
    socket.on('bet', (action) => {
        const p = roundPlayers[turnIndex];
        if (!p || p.id !== socket.id) return;

        let amountToPay = 0;
        let callAmount = currentMaxBet - p.currentBet;

        if (action === 'die') {
            p.folded = true;
        } else if (action === 'call') {
            amountToPay = callAmount;
        } else if (action === 'bbing') {
            amountToPay = BASE_ANTE;
            currentMaxBet += BASE_ANTE;
        } else if (action === 'ddadang') {
            amountToPay = callAmount + currentMaxBet;
            currentMaxBet += currentMaxBet;
        } else if (action === 'half') {
            let halfPot = Math.floor((pot + callAmount) / 2);
            amountToPay = callAmount + halfPot;
            currentMaxBet += halfPot;
        }

        if (action !== 'die') {
            p.money -= amountToPay;
            p.currentBet += amountToPay;
            pot += amountToPay;
        }

        io.emit('updatePlayers', players);
        io.emit('updatePot', pot);
        io.emit('actionLog', `${p.nickname}님이 [${action.toUpperCase()}] 하셨습니다.`);

        // 생존자가 1명인지 확인
        const survivors = roundPlayers.filter(rp => !rp.folded);
        if (survivors.length === 1) {
            endRound(survivors[0]);
            return;
        }

        // 다음 턴 찾기 (다이한 사람 건너뛰기)
        do {
            turnIndex = (turnIndex + 1) % roundPlayers.length;
        } while (roundPlayers[turnIndex].folded);

        sendTurn();
    });

    // 승자 강제 선택 (카드를 까고 방장이 이긴 사람을 눌렀을 때)
    socket.on('selectWinner', (winnerId) => {
        if (socket.id !== hostId) return;
        const winner = players.find(p => p.id === winnerId);
        if (winner) {
            endRound(winner);
        }
    });

    function sendTurn() {
        io.emit('nextTurn', { 
            turnId: roundPlayers[turnIndex].id, 
            pot: pot, 
            currentMaxBet: currentMaxBet 
        });
    }

    function endRound(winner) {
        winner.money += pot;
        pot = 0;
        gameState = 'waiting';
        roundPlayers.forEach(p => p.currentBet = 0);
        
        io.emit('roundEnded', winner.nickname);
        io.emit('updatePlayers', players);
        io.emit('updatePot', pot);
    }

    // 접속 해제 처리
    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        if (socket.id === hostId) hostId = null;
        io.emit('updatePlayers', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`섯다 칩 서버가 포트 ${PORT}에서 실행 중입니다.`);
});
