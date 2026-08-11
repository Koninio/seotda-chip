const socket = io();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const hostScreen = document.getElementById('host-screen');
const guestScreen = document.getElementById('guest-screen');

let myId = null;
let isHost = false;

// 로그인
document.getElementById('btn-host').addEventListener('click', () => join(true));
document.getElementById('btn-guest').addEventListener('click', () => join(false));

function join(hostFlag) {
    const nickname = document.getElementById('nickname').value;
    if (!nickname) return alert('닉네임을 입력하세요!');
    isHost = hostFlag;
    socket.emit('join', { nickname, isHost });
}

socket.on('joined', (player) => {
    myId = player.id;
    loginScreen.classList.remove('active');
    
    if (isHost) {
        hostScreen.classList.add('active');
    } else {
        guestScreen.classList.add('active');
        document.getElementById('guest-greeting').innerText = `${player.nickname}님 환영합니다!`;
    }
});

// 호스트 컨트롤
document.getElementById('btn-recruit').addEventListener('click', () => {
    socket.emit('recruitPlayers');
});

document.getElementById('btn-start-bet').addEventListener('click', () => {
    socket.emit('startBetting');
});

// 게스트 참가 팝업 처리
socket.on('showParticipatePopup', (ante) => {
    if (!isHost) {
        document.getElementById('ante-amount').innerText = ante;
        document.getElementById('participate-modal').classList.remove('hidden');
    }
});

document.getElementById('btn-participate').addEventListener('click', () => {
    socket.emit('participate');
    document.getElementById('participate-modal').classList.add('hidden');
    document.getElementById('waiting-msg').innerText = "배팅이 시작되기를 기다리고 있습니다...";
});

// 팟 금액 업데이트
socket.on('updatePot', (pot) => {
    document.getElementById('host-pot').innerText = pot.toLocaleString();
    document.getElementById('guest-pot').innerText = pot.toLocaleString();
});

// 플레이어 목록 업데이트
socket.on('updatePlayers', (players) => {
    const hostList = document.getElementById('host-player-list');
    const guestList = document.getElementById('guest-player-list');
    
    hostList.innerHTML = '';
    guestList.innerHTML = '';

    players.forEach(p => {
        const status = p.folded ? '(다이)' : '';
        const text = `${p.nickname} ${status} - ${p.money.toLocaleString()} 칩`;
        
        // 게스트용 UI
        const liGuest = document.createElement('li');
        liGuest.innerText = text;
        guestList.appendChild(liGuest);

        // 호스트용 UI (승자 선택 버튼 포함)
        const liHost = document.createElement('li');
        liHost.innerText = text;
        
        const winBtn = document.createElement('button');
        winBtn.innerText = "승리";
        winBtn.style.padding = "5px 10px";
        winBtn.onclick = () => socket.emit('selectWinner', p.id);
        
        liHost.appendChild(winBtn);
        hostList.appendChild(liHost);
    });
});

// 게임 시작 및 턴 처리
socket.on('gameStarted', () => {
    if (!isHost) {
        document.getElementById('waiting-msg').classList.add('hidden');
    }
});

socket.on('nextTurn', ({ turnId }) => {
    if (isHost) return; // 호스트는 턴 UI가 필요 없음

    const bettingUi = document.getElementById('betting-ui');
    const waitingMsg = document.getElementById('waiting-msg');

    if (myId === turnId) {
        bettingUi.classList.remove('hidden');
        waitingMsg.classList.add('hidden');
    } else {
        bettingUi.classList.add('hidden');
        waitingMsg.classList.remove('hidden');
        waitingMsg.innerText = "다른 플레이어의 턴입니다...";
    }
});

// 배팅 액션 전송
function bet(action) {
    socket.emit('bet', action);
    document.getElementById('betting-ui').classList.add('hidden');
    document.getElementById('waiting-msg').classList.remove('hidden');
    document.getElementById('waiting-msg').innerText = "배팅을 완료했습니다. 대기 중...";
}

// 로그 및 라운드 종료
socket.on('actionLog', (msg) => {
    // 필요한 경우 토스트 알림 등으로 확장 가능
    console.log(msg);
});

socket.on('roundEnded', (winnerNickname) => {
    alert(`라운드 종료! 승자: ${winnerNickname}\n팟이 지급되었습니다.`);
    if (!isHost) {
        document.getElementById('waiting-msg').classList.remove('hidden');
        document.getElementById('waiting-msg').innerText = "다음 판을 기다리는 중입니다...";
        document.getElementById('betting-ui').classList.add('hidden');
    }
});
