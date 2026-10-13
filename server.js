// ==========================================
// Ghost's Roulette — Multiplayer Server
// เซิร์ฟเวอร์เป็นคนตัดสินทุกอย่าง (ห้อง, เทิร์น, คำศัพท์, วงเวทวิญญาณ, การ์ด)
// ==========================================
const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } }); // ให้เปิด index.html จากไฟล์ตรงๆ แล้วต่อได้ด้วย
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const ROOM_SIZES = [3, 5];
const TURN_SECONDS = 5;      // เวลาพิมพ์ศัพท์ (เท่าเกมเดิม)
const GRACE_MS = 500;        // เผื่อดีเลย์เน็ต
const IDLE_MS = 30000;       // ไม่กดเริ่มเทิร์นภายในเวลานี้ = ข้ามเทิร์น
const TARGET_MS = 15000;     // ไม่เลือกเป้าหมายภายในเวลานี้ = สุ่มเป้าให้
const RESET_MS = 8000;       // จบเกมแล้วกลับห้องรอ

// ==========================================
// 1. พจนานุกรม (โหลดที่เซิร์ฟเวอร์)
// ==========================================
const dictionaryUrl = 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt';
let dictionary = new Set();
let dictionaryReady = false;

fetch(dictionaryUrl)
    .then(res => { if (!res.ok) throw new Error(res.status); return res.text(); })
    .then(text => {
        dictionary = new Set(text.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(Boolean));
        console.log(`โหลดพจนานุกรมสำเร็จ (${dictionary.size} คำ)`);
    })
    .catch(err => {
        console.log('โหลดพจนานุกรมออนไลน์ไม่ได้ ใช้ศัพท์สำรอง:', err.message);
        dictionary = new Set(["SAW", "SOUL", "SKULL", "SCARE", "SAD", "MONSTER", "NIGHTMARE", "VAMPIRE", "GHOST"]);
    })
    .finally(() => { dictionaryReady = true; });

// ==========================================
// 2. ข้อมูลการ์ด
// ==========================================
const cardsData = {
    "Ouija": { id: "Ouija", name: "👁️ ดวงตาผีสาง", tier: "normal" },
    "Incense": { id: "Incense", name: "🔥 ธูปบูชา", tier: "normal" },
    "Soul": { id: "Soul", name: "🌑 เศษเสี้ยววิญญาณ", tier: "normal" },
    "Blood": { id: "Blood", name: "🩸 เลือดศักดิ์สิทธิ์", tier: "rare" },
    "Chains": { id: "Chains", name: "⛓️ โซ่ตรวนยมโลก", tier: "rare" },
    "Stake": { id: "Stake", name: "🗡️ ลิ่มเงิน", tier: "rare" }
};
const normalCardsPool = ["Ouija", "Incense", "Soul"];
const rareCardsPool = ["Blood", "Chains", "Stake"];

// ==========================================
// 3. ตัวช่วย
// ==========================================
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function cleanName(s, fallback, max) {
    s = String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    return s || fallback;
}
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
// ชื่อผู้เล่นใน log — ฝั่ง client จะเปลี่ยนเป็น "YOU" ถ้าเป็นตัวเอง
function pTag(p) { return `<span class="log-p-enemy" data-pid="${p.id}">${escapeHtml(p.name)}</span>`; }

// ==========================================
// 4. ระบบห้อง
// ==========================================
const rooms = new Map();
let nextRoomId = 1;

function roomList() {
    return [...rooms.values()].map(r => ({
        id: r.id, name: r.name, max: r.max,
        current: r.players.filter(p => p.connected).length,
        playing: r.status === 'playing'
    }));
}
function broadcastRoomList() { io.emit('roomList', roomList()); }

function viewFor(room, playerId) {
    const g = room.game;
    const me = room.players.find(p => p.id === playerId);
    return {
        id: room.id, name: room.name, max: room.max, hostId: room.hostId, status: room.status,
        players: room.players.map(p => ({ id: p.id, name: p.name, hp: p.hp, cardCount: p.cards.length, connected: p.connected })),
        myCards: me ? me.cards : [],
        game: g ? {
            phase: g.phase,
            turnId: room.players[g.turnIndex].id,
            letter: g.letter,
            timeLeft: g.timeLeft,
            typing: g.typing,
            message: g.message,
            crosses: { realLeft: 3 - g.realThrown, fakeLeft: 2 - g.fakeThrown, total: 5, thrown: g.thrown, fired: g.fired, reloads: g.reloads }
        } : null
    };
}
function sendRoomState(room) {
    room.players.forEach(p => { if (p.connected) io.to(p.id).emit('roomState', viewFor(room, p.id)); });
}
function privateMsg(p, text) { if (p.connected) io.to(p.id).emit('privateMsg', text); }
function addLog(room, html) { io.to(room.id).emit('log', html); }

function addPlayer(room, socket, playerName) {
    const base = cleanName(playerName, `Ghost${Math.floor(100 + Math.random() * 900)}`, 16);
    let name = base, n = 2;
    while (room.players.some(p => p.name === name)) name = `${base} ${n++}`;
    room.players.push({ id: socket.id, name, hp: 3, cards: [], connected: true });
    socket.join(room.id);
    socket.data.roomId = room.id;
    sendRoomState(room);
    broadcastRoomList();
}

function leaveCurrentRoom(socket) {
    const room = rooms.get(socket.data.roomId);
    socket.data.roomId = null;
    if (!room) return;
    socket.leave(room.id);
    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;

    if (room.status === 'waiting') room.players.splice(idx, 1);
    else handleInGameLeave(room, idx);

    const remaining = room.players.filter(p => p.connected);
    if (remaining.length === 0) {
        if (room.game) clearTimers(room.game);
        rooms.delete(room.id);
    } else {
        if (room.hostId === socket.id) room.hostId = remaining[0].id;
        sendRoomState(room);
    }
    broadcastRoomList();
}

function resetRoom(room) {
    if (room.game) clearTimers(room.game);
    room.status = 'waiting';
    room.game = null;
    room.players = room.players.filter(p => p.connected);
    room.players.forEach(p => { p.hp = 3; p.cards = []; });
    if (room.players.length === 0) { rooms.delete(room.id); broadcastRoomList(); return; }
    if (!room.players.some(p => p.id === room.hostId)) room.hostId = room.players[0].id;
    sendRoomState(room);
    broadcastRoomList();
}

// ==========================================
// 5. ระบบเกม
// ==========================================
function clearTimers(g) {
    clearTimeout(g.timeout); clearInterval(g.interval);
    g.timeout = null; g.interval = null;
}
// ตั้งเวลาทำงานถัดไป (มีได้ทีละอันต่อห้อง)
function schedule(room, fn, ms) {
    const g = room.game;
    clearTimers(g);
    g.timeout = setTimeout(() => { if (room.game === g) fn(room); }, ms);
}

function refillAndShuffleCrosses(g) {
    const pool = ['real', 'real', 'real', 'fake', 'fake'];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    g.crossPool = pool;
    g.thrown = 0; g.realThrown = 0; g.fakeThrown = 0;
    g.fired = [];                       // ผลของวิญญาณแต่ละดวงในวงเวทที่ปล่อยไปแล้ว
    g.reloads = (g.reloads ?? -1) + 1;  // ให้ client หมุนวงเวทไปข้างหน้าตลอด
}

function startGame(room) {
    room.status = 'playing';
    room.players.forEach(p => { p.hp = 3; p.cards = []; });
    room.game = {
        crossPool: [], thrown: 0, realThrown: 0, fakeThrown: 0,
        turnIndex: 0, skipNextTurn: false,
        effects: { doubleDamage: false, inverted: false, skipStabPhase: false },
        phase: 'busy', letter: '?', timeLeft: 0, typing: '', message: '',
        usedWords: new Set(), isSkillMode: false, cardIndex: -1, word: '',
        timeout: null, interval: null
    };
    refillAndShuffleCrosses(room.game);
    io.to(room.id).emit('gameStarted');
    addLog(room, `<span class="log-sys">-- เริ่มเกมใหม่ --</span>`);
    beginTurn(room);
    broadcastRoomList();
}

function checkGameOver(room) {
    const g = room.game;
    if (g.phase === 'over') return true;
    const alive = room.players.filter(p => p.hp > 0);
    if (alive.length > 1) return false;

    clearTimers(g);
    g.phase = 'over';
    if (alive.length === 1) {
        g.message = `🎉 จบเกม! ${alive[0].name} รอดชีวิตเป็นคนสุดท้าย! 🎉`;
        addLog(room, `<span class="log-sys">🎉 จบเกม! ${pTag(alive[0])} ชนะ!</span>`);
    } else {
        g.message = `👻 กลายเป็นผีกันหมด! เสมอกัน! 👻`;
        addLog(room, `<span class="log-sys">👻 กลายเป็นผีกันหมด! เสมอกัน!</span>`);
    }
    g.message += `\n(กลับห้องรอใน ${RESET_MS / 1000} วินาที)`;
    sendRoomState(room);
    g.timeout = setTimeout(() => { if (room.game === g) resetRoom(room); }, RESET_MS);
    return true;
}

function nextTurn(room) {
    const g = room.game;
    if (checkGameOver(room)) return;
    const n = room.players.length;
    for (let k = 1; k <= n; k++) {
        const idx = (g.turnIndex + k) % n;
        if (room.players[idx].hp > 0) { g.turnIndex = idx; break; }
    }
    beginTurn(room);
}

function beginTurn(room) {
    const g = room.game;
    if (checkGameOver(room)) return;
    const cur = room.players[g.turnIndex];
    g.letter = '?'; g.typing = ''; g.timeLeft = 0;

    if (g.skipNextTurn) {
        g.skipNextTurn = false;
        g.phase = 'busy';
        g.message = `⛓️ ${cur.name} ถูกข้ามเทิร์น!`;
        addLog(room, `<span class="log-sys">⛓️ ${pTag(cur)} ถูกข้ามเทิร์น</span>`);
        sendRoomState(room);
        schedule(room, nextTurn, 2500);
        return;
    }

    g.phase = 'idle';
    g.message = `ถึงเทิร์นของ ${cur.name}`;
    sendRoomState(room);
    schedule(room, r => {
        addLog(r, `<span class="log-sys">⌛ ${pTag(cur)} ไม่กดเริ่มเทิร์น ข้ามเทิร์น</span>`);
        nextTurn(r);
    }, IDLE_MS);
}

function startTurnPhase(room, cardIndex) {
    const g = room.game;
    const me = room.players[g.turnIndex];
    clearTimers(g);

    g.isSkillMode = cardIndex !== -1;
    g.cardIndex = cardIndex;
    g.letter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    g.timeLeft = TURN_SECONDS;
    g.typing = '';
    g.phase = 'typing';
    g.message = g.isSkillMode
        ? `${me.name} ใช้การ์ดสกิล! กำลังพิมพ์ศัพท์ที่ขึ้นต้นด้วย ${g.letter}`
        : `${me.name} กำลังพิมพ์ศัพท์ที่ขึ้นต้นด้วย ${g.letter}`;
    sendRoomState(room);
    privateMsg(me, g.isSkillMode
        ? `ใช้สกิล! รีบพิมพ์ศัพท์ที่ขึ้นต้นด้วย ${g.letter}`
        : `พิมพ์ศัพท์ที่ขึ้นต้นด้วย ${g.letter} (ยาว 3 ขึ้นไป)`);

    g.interval = setInterval(() => {
        if (g.timeLeft > 0) { g.timeLeft--; io.to(room.id).emit('tick', g.timeLeft); }
    }, 1000);
    g.timeout = setTimeout(() => {
        if (room.game === g && g.phase === 'typing') failTurn(room, "หมดเวลา!");
    }, TURN_SECONDS * 1000 + GRACE_MS);
}

function validateWord(room, rawWord) {
    const g = room.game;
    const me = room.players[g.turnIndex];
    clearTimers(g);
    const word = String(rawWord ?? '').toUpperCase().trim().slice(0, 40);

    if (!word.startsWith(g.letter)) return failTurn(room, `ผิด! ต้องขึ้นต้นด้วย ${g.letter}`);
    if (!dictionary.has(word)) return failTurn(room, "ไม่มีศัพท์นี้ในพจนานุกรม");
    if (g.usedWords.has(word)) return failTurn(room, "พลาด! คำนี้ถูกใช้ไปแล้ว");
    if (word.length < 3) return failTurn(room, "ศัพท์ต้องยาว 3 ตัวอักษรขึ้นไป");

    g.usedWords.add(word);
    g.word = word;
    g.typing = word;
    let successMsg = "เยี่ยมมาก! ได้สิทธิ์ปล่อยวิญญาณ";

    if (word.length >= 5) {
        const tier = word.length >= 8 ? 'rare' : 'normal';
        me.cards.push(randomItem(tier === 'rare' ? rareCardsPool : normalCardsPool));
        successMsg += `\n+ ได้การ์ดระดับ ${tier.toUpperCase()}!`;
        addLog(room, `<span class="log-sys">✨ ${pTag(me)} ได้รับการ์ด 1 ใบ</span>`);
    }

    if (g.isSkillMode) {
        const usedCardId = me.cards.splice(g.cardIndex, 1)[0];
        successMsg += applySkillEffect(room, g.turnIndex, usedCardId);
    }

    if (g.effects.skipStabPhase) {
        g.effects.skipStabPhase = false;
        g.phase = 'busy';
        g.message = `${me.name} ใช้คำว่า ${word} และไม่ต้องปล่อยวิญญาณเทิร์นนี้`;
        addLog(room, `${pTag(me)} ใช้คำว่า <span class="log-word">${word}</span> (ไม่สาป)`);
        sendRoomState(room);
        privateMsg(me, successMsg);
        schedule(room, nextTurn, 3000);
        return;
    }

    g.phase = 'target';
    g.message = `${me.name} ใช้คำว่า ${word} — กำลังเลือกว่าจะสาปใคร...`;
    sendRoomState(room);
    privateMsg(me, successMsg + "\nเลือกคนที่จะสาป!");
    schedule(room, r => {
        const alive = r.players.map((p, i) => i).filter(i => r.players[i].hp > 0);
        addLog(r, `<span class="log-sys">⌛ ${pTag(me)} เลือกเป้าไม่ทัน สุ่มเป้าให้</span>`);
        attackTarget(r, randomItem(alive));
    }, TARGET_MS);
}

function failTurn(room, reason) {
    const g = room.game;
    const me = room.players[g.turnIndex];
    clearTimers(g);
    g.phase = 'busy';
    g.message = `${me.name} พลาด! (${reason}) หมดสิทธิ์ปล่อยวิญญาณในเทิร์นนี้`;

    if (g.isSkillMode && me.cards[g.cardIndex]) {
        const lostCard = cardsData[me.cards.splice(g.cardIndex, 1)[0]].name;
        reason += `\nถูกยึดการ์ด [${lostCard}]!`;
    }
    addLog(room, `<span class="log-sys">${pTag(me)} พิมพ์พลาดและเสียเทิร์น</span>`);
    sendRoomState(room);
    privateMsg(me, reason + "\nหมดสิทธิ์ปล่อยวิญญาณในเทิร์นนี้!");
    schedule(room, nextTurn, 3000);
}

// คืนข้อความส่วนตัวให้คนใช้สกิล ส่วนคนอื่นเห็นแค่ใน log
function applySkillEffect(room, playerIdx, cardId) {
    const g = room.game;
    const p = room.players[playerIdx];
    if (g.crossPool.length === 0) refillAndShuffleCrosses(g);

    addLog(room, `${pTag(p)} ใช้สกิล <span class="log-card">[${cardsData[cardId].name}]</span>`);

    switch (cardId) {
        case "Ouija":
            addLog(room, `- <span class="log-sys">${pTag(p)} แอบส่องวงเวท!</span>`);
            return `\n👁️ ดวงต่อไปคือ [${g.crossPool[0] === 'real' ? "👻 วิญญาณร้าย" : "💨 เงาลวง"}]!`;
        case "Incense": {
            const discarded = g.crossPool.shift(); g.thrown++;
            if (discarded === 'real') g.realThrown++; else g.fakeThrown++;
            g.fired.push(discarded);
            g.effects.skipStabPhase = true;
            addLog(room, `- <span class="log-sys">ปัดเป่าวิญญาณทิ้ง 1 ดวงอย่างปลอดภัย</span>`);
            return `\n🔥 ปัดเป่าวิญญาณทิ้งไป 1 ดวง!`;
        }
        case "Soul":
            p.hp = Math.min(p.hp + 1, 3);
            addLog(room, `- <span class="log-sys">ฟื้นฟูเลือด 1 ขีด</span>`);
            return `\n🌑 ฟื้นฟู HP 1 หน่วย!`;
        case "Blood":
            g.effects.inverted = true;
            addLog(room, `- <span class="log-sys">สลับวิญญาณดวงต่อไป ร้าย⇄ลวง!</span>`);
            return `\n🩸 สลับวิญญาณดวงต่อไป ร้าย⇄ลวง!`;
        case "Chains":
            g.skipNextTurn = true;
            addLog(room, `- <span class="log-sys">เตรียมข้ามเทิร์นคนถัดไป!</span>`);
            return `\n⛓️ ผู้เล่นคนถัดไปจะถูกข้ามเทิร์น!`;
        case "Stake":
            g.effects.doubleDamage = true;
            addLog(room, `- <span class="log-sys">เสริมพลังทำดาเมจ x2!</span>`);
            return `\n🗡️ ถ้าเป็นวิญญาณร้ายจะทำดาเมจ x2!`;
    }
    return "";
}

const SUSPENSE_MS = 1800;   // ร่ายคาถาแล้วรอลุ้นก่อนเฉลยผล

function attackTarget(room, targetIdx) {
    const g = room.game;
    const me = room.players[g.turnIndex];
    const target = room.players[targetIdx];
    clearTimers(g);
    if (g.crossPool.length === 0) refillAndShuffleCrosses(g);

    const isSelf = targetIdx === g.turnIndex;
    const targetName = isSelf ? "ตัวเอง" : target.name;
    g.phase = 'firing';
    g.message = isSelf ? `${me.name} ร่ายคาถาสาปตัวเอง...` : `${me.name} ร่ายคาถาสาปใส่ ${target.name}...`;
    addLog(room, `${pTag(me)} ใช้คำว่า <span class="log-word">${g.word}</span> สาป ${isSelf ? 'ตัวเอง' : pTag(target)}`);
    sendRoomState(room);
    io.to(room.id).emit('aim', { shooterId: me.id, targetId: target.id });

    schedule(room, () => {
        const drawnCross = g.crossPool.shift(); g.thrown++;
        let isReal = drawnCross === 'real';
        if (g.effects.inverted) { isReal = !isReal; g.effects.inverted = false; }
        if (drawnCross === 'real') g.realThrown++; else g.fakeThrown++;
        g.fired.push(drawnCross);

        let dmg = 0;
        if (isReal) {
            dmg = g.effects.doubleDamage ? 2 : 1;
            target.hp = Math.max(0, target.hp - dmg);
            g.message = `👻 BOO! วิญญาณร้าย! ${targetName} โดนไป ${dmg} ดาเมจ`;
            addLog(room, `- <span class="log-real">👻 BOO! วิญญาณร้าย</span> ทำดาเมจ ${dmg}`);
        } else {
            g.message = `💨 ...แค่เงาลวง! ${targetName} รอดไป`;
            addLog(room, `- <span class="log-fake">💨 เงาลวง</span> รอดตัวไป`);
        }
        g.effects.doubleDamage = false;
        g.phase = 'busy';
        io.to(room.id).emit('shotResult', { targetId: target.id, real: isReal, dmg });

        if (checkGameOver(room)) return;
        sendRoomState(room);
        schedule(room, nextTurn, 3000);
    }, SUSPENSE_MS);
}

function handleInGameLeave(room, idx) {
    const g = room.game;
    const p = room.players[idx];
    p.connected = false; p.hp = 0; p.cards = [];
    if (g.phase === 'over') return;
    addLog(room, `<span class="log-sys">🚪 ${pTag(p)} ออกจากเกม</span>`);
    if (checkGameOver(room)) return;
    if (g.turnIndex === idx) {
        g.phase = 'busy';
        g.message = `${p.name} ออกจากเกม — ข้ามไปคนถัดไป`;
        schedule(room, nextTurn, 1500);
    }
}

// ==========================================
// 6. Socket events
// ==========================================
io.on('connection', socket => {
    const err = msg => socket.emit('errorMsg', msg);
    const myRoom = () => rooms.get(socket.data.roomId);
    // คืน context ถ้าเป็นเทิร์นของ socket นี้และอยู่ในเฟสที่กำหนด
    const myTurn = phase => {
        const room = myRoom();
        if (!room || room.status !== 'playing') return null;
        const g = room.game;
        const me = room.players[g.turnIndex];
        if (me.id !== socket.id || g.phase !== phase) return null;
        return { room, g, me };
    };

    socket.emit('roomList', roomList());

    socket.on('listRooms', () => socket.emit('roomList', roomList()));

    socket.on('createRoom', ({ roomName, playerName, max } = {}) => {
        leaveCurrentRoom(socket);
        const size = ROOM_SIZES.includes(Number(max)) ? Number(max) : 3;
        const room = {
            id: String(nextRoomId++), name: cleanName(roomName, 'MY ROOM', 20), max: size,
            hostId: socket.id, status: 'waiting', players: [], game: null
        };
        rooms.set(room.id, room);
        addPlayer(room, socket, playerName);
    });

    socket.on('joinRoom', ({ roomId, playerName } = {}) => {
        const room = rooms.get(String(roomId));
        if (!room) return err('ไม่พบห้องนี้ (อาจถูกปิดไปแล้ว)');
        if (socket.data.roomId === room.id) return sendRoomState(room);
        if (room.status !== 'waiting') return err('ห้องนี้กำลังเล่นอยู่');
        if (room.players.length >= room.max) return err('ห้องเต็มแล้ว');
        leaveCurrentRoom(socket);
        addPlayer(room, socket, playerName);
    });

    socket.on('leaveRoom', () => {
        leaveCurrentRoom(socket);
        socket.emit('roomList', roomList());
    });

    socket.on('startGame', () => {
        const room = myRoom();
        if (!room || room.hostId !== socket.id || room.status !== 'waiting') return;
        if (room.players.length < 2) return err('ต้องมีผู้เล่นอย่างน้อย 2 คนถึงจะเริ่มได้');
        if (!dictionaryReady) return err('เซิร์ฟเวอร์ยังโหลดพจนานุกรมไม่เสร็จ รอแป๊บนึงแล้วลองใหม่');
        startGame(room);
    });

    socket.on('startTurn', ({ cardIndex } = {}) => {
        const ctx = myTurn('idle');
        if (!ctx) return;
        let idx = -1;
        if (cardIndex !== null && cardIndex !== undefined) {
            idx = Number(cardIndex);
            if (!Number.isInteger(idx) || idx < 0 || idx >= ctx.me.cards.length) return;
        }
        startTurnPhase(ctx.room, idx);
    });

    socket.on('typing', text => {
        const ctx = myTurn('typing');
        if (!ctx) return;
        ctx.g.typing = String(text ?? '').toUpperCase().slice(0, 40);
        socket.to(ctx.room.id).emit('typing', ctx.g.typing);
    });

    socket.on('submitWord', word => {
        const ctx = myTurn('typing');
        if (ctx) validateWord(ctx.room, word);
    });

    socket.on('chooseTarget', targetId => {
        const ctx = myTurn('target');
        if (!ctx) return;
        const idx = ctx.room.players.findIndex(p => p.id === targetId && p.hp > 0);
        if (idx !== -1) attackTarget(ctx.room, idx);
    });

    socket.on('disconnect', () => leaveCurrentRoom(socket));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Ghost's Roulette พร้อมแล้ว!`);
    console.log(`  เครื่องนี้:      http://localhost:${PORT}`);
    Object.values(os.networkInterfaces()).flat()
        .filter(i => i && i.family === 'IPv4' && !i.internal)
        .forEach(i => console.log(`  เพื่อนวง Wi-Fi เดียวกัน: http://${i.address}:${PORT}`));
});
