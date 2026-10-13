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

const TURN_SECONDS = 10;
const avatars = ['👻', '🧛', '🧟', '💀', '🎃'];

// ชื่อ/คำอธิบายการ์ดอยู่ใน i18n.js (CARD_TEXT)
const cardsData = {
    "Ouija": { tier: "normal" }, "Incense": { tier: "normal" }, "Soul": { tier: "normal" },
    "Blood": { tier: "rare" }, "Chains": { tier: "rare" }, "Stake": { tier: "rare" }
};
let logEntries = [];     // เก็บ log ไว้แปลใหม่ตอนเปลี่ยนภาษา
let lastResults = null;

const ui = {
    letter: document.getElementById("target-letter"),
    time: document.getElementById("time"),
    input: document.getElementById("word-input"),
    message: document.getElementById("message-box"),
    startBtn: document.getElementById("start-btn"),
    targets: document.getElementById("target-selection"),
    crossStatus: document.getElementById("cross-status"),
    hand: document.getElementById("hand"),
    dealInfo: document.getElementById("deal-info"),
    reveal: document.getElementById("card-reveal"),
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
    resetChat();
    showOffline(true);
    currentRoom = null;
    showScreen('main-menu-screen');
});

// ป้ายเตือนตอนยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์
function showOffline(show) {
    document.getElementById('offline-banner').classList.toggle('hidden', !show);
}
if (!window.io) window.addEventListener('DOMContentLoaded', () => showOffline(true));

socket.on('errorMsg', msg => alert(tr(msg)));

socket.on('roomList', list => {
    rooms = list;
    if (!document.getElementById('join-room-screen').classList.contains('hidden')) renderRooms(false);
});

socket.on('roomState', state => {
    currentRoom = state;
    document.getElementById('chat-toggle').classList.remove('hidden');
    updateResults(state);
    if (state.status === 'waiting') {
        renderLobby(state);
        showScreen('lobby-screen');
    } else {
        renderGame(state);
        showScreen('game-board-screen');
    }
});

socket.on('gameStarted', () => {
    logEntries = [];
    document.getElementById('log-content').innerHTML = "";
    lastPhaseKey = "";
});
socket.on('log', m => addLog(m));
socket.on('tick', t => { ui.time.innerText = t; ui.timerFill.style.width = `${t / TURN_SECONDS * 100}%`; if (t <= 2) Sound.tick(); });
socket.on('privateMsg', lines => { ui.message.innerText = tr(lines); });
socket.on('typing', text => { if (!isMyTurn()) ui.input.value = text; });

// แจกการ์ด -> ไพ่บินจากกลางโต๊ะไปหาแต่ละคน
socket.on('dealt', ids => {
    showBanner('DEAL!', 'deal');
    Sound.deal(ids.length);
    ids.forEach((id, i) => flyCardTo(id, i * 140));
});

// มีคนใช้การ์ด -> เปิดไพ่ใบใหญ่กลางจอ
socket.on('cardPlayed', ({ playerId, cardId }) => {
    const p = currentRoom && currentRoom.players.find(x => x.id === playerId);
    ui.reveal.innerHTML = `<div class="play-card big tier-${cardsData[cardId].tier}">${cardHTML(cardId)}</div><div class="reveal-caption"></div>`;
    ui.reveal.querySelector('.reveal-caption').innerText = t('usedCardCaption', { name: playerId === myId ? t('you') : (p ? p.name : '') });
    restartAnim(ui.reveal, 'show');
    Sound.card();
});

// ร่ายคาถาใส่เป้า -> วงเวทหมุนลุ้น
socket.on('aim', ({ targetId }) => {
    const el = slotElementOf(targetId);
    if (el) el.classList.add('aimed');
    ui.revolver.classList.remove('spinning');
    void ui.revolver.offsetWidth; // รีสตาร์ทแอนิเมชัน
    ui.revolver.classList.add('spinning');
    Sound.spin();
});

// เฉลยผล -> BOO! หรือ เงาลวง
socket.on('shotResult', ({ targetId, real }) => {
    document.querySelectorAll('.player.aimed').forEach(el => el.classList.remove('aimed'));
    ui.revolver.classList.remove('spinning');
    const el = slotElementOf(targetId);
    if (real) {
        Sound.bang();
        showBanner('BOO!', 'bang');
        if (Settings.get('shake')) {
            restartAnim(ui.flash, 'bang');
            restartAnim(ui.board, 'shake');
        }
        if (el) restartAnim(el, 'hit');
    } else {
        Sound.click();
        showBanner('poof...', 'click');
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
    updateAmbient();
}

function renderRooms(refresh = true) {
    if (refresh) socket.emit('listRooms');
    const grid = document.getElementById('room-grid');
    grid.innerHTML = '';

    if (rooms.length === 0) {
        grid.innerHTML = socket.connected
            ? `<div class="room-empty">${t('roomEmpty')}<br><button onclick="showScreen('create-room-screen')">${t('roomEmptyCreate')}</button></div>`
            : `<div class="room-empty">${t('roomNoServer')}</div>`;
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
                ${canJoin ? `<button class="join-btn">${t('join')}</button>` : `<span class="join-full">${t(room.playing ? 'playing' : 'full')}</span>`}
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
    resetChat();
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
    document.getElementById('lobby-count').innerText = t('lobbyCount', { n: state.players.length, max: state.max });

    const list = document.getElementById('lobby-players');
    list.innerHTML = '';
    state.players.forEach(p => {
        const row = document.createElement('div');
        row.className = 'lobby-player' + (p.isBot ? ' bot' : '');
        const label = document.createElement('span');
        label.innerText = `${p.isBot ? '🤖' : '💀'} ${p.name}${p.isBot ? ' ' + t('botTag') : ''}${p.id === state.hostId ? ' 👑' : ''}${p.id === myId ? ' ' + t('youTag') : ''}`;
        row.appendChild(label);
        if (p.isBot && isHost) {
            const rm = document.createElement('button');
            rm.className = 'bot-remove';
            rm.innerText = '✕';
            rm.title = t('removeBot');
            rm.onclick = () => socket.emit('removeBot', p.id);
            row.appendChild(rm);
        }
        list.appendChild(row);
    });
    for (let i = state.players.length; i < state.max; i++) {
        const row = document.createElement('div');
        row.className = 'lobby-player empty';
        row.innerText = t('waitingSeat');
        list.appendChild(row);
    }

    const addBotBtn = document.getElementById('lobby-addbot-btn');
    addBotBtn.style.display = isHost && state.players.length < state.max ? 'inline-block' : 'none';

    const startBtn = document.getElementById('lobby-start-btn');
    startBtn.style.display = isHost ? 'inline-block' : 'none';
    startBtn.disabled = state.players.length < 2;
    document.getElementById('lobby-status').innerText = isHost
        ? t(state.players.length < 2 ? 'lobbyNeed' : (state.players.length < state.max ? 'lobbyCan' : 'lobbyFull'))
        : t('lobbyWait');
}

// ==========================================
// 4. กระดานเกม (แสดงผลตามสถานะจากเซิร์ฟเวอร์)
// ==========================================
function addLog(m) {
    logEntries.push(m);
    const logBox = document.getElementById('log-content');
    const entry = document.createElement('div');
    entry.innerHTML = tr(m, true);
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
}

function renderLog() {
    const logBox = document.getElementById('log-content');
    logBox.innerHTML = logEntries.map(m => `<div>${tr(m, true)}</div>`).join('');
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
            ? `${p.name} ${t('youTag')}`
            : p.name + (p.isBot ? ' 🤖' : '') + (p.connected ? '' : ' ' + t('leftTag'));
        el.querySelector('.avatar').innerText = avatars[players.indexOf(p) % avatars.length];
        el.dataset.pid = p.id;
        document.getElementById(`hp-${slot}`).innerHTML = p.hp > 0 ? '<span class="hp-pip"></span>'.repeat(p.hp) : t('becameGhost');
        el.classList.toggle('dead-player', p.hp <= 0);
        el.classList.toggle('current-turn', p.id === g.turnId && g.phase !== 'over');

        if (slot > 0) {
            el.querySelector('.cards-hidden').innerHTML = p.cardCount === 0
                ? t('noCards')
                : Array.from({ length: p.cardCount }, (_, i) => `<span class="mini-back" style="--r:${(i - (p.cardCount - 1) / 2) * 9}deg"></span>`).join('');
        }
    }

    // ไพ่ในมือ
    renderHand(state.myCards, myTurn && g.phase === 'idle');
    const me = players.find(p => p.id === myId);
    ui.dealInfo.innerText = g.phase === 'over' || !me || me.hp <= 0 ? '' : (g.dealIn > 0 ? t('dealIn', { n: g.dealIn }) : t('dealNext'));

    // โต๊ะกลาง
    const c = g.crosses;
    ui.crossStatus.innerHTML = t('crossStatus', { real: c.realLeft, fake: c.fakeLeft, thrown: c.thrown, total: c.total });
    renderCylinder(c);
    ui.letter.innerText = g.letter;
    ui.time.innerText = g.timeLeft;
    ui.timerFill.style.width = g.phase === 'typing' ? `${g.timeLeft / TURN_SECONDS * 100}%` : '0%';
    if (g.phase !== 'firing') document.querySelectorAll('.player.aimed').forEach(el => el.classList.remove('aimed'));
    ui.message.innerText = tr(g.message);
    ui.startBtn.style.display = (myTurn && g.phase === 'idle') ? "inline-block" : "none";
    ui.startBtn.innerText = t('startTurn');

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
            btn.innerText = (p.id === myId) ? t('curseSelf') : t('curse', { name: p.name });
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
function startNormalTurn() { socket.emit('startTurn'); }
function playCard(index, el) {
    if (!isMyTurn() || currentRoom.game.phase !== 'idle') return;
    if (el) el.classList.add('playing');
    socket.emit('useCard', index);
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
// 6. วงเวทวิญญาณ & เอฟเฟกต์
// ==========================================
function renderCylinder(c) {
    ui.cylinder.querySelectorAll('.chamber').forEach((ch, i) => {
        const fired = c.fired[i];
        ch.className = 'chamber ' + (fired === 'real' ? 'fired-real' : fired === 'fake' ? 'fired-fake' : 'loaded');
        if (i === c.thrown && !fired) ch.classList.add('next');
    });
    // หมุนให้ดวงถัดไปอยู่ใต้เทียน (หมุนไปข้างหน้าตลอด แม้อัญเชิญรอบใหม่)
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
// จอแคบ/จอเตี้ย (มือถือ) ใช้เลย์เอาต์แนวตั้งจาก CSS แทนการย่อกระดาน
const mobileMQ = window.matchMedia('(max-width: 760px), (max-height: 520px)');
const isTouch = window.matchMedia('(hover: none)').matches;
function fitBoard() {
    if (mobileMQ.matches) { ui.board.style.transform = 'none'; return; }
    const scale = Math.min(1, (window.innerWidth - 20) / 980, (window.innerHeight - 20) / 780);
    ui.board.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fitBoard);
mobileMQ.addEventListener('change', fitBoard);
fitBoard();

// ==========================================
// 7. เสียง (สังเคราะห์ด้วย Web Audio ไม่ต้องใช้ไฟล์)
// ==========================================
const Sound = (() => {
    let ctx = null, master = null;
    let enabled = localStorage.getItem('ghostSound') !== 'off';
    let volume = Number(localStorage.getItem('ghostVolume') ?? 0.8);

    function ac() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            master = ctx.createGain();
            master.gain.value = volume;
            master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }
    // เสียงซ่า (ลม/ควัน) กรองความถี่ได้ และกวาดความถี่ได้
    function noise(duration, freq, gain, when = 0, type = 'lowpass', freqEnd = freq, dest = master) {
        const a = ac(), t = a.currentTime + when;
        const buf = a.createBuffer(1, Math.ceil(a.sampleRate * duration), a.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = a.createBufferSource(); src.buffer = buf;
        const filter = a.createBiquadFilter(); filter.type = type; filter.Q.value = type === 'bandpass' ? 4 : 1;
        filter.frequency.setValueAtTime(freq, t);
        filter.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + duration * 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.connect(filter).connect(g).connect(dest);
        src.start(t);
    }
    function tone(freq, duration, gain, type = 'sine', when = 0, dest = master) {
        const a = ac(), t = a.currentTime + when;
        const o = a.createOscillator(); o.type = type; o.frequency.value = freq;
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, duration / 4));
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        o.connect(g).connect(dest);
        o.start(t); o.stop(t + duration);
    }
    // เสียงผีโหยหวน: ความถี่ขึ้นแล้วลง + สั่นแบบ vibrato
    function wail(gain, dest = master, len = 1.4, base = 260) {
        const a = ac(), t = a.currentTime;
        const o = a.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(base, t);
        o.frequency.exponentialRampToValueAtTime(base * 2.77, t + len * 0.25);
        o.frequency.exponentialRampToValueAtTime(base * 0.73, t + len * 0.93);
        const lfo = a.createOscillator(); lfo.frequency.value = 7;
        const lfoGain = a.createGain(); lfoGain.gain.value = 25;
        lfo.connect(lfoGain).connect(o.frequency);
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + len * 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g).connect(dest);
        o.start(t); lfo.start(t); o.stop(t + len); lfo.stop(t + len);
    }

    // ---- เสียงบรรยากาศหน้าเมนู: เสียงหึ่งต่ำ + ลมหวีดหวิว + เสียงหลอนสุ่มเป็นระยะ ----
    let amb = null;
    function ambientStart() {
        if (amb) return;
        const a = ac(), t = a.currentTime;
        const out = a.createGain();
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(0.6, t + 3);
        out.connect(master);
        const nodes = [];
        // เสียงหึ่งต่ำ (โน้ตเพี้ยนกันนิดๆ ให้มีเสียงสั่นเป็นจังหวะ)
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 5;
        lp.connect(out);
        [[55, 'sawtooth', 0.05], [55.7, 'sawtooth', 0.05], [77.8, 'sine', 0.07]].forEach(([f, type, gv]) => {
            const o = a.createOscillator(); o.type = type; o.frequency.value = f;
            const g = a.createGain(); g.gain.value = gv;
            o.connect(g).connect(lp); o.start(); nodes.push(o);
        });
        const lfo = a.createOscillator(); lfo.frequency.value = 0.07;
        const lfoGain = a.createGain(); lfoGain.gain.value = 140;
        lfo.connect(lfoGain).connect(lp.frequency); lfo.start(); nodes.push(lfo);
        // ลมหวีดหวิว: เสียงซ่าวนลูป กวาดความถี่ช้าๆ
        const buf = a.createBuffer(1, a.sampleRate * 4, a.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const wind = a.createBufferSource(); wind.buffer = buf; wind.loop = true;
        const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 4;
        const windGain = a.createGain(); windGain.gain.value = 0.09;
        const sweep = a.createOscillator(); sweep.frequency.value = 0.11;
        const sweepGain = a.createGain(); sweepGain.gain.value = 320;
        sweep.connect(sweepGain).connect(bp.frequency);
        wind.connect(bp).connect(windGain).connect(out);
        wind.start(); sweep.start(); nodes.push(wind, sweep);
        amb = { out, nodes, timer: null };
        nextAmbientEvent(4000);
    }
    function nextAmbientEvent(delay) {
        amb.timer = setTimeout(() => {
            if (!amb) return;
            ambientEvent(amb.out);
            nextAmbientEvent(6000 + Math.random() * 9000);
        }, delay);
    }
    function ambientEvent(dest) {
        const r = Math.random();
        if (r < 0.3) {
            wail(0.07, dest, 3.2, 160 + Math.random() * 80);                       // ผีโหยหวนไกลๆ
        } else if (r < 0.6) {
            // กล่องดนตรีเพี้ยนๆ
            const tunes = [[659, 622, 523, 494], [880, 831, 659, 622, 587], [523, 740, 494, 698]];
            tunes[Math.floor(Math.random() * tunes.length)]
                .forEach((f, i) => tone(f, 1.6, 0.05, 'triangle', i * 0.5, dest));
        } else if (r < 0.8) {
            [0, 0.28, 1.1, 1.38].forEach(w => tone(48, 0.35, 0.3, 'sine', w, dest)); // หัวใจเต้น
        } else {
            for (let i = 0; i < 5; i++) noise(0.25, 2200 + Math.random() * 1500, 0.05, i * 0.22, 'bandpass', 1500, dest); // เสียงกระซิบ
        }
    }
    function ambientStop() {
        if (!amb) return;
        const { out, nodes, timer } = amb;
        amb = null;
        clearTimeout(timer);
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        setTimeout(() => { nodes.forEach(n => n.stop()); out.disconnect(); }, 1400);
    }
    return {
        get enabled() { return enabled; },
        set enabled(v) { enabled = v; localStorage.setItem('ghostSound', v ? 'on' : 'off'); },
        get volume() { return volume; },
        set volume(v) { volume = v; localStorage.setItem('ghostVolume', v); if (master) master.gain.value = v; },
        click() { if (!enabled) return; noise(0.35, 900, 0.18, 0, 'lowpass', 200); },          // พรึ่บ... ควันจาง
        tick() { if (!enabled) return; tone(660, 0.12, 0.05); },                                // ระฆังเบาๆ
        spin() { if (!enabled) return; noise(1.7, 400, 0.12, 0, 'bandpass', 1800); },           // ลมกระซิบหมุนวน
        win() { if (!enabled) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 0.12, 'triangle', i * 0.14)); },
        card() { if (!enabled) return; noise(0.14, 5000, 0.22, 0, 'highpass', 2000); tone(880, 0.12, 0.06, 'triangle', 0.05); },
        deal(n) { if (!enabled) return; for (let i = 0; i < n; i++) noise(0.1, 4000, 0.18, i * 0.14, 'highpass', 1500); },
        bang() { if (!enabled) return; wail(0.35); tone(55, 0.6, 0.45); noise(0.5, 3000, 0.15, 0, 'highpass', 800); }, // BOO!
        ambient(on) { if (on) ambientStart(); else ambientStop(); }
    };
})();

function toggleSound() {
    Sound.enabled = !Sound.enabled;
    syncSoundButton();
    if (Sound.enabled) Sound.click();
}
// เปิดเสียงบรรยากาศเฉพาะหน้าเมนู (ก่อนเข้าห้อง) เบราว์เซอร์ให้เล่นเสียงได้หลังผู้ใช้แตะจอครั้งแรก
let userInteracted = false;
function updateAmbient() {
    if (!userInteracted) return;   // ยังไม่แตะจอ (และกันเรียกก่อน Settings ถูกสร้างตอนโหลดหน้า)
    const inRoom = ['lobby-screen', 'game-board-screen'].some(id => !document.getElementById(id).classList.contains('hidden'));
    Sound.ambient(Sound.enabled && Settings.get('menuMusic') && !inRoom);
}
['pointerdown', 'mousedown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, () => {
    if (userInteracted) return;
    userInteracted = true;
    updateAmbient();
}, { capture: true }));

function syncSoundButton() {
    document.getElementById('sound-toggle').innerText = t(Sound.enabled ? 'soundOn' : 'soundOff');
    updateAmbient();
    const box = document.getElementById('set-sound');
    if (box) box.checked = Sound.enabled;
}
syncSoundButton();

// ==========================================
// 8. หน้าต่างกติกา
// ==========================================
function openRules() { document.getElementById('rules-modal').classList.remove('hidden'); }
function closeRules() { document.getElementById('rules-modal').classList.add('hidden'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRules(); });

// ==========================================
// 9. กระดานสรุปผลตอนจบเกม
// ==========================================
let resultsShownFor = 0;      // gameNo ที่เปิดกระดานไปแล้ว
let resultsTimer = null;

function updateResults(state) {
    const g = state.game;
    if (g && g.phase === 'over' && g.results && resultsShownFor !== g.gameNo) {
        resultsShownFor = g.gameNo;
        clearTimeout(resultsTimer);
        resultsTimer = setTimeout(() => showResults(g.results), 1700);   // รอให้ BOO! เล่นจบก่อน
    }
    // เกมใหม่เริ่มแล้ว ปิดกระดานของตาที่แล้ว
    if (g && g.phase !== 'over') hideResults();
}

function showResults(results) {
    lastResults = results;
    const medals = ['🥇', '🥈', '🥉'];
    const winner = results.find(r => r.status === 'winner');
    const me = results.find(r => r.id === myId);
    document.getElementById('results-title').innerText = winner ? 'GAME OVER' : 'DRAW';
    document.getElementById('results-sub').innerText = winner
        ? (winner.id === myId ? t('resWinMe') : t('resWinOther', { name: winner.name }))
        : t('resDraw');

    // โพเดียม ที่ 2 - ที่ 1 - ที่ 3
    const podium = document.getElementById('podium');
    podium.innerHTML = '';
    [1, 0, 2].forEach(i => {
        const r = results[i];
        if (!r) return;
        const col = document.createElement('div');
        col.className = `podium-col place-${r.rank}${r.id === myId ? ' is-me' : ''}`;
        col.innerHTML = `
            <div class="podium-avatar">${avatars[r.avatar % avatars.length]}</div>
            <div class="podium-name"></div>
            <div class="podium-block"><span class="podium-medal">${medals[i]}</span></div>`;
        col.querySelector('.podium-name').innerText = r.name;
        podium.appendChild(col);
    });

    // ตารางอันดับทุกคน
    const list = document.getElementById('results-list');
    list.innerHTML = '';
    const statusText = { winner: t('stWinner'), ghost: t('stGhost'), left: t('stLeft') };
    results.forEach(r => {
        const row = document.createElement('div');
        row.className = 'results-row' + (r.id === myId ? ' is-me' : '');
        row.innerHTML = `<span class="rr-rank">${r.rank}</span><span class="rr-avatar">${avatars[r.avatar % avatars.length]}</span>
            <span class="rr-name"></span><span class="rr-status">${statusText[r.status]}</span>
            <span class="rr-stat">${t(r.words === 1 ? 'word1' : 'words', { n: r.words })}</span><span class="rr-stat rr-longest">${r.longest || '-'}</span>`;
        row.querySelector('.rr-name').innerText = r.name + (r.id === myId ? ' ' + t('youTag') : '');
        list.appendChild(row);
    });

    const wasOpen = !document.getElementById('results-modal').classList.contains('hidden');
    document.getElementById('results-modal').classList.remove('hidden');
    if (wasOpen) return;   // แค่แปลภาษาใหม่ ไม่ต้องเล่นเสียงซ้ำ
    if (me && me.status === 'winner') Sound.win(); else Sound.spin();
}

function hideResults() {
    clearTimeout(resultsTimer);
    document.getElementById('results-modal').classList.add('hidden');
}

function playAgain() {
    hideResults();
    socket.emit('playAgain');
}

function goHomeFromResults() {
    hideResults();
    leaveRoom();
}

// ==========================================
// 10. ไพ่ในมือ (สไตล์เกมไพ่)
// ==========================================
let lastHand = [];

function cardHTML(id) {
    const c = cardsData[id];
    return `<div class="pc-tier">${c.tier.toUpperCase()}</div>
        <div class="pc-emoji">${cardEmoji(id)}</div>
        <div class="pc-title">${CARD_TEXT[id][lang][0]}</div>
        <div class="pc-desc">${CARD_TEXT[id][lang][1]}</div>`;
}

function renderHand(cards, canPlay) {
    const n = cards.length;
    // การ์ดที่เพิ่งได้ (ต่อท้ายมือ) จะมีแอนิเมชันแจกไพ่
    const sameStart = lastHand.every((c, i) => cards[i] === c);
    const newFrom = sameStart && n > lastHand.length ? lastHand.length : n;
    ui.hand.innerHTML = '';
    ui.hand.classList.toggle('playable', canPlay);
    cards.forEach((id, i) => {
        const off = i - (n - 1) / 2;
        const el = document.createElement('div');
        el.className = `play-card tier-${cardsData[id].tier}` + (i >= newFrom ? ' dealt' : '');
        el.style.setProperty('--x', `${off * 52}px`);
        el.style.setProperty('--y', `${off * off * 4}px`);
        el.style.setProperty('--r', `${off * 7}deg`);
        el.style.zIndex = i + 1;
        el.innerHTML = cardHTML(id);
        el.onclick = () => {
            // จอสัมผัส: แตะครั้งแรก = ยกไพ่ขึ้นมาอ่าน, แตะซ้ำ = ใช้การ์ด
            if (isTouch && !el.classList.contains('selected')) {
                ui.hand.querySelectorAll('.selected').forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
                return;
            }
            playCard(i, el);
        };
        ui.hand.appendChild(el);
    });
    lastHand = cards.slice();
}

// ไพ่หลังบินจากกลางกระดานไปหาผู้เล่น
function flyCardTo(playerId, delay) {
    const slot = playerId === myId ? null : document.querySelector(`.player[data-pid="${CSS.escape(playerId)}"]`);
    if (playerId !== myId && !slot) return;
    const bw = ui.board.offsetWidth, bh = ui.board.offsetHeight;
    const from = { x: bw / 2, y: bh * 0.47 };
    const to = slot
        ? { x: slot.offsetLeft + slot.offsetWidth / 2, y: slot.offsetTop + slot.offsetHeight / 2 }
        : { x: ui.hand.offsetLeft, y: bh - 100 };
    const card = document.createElement('div');
    card.className = 'fly-card';
    ui.board.appendChild(card);
    card.animate([
        { transform: `translate(${from.x - 42}px, ${from.y - 60}px) scale(0.7) rotate(0deg)`, opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { transform: `translate(${to.x - 42}px, ${to.y - 60}px) scale(0.4) rotate(540deg)`, opacity: 0.2 }
    ], { duration: 750, delay, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'both' }).onfinish = () => card.remove();
}

// ==========================================
// 11. หน้าตั้งค่า (SETTING) — จำไว้ในเครื่อง
// ==========================================
const Settings = (() => {
    const defaults = { shake: true, bgAnim: true, menuMusic: true };
    const saved = JSON.parse(localStorage.getItem('ghostSettings') || '{}');
    const data = { ...defaults, ...saved };
    return {
        get: k => data[k],
        set(k, v) { data[k] = v; localStorage.setItem('ghostSettings', JSON.stringify(data)); applySettings(); },
        reset() { Object.assign(data, defaults); localStorage.removeItem('ghostSettings'); applySettings(); }
    };
})();

function applySettings() {
    document.body.classList.toggle('no-bg-anim', !Settings.get('bgAnim'));
    updateAmbient();
}
applySettings();

function openSettings() {
    applyStaticI18n();
    document.getElementById('set-name').value = localStorage.getItem('ghostPlayerName') || '';
    document.getElementById('set-sound').checked = Sound.enabled;
    document.getElementById('set-volume').value = Math.round(Sound.volume * 100);
    document.getElementById('set-volume-label').innerText = `${Math.round(Sound.volume * 100)}%`;
    document.getElementById('set-shake').checked = Settings.get('shake');
    document.getElementById('set-bganim').checked = Settings.get('bgAnim');
    document.getElementById('set-menumusic').checked = Settings.get('menuMusic');
    document.getElementById('settings-modal').classList.remove('hidden');
}
function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }

function setPlayerNameSetting(value) {
    const name = value.trim().slice(0, 16);
    if (name) localStorage.setItem('ghostPlayerName', name); else localStorage.removeItem('ghostPlayerName');
    ['join-player-name', 'create-player-name'].forEach(id => { document.getElementById(id).value = name; });
}
function setSoundSetting(on) { Sound.enabled = on; syncSoundButton(); if (on) Sound.click(); }
function setVolumeSetting(percent) {
    Sound.volume = percent / 100;
    document.getElementById('set-volume-label').innerText = `${percent}%`;
}
function resetSettings() {
    Settings.reset();
    Sound.enabled = true; Sound.volume = 0.8; syncSoundButton();
    openSettings();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });

// ==========================================
// 12. เปลี่ยนภาษา
// ==========================================
function setLang(newLang) {
    if (!STR[newLang]) return;
    lang = newLang;
    localStorage.setItem('ghostLang', lang);
    applyStaticI18n();
    // วาดทุกอย่างที่อยู่บนจอใหม่ด้วยภาษาใหม่
    if (!document.getElementById('join-room-screen').classList.contains('hidden')) renderRooms(false);
    if (currentRoom) {
        lastHand = currentRoom.myCards.slice();   // ไม่ต้องเล่นแอนิเมชันแจกไพ่ซ้ำ
        if (currentRoom.status === 'waiting') renderLobby(currentRoom); else renderGame(currentRoom);
    }
    renderLog();
    renderChat();
    if (lastResults && !document.getElementById('results-modal').classList.contains('hidden')) showResults(lastResults);
}
function toggleLang() { setLang(lang === 'th' ? 'en' : 'th'); }
applyStaticI18n();

// ==========================================
// 13. แชทในห้อง
// ==========================================
let chatEntries = [];
let chatUnread = 0;
let chatOpen = localStorage.getItem('ghostChatOpen') === '1';
const chatUI = {
    toggle: document.getElementById('chat-toggle'),
    badge: document.getElementById('chat-badge'),
    panel: document.getElementById('chat-panel'),
    list: document.getElementById('chat-messages'),
    input: document.getElementById('chat-input')
};

socket.on('chatHistory', list => { chatEntries = list.slice(); renderChat(); });
socket.on('chat', entry => {
    chatEntries.push(entry);
    if (chatEntries.length > 50) chatEntries.shift();
    appendChat(entry);
    if (!chatOpen && entry.pid && entry.pid !== myId) {
        chatUnread++;
        updateChatBadge();
        Sound.tick();
    }
});

function chatLineEl(e) {
    const div = document.createElement('div');
    if (e.sys) {
        div.className = 'chat-line sys';
        div.textContent = tr(e.sys);
        return div;
    }
    const mine = e.pid === myId;
    div.className = 'chat-line' + (mine ? ' mine' : '');
    const who = document.createElement('span');
    who.className = 'chat-name';
    who.textContent = mine ? t('you') : e.name;
    const text = document.createElement('span');
    text.className = 'chat-text';
    text.textContent = e.text;
    div.append(who, text);
    return div;
}

function renderChat() {
    chatUI.list.innerHTML = '';
    if (!chatEntries.some(e => !e.sys)) {
        const empty = document.createElement('div');
        empty.className = 'chat-empty';
        empty.textContent = t('chatEmpty');
        chatUI.list.appendChild(empty);
    }
    chatEntries.forEach(e => chatUI.list.appendChild(chatLineEl(e)));
    chatUI.list.scrollTop = chatUI.list.scrollHeight;
}

function appendChat(e) {
    if (!e.sys) chatUI.list.querySelector('.chat-empty')?.remove();
    chatUI.list.appendChild(chatLineEl(e));
    chatUI.list.scrollTop = chatUI.list.scrollHeight;
}

function updateChatBadge() {
    chatUI.badge.textContent = chatUnread > 9 ? '9+' : chatUnread;
    chatUI.badge.classList.toggle('hidden', chatUnread === 0 || chatOpen);
}

function setChatOpen(open) {
    chatOpen = open;
    localStorage.setItem('ghostChatOpen', open ? '1' : '0');
    chatUI.panel.classList.toggle('hidden', !open);
    chatUI.toggle.classList.toggle('active', open);
    if (open) {
        chatUnread = 0;
        chatUI.list.scrollTop = chatUI.list.scrollHeight;
        if (!isTouch) chatUI.input.focus();
    }
    updateChatBadge();
}
function toggleChat() { setChatOpen(!chatOpen); }

function sendChat(text) {
    text = (text ?? chatUI.input.value).trim();
    if (!text) return;
    socket.emit('chat', text);
    if (text === chatUI.input.value.trim()) chatUI.input.value = '';
}

chatUI.input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
    e.stopPropagation();   // พิมพ์แชทไม่ไปกวนปุ่มลัดอื่น
});

// ออกจากห้อง -> ซ่อนแชทและล้างข้อความ
function resetChat() {
    chatEntries = []; chatUnread = 0;
    chatUI.list.innerHTML = '';
    chatUI.toggle.classList.add('hidden');
    chatUI.panel.classList.add('hidden');
    updateChatBadge();
}

// เปิดแชทค้างไว้จากครั้งก่อน -> เปิดให้เลยตอนเข้าห้อง
socket.on('chatHistory', () => { if (chatOpen) setChatOpen(true); });
