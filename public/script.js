// ==========================================
// 1. การเชื่อมต่อเซิร์ฟเวอร์ (Multiplayer)
// ==========================================
// ถ้าเปิดไฟล์ index.html ตรงๆ ให้ลองต่อเซิร์ฟเวอร์ที่ localhost:3000
const SERVER_URL = window.SERVER_URL || undefined;
const socket = window.io
    ? io(SERVER_URL)
    : { connected: false, id: null, on() {}, emit() { showOffline(true); } };  // โหลดตัวเชื่อมต่อไม่ได้ = ไม่มีเซิร์ฟเวอร์

let myId = null;
let rooms = [];          // รายชื่อห้องจากเซิร์ฟเวอร์
let currentRoom = null;  // สถานะห้องที่เราอยู่ (จากเซิร์ฟเวอร์)
let lastPhaseKey = "";
let createSize = 3;

const TURN_SECONDS = 5;
const avatars = ['👻', '🧛', '🧟', '💀', '🎃'];

const cardsData = {
    "Ouija": { id: "Ouija", name: "👁️ ดวงตาผีสาง", tier: "normal" },
    "Incense": { id: "Incense", name: "🔥 ธูปบูชา", tier: "normal" },
    "Soul": { id: "Soul", name: "🌑 เศษเสี้ยววิญญาณ", tier: "normal" },
    "Blood": { id: "Blood", name: "🩸 เลือดศักดิ์สิทธิ์", tier: "rare" },
    "Chains": { id: "Chains", name: "⛓️ โซ่ตรวนยมโลก", tier: "rare" },
    "Stake": { id: "Stake", name: "🗡️ ลิ่มเงิน", tier: "rare" }
};

const ui = {
    letter: document.getElementById("target-letter"),
    time: document.getElementById("time"),
    input: document.getElementById("word-input"),
    message: document.getElementById("message-box"),
    startBtn: document.getElementById("start-btn"),
    targets: document.getElementById("target-selection"),
    crossStatus: document.getElementById("cross-status"),
    myCards: document.getElementById("my-cards-container"),
    timerFill: document.getElementById("timer-fill"),
    board: document.getElementById("game-board-screen"),
    revolver: document.getElementById("revolver"),
    cylinder: document.getElementById("cylinder"),
    banner: document.getElementById("shot-banner"),
    flash: document.getElementById("flash")
};

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

socket.on('connect', () => { myId = socket.id; showOffline(false); });
socket.on('connect_error', () => showOffline(true));

socket.on('disconnect', () => {
    showOffline(true);
    currentRoom = null;
    showScreen('main-menu-screen');
});

// ป้ายเตือนตอนยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์
function showOffline(show) {
    document.getElementById('offline-banner').classList.toggle('hidden', !show);
}
if (!window.io) window.addEventListener('DOMContentLoaded', () => showOffline(true));

socket.on('errorMsg', msg => alert(msg));

socket.on('roomList', list => {
    rooms = list;
    if (!document.getElementById('join-room-screen').classList.contains('hidden')) renderRooms(false);
});

socket.on('roomState', state => {
    currentRoom = state;
    if (state.status === 'waiting') {
        renderLobby(state);
        showScreen('lobby-screen');
    } else {
        renderGame(state);
        showScreen('game-board-screen');
    }
});

socket.on('gameStarted', () => {
    document.getElementById('log-content').innerHTML = "";
    lastPhaseKey = "";
});
socket.on('log', html => addLog(html));
socket.on('tick', t => { ui.time.innerText = t; ui.timerFill.style.width = `${t / TURN_SECONDS * 100}%`; if (t <= 2) Sound.tick(); });
socket.on('privateMsg', text => { ui.message.innerText = text; });
socket.on('typing', text => { if (!isMyTurn()) ui.input.value = text; });

// ผู้ยิงเล็งเป้า -> หมุนโม่ลุ้น
socket.on('aim', ({ targetId }) => {
    const el = slotElementOf(targetId);
    if (el) el.classList.add('aimed');
    ui.revolver.classList.remove('spinning');
    void ui.revolver.offsetWidth; // รีสตาร์ทแอนิเมชัน
    ui.revolver.classList.add('spinning');
    Sound.spin();
});

// เฉลยผล -> BANG! หรือ คลิก
socket.on('shotResult', ({ targetId, real }) => {
    document.querySelectorAll('.player.aimed').forEach(el => el.classList.remove('aimed'));
    ui.revolver.classList.remove('spinning');
    const el = slotElementOf(targetId);
    if (real) {
        Sound.bang();
        showBanner('BANG!', 'bang');
        restartAnim(ui.flash, 'bang');
        restartAnim(ui.board, 'shake');
        if (el) restartAnim(el, 'hit');
    } else {
        Sound.click();
        showBanner('*click*', 'click');
    }
});

// ==========================================
// 2. ระบบจัดการหน้าจอและห้อง (Room System)
// ==========================================
function showScreen(screenId) {
    document.getElementById('main-menu-screen').classList.add('hidden');
    document.getElementById('join-room-screen').classList.add('hidden');
    document.getElementById('create-room-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-board-screen').classList.add('hidden');
    document.getElementById(screenId).classList.remove('hidden');
}

function renderRooms(refresh = true) {
    if (refresh) socket.emit('listRooms');
    const grid = document.getElementById('room-grid');
    grid.innerHTML = '';

    if (rooms.length === 0) {
        grid.innerHTML = socket.connected
            ? `<div class="room-empty">ยังไม่มีห้องเปิดอยู่<br><button onclick="showScreen('create-room-screen')">+ สร้างห้องใหม่</button></div>`
            : `<div class="room-empty">ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ เลยโหลดรายชื่อห้องไม่ได้</div>`;
        return;
    }

    rooms.forEach(room => {
        let skullHTML = '';
        for (let i = 0; i < room.current; i++) skullHTML += '💀';
        if (room.current < room.max) {
            skullHTML += `<span class="skull-missing">`;
            for (let i = room.current; i < room.max; i++) skullHTML += '💀';
            skullHTML += `</span>`;
        }

        const canJoin = !room.playing && room.current < room.max;
        let statusClass = canJoin ? 'green' : 'red';
        let clickableClass = canJoin ? 'clickable' : '';
        let onclickAction = canJoin ? `onclick="joinRoom('${room.id}')"` : '';

        grid.innerHTML += `
            <div class="room-card ${clickableClass}" ${onclickAction}>
                <div class="room-fraction">${room.max}/${room.current}</div>
                <div class="room-info">
                    <div class="room-name">${escapeHtml(room.name)}</div>
                    <div class="room-skulls">${skullHTML}</div>
                </div>
                <div class="status-light ${statusClass}"></div>
                ${canJoin ? `<button class="join-btn">JOIN</button>` : `<span class="join-full">${room.playing ? 'กำลังเล่น' : 'เต็ม'}</span>`}
            </div>
        `;
    });
}

function getPlayerName(inputId) {
    const name = document.getElementById(inputId).value.trim();
    if (name) localStorage.setItem('ghostPlayerName', name);
    return name;
}

// เติมชื่อที่เคยใช้ไว้ให้อัตโนมัติ
['join-player-name', 'create-player-name'].forEach(id => {
    document.getElementById(id).value = localStorage.getItem('ghostPlayerName') || '';
});

function selectRoomSize(size) {
    createSize = size;
    document.getElementById('btn-size-3').classList.remove('selected');
    document.getElementById('btn-size-5').classList.remove('selected');
    document.getElementById(`btn-size-${size}`).classList.add('selected');
}

function createNewRoom() {
    let nameInput = document.getElementById('new-room-name').value.trim();
    if (nameInput === "") nameInput = "MY ROOM";
    socket.emit('createRoom', { roomName: nameInput, playerName: getPlayerName('create-player-name'), max: createSize });
    document.getElementById('new-room-name').value = "";
}

function joinRoom(roomId) {
    socket.emit('joinRoom', { roomId, playerName: getPlayerName('join-player-name') });
}

function leaveRoom() {
    socket.emit('leaveRoom');
    currentRoom = null;
    showScreen('main-menu-screen');
}

function hostStartGame() {
    socket.emit('startGame');
}

// ==========================================
// 3. ห้องรอผู้เล่น (Lobby)
// ==========================================
function renderLobby(state) {
    const isHost = state.hostId === myId;
    document.getElementById('lobby-room-name').innerText = state.name;
    document.getElementById('lobby-count').innerText = `ผู้เล่น ${state.players.length}/${state.max}`;

    const list = document.getElementById('lobby-players');
    list.innerHTML = '';
    state.players.forEach(p => {
        const row = document.createElement('div');
        row.className = 'lobby-player';
        row.innerText = `💀 ${p.name}${p.id === state.hostId ? ' 👑' : ''}${p.id === myId ? ' (คุณ)' : ''}`;
        list.appendChild(row);
    });
    for (let i = state.players.length; i < state.max; i++) {
        const row = document.createElement('div');
        row.className = 'lobby-player empty';
        row.innerText = 'รอผู้เล่น...';
        list.appendChild(row);
    }

    const startBtn = document.getElementById('lobby-start-btn');
    startBtn.style.display = isHost ? 'inline-block' : 'none';
    startBtn.disabled = state.players.length < 2;
    document.getElementById('lobby-status').innerText = isHost
        ? (state.players.length < 2 ? 'รอเพื่อนเข้าห้องอย่างน้อย 1 คน' : (state.players.length < state.max ? 'กด START GAME ได้เลย (หรือรอให้ห้องเต็ม)' : 'ห้องเต็มแล้ว! กด START GAME ได้เลย'))
        : 'รอหัวห้อง 👑 กดเริ่มเกม...';
}

// ==========================================
// 4. กระดานเกม (แสดงผลตามสถานะจากเซิร์ฟเวอร์)
// ==========================================
function addLog(htmlStr) {
    const logBox = document.getElementById('log-content');
    const entry = document.createElement('div');
    entry.innerHTML = htmlStr;
    entry.querySelectorAll('[data-pid]').forEach(el => {
        if (el.dataset.pid === myId) { el.className = 'log-p-0'; el.textContent = 'YOU'; }
    });
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
}

function isMyTurn() {
    return !!(currentRoom && currentRoom.game && currentRoom.game.turnId === myId);
}

function renderGame(state) {
    const g = state.game;
    const players = state.players;
    const n = players.length;
    const myIndex = Math.max(0, players.findIndex(p => p.id === myId));
    const myTurn = g.turnId === myId;

    // ตัวเราอยู่ช่อง player-0 เสมอ คนอื่นเรียงตามลำดับเทิร์นถัดจากเรา
    document.getElementById('game-board-screen').className = `game-board layout-${n <= 3 ? 3 : 5}`;
    for (let slot = 0; slot <= 4; slot++) {
        const el = document.getElementById(`player-${slot}`);
        if (slot >= n) { el.classList.add('hidden'); delete el.dataset.pid; continue; }
        el.classList.remove('hidden');

        const p = players[(myIndex + slot) % n];
        el.querySelector('.name').innerText = slot === 0
            ? `${p.name} (คุณ)`
            : p.name + (p.connected ? '' : ' (ออกแล้ว)');
        el.querySelector('.avatar').innerText = avatars[players.indexOf(p) % avatars.length];
        el.dataset.pid = p.id;
        document.getElementById(`hp-${slot}`).innerHTML = p.hp > 0 ? '<span class="hp-pip"></span>'.repeat(p.hp) : "💀 ตาย";
        el.classList.toggle('dead-player', p.hp <= 0);
        el.classList.toggle('current-turn', p.id === g.turnId && g.phase !== 'over');

        if (slot > 0) {
            el.querySelector('.cards-hidden').innerText = p.cardCount === 0 ? "ไม่มีการ์ด" : `${"🎴".repeat(p.cardCount)} (ซ่อน)`;
        }
    }

    // การ์ดของเรา
    ui.myCards.innerHTML = "";
    state.myCards.forEach((cardId, index) => {
        const cardData = cardsData[cardId];
        const btn = document.createElement("button");
        btn.className = `skill-card ${cardData.tier === 'rare' ? 'card-rare' : 'card-normal'}`;
        btn.innerText = cardData.name;
        btn.onclick = () => startSkillTurn(index);
        ui.myCards.appendChild(btn);
    });

    // โต๊ะกลาง
    const c = g.crosses;
    ui.crossStatus.innerHTML = `<span class="real">🔴 จริง ${c.realLeft}</span> · <span class="fake">⚪ หลอก ${c.fakeLeft}</span><br><span class="sub">ลั่นไกไปแล้ว ${c.thrown}/${c.total} นัด</span>`;
    renderCylinder(c);
    ui.letter.innerText = g.letter;
    ui.time.innerText = g.timeLeft;
    ui.timerFill.style.width = g.phase === 'typing' ? `${g.timeLeft / TURN_SECONDS * 100}%` : '0%';
    if (g.phase !== 'firing') document.querySelectorAll('.player.aimed').forEach(el => el.classList.remove('aimed'));
    ui.message.innerText = g.message;
    ui.startBtn.style.display = (myTurn && g.phase === 'idle') ? "inline-block" : "none";
    ui.startBtn.innerText = "เริ่มเทิร์นของคุณ";

    const phaseKey = `${g.turnId}|${g.phase}|${g.letter}`;
    if (phaseKey !== lastPhaseKey) {
        lastPhaseKey = phaseKey;
        if (g.phase === 'typing') {
            ui.input.value = "";
            ui.input.disabled = !myTurn;
            if (myTurn) ui.input.focus();
        } else {
            ui.input.disabled = true;
            ui.input.value = g.typing;
        }
    }

    // ปุ่มเลือกเป้าหมาย
    ui.targets.innerHTML = "";
    if (myTurn && g.phase === 'target') {
        players.forEach(p => {
            if (p.hp <= 0) return;
            const btn = document.createElement("button");
            btn.className = "btn-stab";
            btn.innerText = (p.id === myId) ? "ยิงตัวเอง" : `ยิง ${p.name}`;
            btn.onclick = () => attackTarget(p.id);
            ui.targets.appendChild(btn);
        });
        ui.targets.classList.remove("hidden");
    } else {
        ui.targets.classList.add("hidden");
    }
}

// ==========================================
// 5. การกระทำของผู้เล่น (ส่งไปให้เซิร์ฟเวอร์ตัดสิน)
// ==========================================
function startNormalTurn() { socket.emit('startTurn', { cardIndex: null }); }
function startSkillTurn(index) {
    if (!isMyTurn() || currentRoom.game.phase !== 'idle') return;
    socket.emit('startTurn', { cardIndex: index });
}

ui.input.addEventListener("input", () => {
    if (isMyTurn()) socket.emit('typing', ui.input.value);
});
ui.input.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !ui.input.disabled) {
        ui.input.disabled = true;
        socket.emit('submitWord', ui.input.value.toUpperCase().trim());
    }
});

function attackTarget(targetId) {
    ui.targets.classList.add("hidden");
    socket.emit('chooseTarget', targetId);
}

// ==========================================
// 6. โม่ปืน & เอฟเฟกต์
// ==========================================
function renderCylinder(c) {
    ui.cylinder.querySelectorAll('.chamber').forEach((ch, i) => {
        const fired = c.fired[i];
        ch.className = 'chamber ' + (fired === 'real' ? 'fired-real' : fired === 'fake' ? 'fired-fake' : 'loaded');
        if (i === c.thrown && !fired) ch.classList.add('next');
    });
    // หมุนให้รูถัดไปอยู่ใต้นกสับ (หมุนไปข้างหน้าตลอด แม้บรรจุกระสุนใหม่)
    ui.cylinder.style.transform = `rotate(${-(c.reloads * 5 + c.thrown) * 72}deg)`;
}

function slotElementOf(playerId) {
    return document.querySelector(`.player[data-pid="${CSS.escape(playerId)}"]`);
}

function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
}

function showBanner(text, cls) {
    ui.banner.innerText = text;
    ui.banner.className = 'shot-banner';
    void ui.banner.offsetWidth;
    ui.banner.classList.add(cls);
}

// ย่อกระดานให้พอดีจอเล็ก
function fitBoard() {
    const scale = Math.min(1, (window.innerWidth - 20) / 980, (window.innerHeight - 20) / 780);
    ui.board.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fitBoard);
fitBoard();

// ==========================================
// 7. เสียง (สังเคราะห์ด้วย Web Audio ไม่ต้องใช้ไฟล์)
// ==========================================
const Sound = (() => {
    let ctx = null;
    let enabled = localStorage.getItem('ghostSound') !== 'off';

    function ac() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }
    function noise(duration, freq, gain, when = 0) {
        const a = ac(), t = a.currentTime + when;
        const buf = a.createBuffer(1, a.sampleRate * duration, a.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
        const src = a.createBufferSource(); src.buffer = buf;
        const filter = a.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = freq;
        const g = a.createGain(); g.gain.value = gain;
        src.connect(filter).connect(g).connect(a.destination);
        src.start(t);
    }
    function tone(freq, duration, gain, type = 'square', when = 0) {
        const a = ac(), t = a.currentTime + when;
        const o = a.createOscillator(); o.type = type; o.frequency.value = freq;
        const g = a.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        o.connect(g).connect(a.destination);
        o.start(t); o.stop(t + duration);
    }
    return {
        get enabled() { return enabled; },
        set enabled(v) { enabled = v; localStorage.setItem('ghostSound', v ? 'on' : 'off'); },
        click() { if (!enabled) return; tone(1800, 0.04, 0.15); noise(0.05, 3000, 0.25, 0.01); },
        tick() { if (!enabled) return; tone(900, 0.05, 0.06, 'sine'); },
        spin() {
            if (!enabled) return;
            for (let i = 0; i < 14; i++) {
                const when = 1.5 * (1 - Math.pow(1 - i / 14, 1.8));
                tone(2200, 0.02, 0.05, 'square', when); noise(0.02, 4000, 0.08, when);
            }
        },
        bang() { if (!enabled) return; noise(0.9, 1200, 1.0); noise(0.25, 6000, 0.5); tone(70, 0.4, 0.5, 'sine'); }
    };
})();

function toggleSound() {
    Sound.enabled = !Sound.enabled;
    document.getElementById('sound-toggle').innerText = Sound.enabled ? '🔊' : '🔇';
    if (Sound.enabled) Sound.click();
}
document.getElementById('sound-toggle').innerText = Sound.enabled ? '🔊' : '🔇';
