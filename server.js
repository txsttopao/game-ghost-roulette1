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
const TURN_SECONDS = 10;     // เวลาพิมพ์ศัพท์
const GRACE_MS = 500;        // เผื่อดีเลย์เน็ต
const IDLE_MS = 30000;       // ไม่กดเริ่มเทิร์นภายในเวลานี้ = ข้ามเทิร์น
const TARGET_MS = 15000;     // ไม่เลือกเป้าหมายภายในเวลานี้ = สุ่มเป้าให้
const HAND_MAX = 5;          // ถือการ์ดได้สูงสุด
const RARE_CHANCE = 0.3;     // โอกาสได้การ์ด RARE ตอนแจก
const RESET_MS = 60000;      // จบเกมแล้วไม่มีใครกด "เล่นอีกครั้ง" ภายในเวลานี้ = กลับห้องรอเอง

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
        buildBotWords();
        console.log(`โหลดพจนานุกรมสำเร็จ (${dictionary.size} คำ)`);
    })
    .catch(err => {
        console.log('โหลดพจนานุกรมออนไลน์ไม่ได้ ใช้ศัพท์สำรอง:', err.message);
        dictionary = new Set(["SAW", "SOUL", "SKULL", "SCARE", "SAD", "MONSTER", "NIGHTMARE", "VAMPIRE", "GHOST"]);
    })
    .finally(() => { dictionaryReady = true; if (!botWords.A) buildBotWords(); });

// คำที่บอทเลือกใช้ (ยาว 3-10 ตัว) แยกตามตัวอักษรแรก
let botWords = {};
function buildBotWords() {
    botWords = {};
    for (const w of dictionary) {
        if (w.length >= 3 && w.length <= 10 && /^[A-Z]+$/.test(w)) (botWords[w[0]] ||= []).push(w);
    }
}

// ==========================================
// 2. ข้อมูลการ์ด
// ==========================================
const normalCardsPool = ["Ouija", "Incense", "Soul"];
const rareCardsPool = ["Blood", "Chains", "Stake"];

// ==========================================
// 3. ตัวช่วย
// ==========================================
function cleanName(s, fallback, max) {
    s = String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
    return s || fallback;
}
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
// ข้อความทุกอย่างส่งเป็น { k: รหัสข้อความ, p: ข้อมูล } แล้วให้ client แปลเป็นภาษาของผู้เล่นแต่ละคน
const M = (k, p = {}) => ({ k, p });
const P = player => ({ pid: player.id, name: player.name });   // อ้างถึงผู้เล่น (client เปลี่ยนเป็น "คุณ/You" ให้เอง)
const CARD = id => ({ card: id });

// ==========================================
// 4. ระบบห้อง
// ==========================================
const rooms = new Map();
let nextRoomId = 1;
let nextGameNo = 1;

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
        players: room.players.map(p => ({ id: p.id, name: p.name, hp: p.hp, cardCount: p.cards.length, connected: p.connected, isBot: !!p.isBot })),
        myCards: me ? me.cards : [],
        game: g ? {
            phase: g.phase,
            turnId: room.players[g.turnIndex].id,
            letter: g.letter,
            timeLeft: g.timeLeft,
            typing: g.typing,
            message: g.message,
            crosses: { realLeft: 3 - g.realThrown, fakeLeft: 2 - g.fakeThrown, total: 5, thrown: g.thrown, fired: g.fired, reloads: g.reloads },
            gameNo: g.gameNo,
            dealIn: room.players.filter(p => p.hp > 0 && !g.roundPlayed.has(p.id)).length,
            results: g.results || null
        } : null
    };
}
function sendRoomState(room) {
    room.players.forEach(p => { if (p.connected && !p.isBot) io.to(p.id).emit('roomState', viewFor(room, p.id)); });
}
function privateMsg(p, ...lines) { if (p.connected && !p.isBot) io.to(p.id).emit('privateMsg', lines); }
const humansIn = room => room.players.filter(p => p.connected && !p.isBot);
function addLog(room, k, p) { io.to(room.id).emit('log', M(k, p)); }

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

    const remaining = humansIn(room);
    if (remaining.length === 0) {
        if (room.game) clearTimers(room.game);
        room.game = null;   // หยุดบอทที่อาจกำลังพิมพ์ค้างอยู่
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
    if (humansIn(room).length === 0) { rooms.delete(room.id); broadcastRoomList(); return; }
    if (!room.players.some(p => p.id === room.hostId)) room.hostId = humansIn(room)[0].id;
    sendRoomState(room);
    broadcastRoomList();
}

// ==========================================
// 5. ระบบเกม
// ==========================================
function clearTimers(g) {
    clearTimeout(g.timeout); clearInterval(g.interval); clearTimeout(g.botTimer);
    g.timeout = null; g.interval = null; g.botTimer = null;
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
        effects: { doubleDamage: false, inverted: false },
        phase: 'busy', letter: '?', timeLeft: 0, typing: '', message: null,
        usedWords: new Set(), word: '', botCardsThisTurn: 0, botPeek: null,
        gameNo: nextGameNo++, eliminated: [], stats: {}, results: null, roundPlayed: new Set(),
        timeout: null, interval: null
    };
    refillAndShuffleCrosses(room.game);
    io.to(room.id).emit('gameStarted');
    addLog(room, 'lNewGame');
    beginTurn(room);
    broadcastRoomList();
}

function markEliminated(g, p) {
    if (!g.eliminated.includes(p.id)) g.eliminated.push(p.id);
}

// อันดับ: คนรอด = ที่ 1, ที่เหลือเรียงจากคนที่ตายทีหลังสุด
function buildResults(room, winner) {
    const g = room.game;
    const order = [...(winner ? [winner.id] : []), ...[...g.eliminated].reverse()];
    room.players.forEach(p => { if (!order.includes(p.id)) order.push(p.id); });
    return order.map((id, i) => {
        const p = room.players.find(x => x.id === id);
        const st = g.stats[id] || { words: 0, longest: '' };
        return {
            id, name: p.name, rank: i + 1, avatar: room.players.indexOf(p),
            status: winner && id === winner.id ? 'winner' : (p.connected ? 'ghost' : 'left'),
            words: st.words, longest: st.longest
        };
    });
}

function checkGameOver(room) {
    const g = room.game;
    if (g.phase === 'over') return true;
    const alive = room.players.filter(p => p.hp > 0);
    if (alive.length > 1) return false;

    clearTimers(g);
    g.phase = 'over';
    if (alive.length === 1) {
        g.message = M('mGameOverWin', { p: P(alive[0]) });
        addLog(room, 'lWin', { p: P(alive[0]) });
    } else {
        g.message = M('mDraw');
        addLog(room, 'lDraw');
    }
    g.results = buildResults(room, alive[0]);
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

// ทุกคนที่ยังรอดเล่นครบ 1 รอบ -> แจกการ์ดคนละ 1 ใบ
function dealRound(room) {
    const g = room.game;
    const got = [];
    room.players.forEach(p => {
        if (p.hp <= 0 || p.cards.length >= HAND_MAX) return;
        p.cards.push(randomItem(Math.random() < RARE_CHANCE ? rareCardsPool : normalCardsPool));
        got.push(p.id);
    });
    g.roundPlayed.clear();
    addLog(room, 'lDeal');
    io.to(room.id).emit('dealt', got);
}

function scheduleIdle(room) {
    const cur = room.players[room.game.turnIndex];
    schedule(room, r => {
        addLog(r, 'lAfk', { p: P(cur) });
        nextTurn(r);
    }, IDLE_MS);
}

function beginTurn(room, extraTurn = false) {
    const g = room.game;
    if (checkGameOver(room)) return;
    const cur = room.players[g.turnIndex];
    g.letter = '?'; g.typing = ''; g.timeLeft = 0;
    // ผลการ์ด 🩸 กับ 🗡️ ใช้ได้แค่เทิร์นของคนที่ใช้
    g.effects.doubleDamage = false; g.effects.inverted = false;
    g.botPeek = null; g.botCardsThisTurn = 0;

    if (room.players.every(p => p.hp <= 0 || g.roundPlayed.has(p.id))) dealRound(room);
    g.roundPlayed.add(cur.id);

    // เทิร์นพิเศษ (สาปตัวเองเจอเงาลวง) ไม่โดนโซ่ตรวน — โซ่ตรวนยังรอคนถัดไป
    if (g.skipNextTurn && !extraTurn) {
        g.skipNextTurn = false;
        g.phase = 'busy';
        g.message = M('mSkipped', { p: P(cur) });
        addLog(room, 'lSkipped', { p: P(cur) });
        sendRoomState(room);
        schedule(room, nextTurn, 2500);
        return;
    }

    g.phase = 'idle';
    g.message = M('mTurnOf', { p: P(cur) });
    sendRoomState(room);
    if (!cur.isBot && cur.cards.length) privateMsg(cur, M('pYourTurnCards'));
    scheduleIdle(room);
    botAct(room);
}

// ใช้การ์ดก่อนกดเริ่มเทิร์น — ได้ผลทันที (ใช้ได้หลายใบ)
function useCard(room, idx) {
    const g = room.game;
    const me = room.players[g.turnIndex];
    const cardId = me.cards.splice(idx, 1)[0];
    g.botCardsThisTurn++;
    io.to(room.id).emit('cardPlayed', { playerId: me.id, cardId });
    const priv = applySkillEffect(room, g.turnIndex, cardId);

    if (cardId === 'Incense') {
        clearTimers(g);
        g.phase = 'busy';
        g.message = M('mIncenseEnd', { p: P(me) });
        sendRoomState(room);
        privateMsg(me, priv);
        schedule(room, nextTurn, 2500);
        return;
    }
    g.message = M('mUsedCard', { p: P(me), card: CARD(cardId) });
    sendRoomState(room);
    privateMsg(me, priv, M(me.cards.length ? 'pCardMore' : 'pCardStart'));
    scheduleIdle(room);
    botAct(room);
}

function startTurnPhase(room) {
    const g = room.game;
    const me = room.players[g.turnIndex];
    clearTimers(g);

    g.letter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    g.timeLeft = TURN_SECONDS;
    g.typing = '';
    g.phase = 'typing';
    g.message = M('mTyping', { p: P(me), letter: g.letter });
    sendRoomState(room);
    privateMsg(me, M('pTypePrompt', { letter: g.letter }));

    g.interval = setInterval(() => {
        if (g.timeLeft > 0) { g.timeLeft--; io.to(room.id).emit('tick', g.timeLeft); }
    }, 1000);
    g.timeout = setTimeout(() => {
        if (room.game === g && g.phase === 'typing') failTurn(room, M('rTimeout'));
    }, TURN_SECONDS * 1000 + GRACE_MS);
    botAct(room);
}

function validateWord(room, rawWord) {
    const g = room.game;
    const me = room.players[g.turnIndex];
    clearTimers(g);
    const word = String(rawWord ?? '').toUpperCase().trim().slice(0, 40);

    if (!word.startsWith(g.letter)) return failTurn(room, M('rWrongLetter', { letter: g.letter }));
    if (!dictionary.has(word)) return failTurn(room, M('rNotDict'));
    if (g.usedWords.has(word)) return failTurn(room, M('rUsed'));
    if (word.length < 3) return failTurn(room, M('rShort'));

    g.usedWords.add(word);
    const st = g.stats[me.id] ||= { words: 0, longest: '' };
    st.words++;
    if (word.length > st.longest.length) st.longest = word;
    g.word = word;
    g.typing = word;

    g.phase = 'target';
    g.message = M('mChoosing', { p: P(me), word });
    sendRoomState(room);
    privateMsg(me, M('pSuccess'), M('pChoose'));
    schedule(room, r => {
        const alive = r.players.map((p, i) => i).filter(i => r.players[i].hp > 0);
        addLog(r, 'lTargetTimeout', { p: P(me) });
        attackTarget(r, randomItem(alive));
    }, TARGET_MS);
    botAct(room);
}

function failTurn(room, reason) {
    const g = room.game;
    const me = room.players[g.turnIndex];
    clearTimers(g);
    g.phase = 'busy';
    g.message = M('mFail', { p: P(me), reason });
    addLog(room, 'lFail', { p: P(me) });
    sendRoomState(room);
    privateMsg(me, reason, M('pFail'));
    schedule(room, nextTurn, 3000);
}

// คืนข้อความส่วนตัวให้คนใช้การ์ด ส่วนคนอื่นเห็นใน log
function applySkillEffect(room, playerIdx, cardId) {
    const g = room.game;
    const p = room.players[playerIdx];
    if (g.crossPool.length === 0) refillAndShuffleCrosses(g);

    addLog(room, 'lUsedCard', { p: P(p), card: CARD(cardId) });

    switch (cardId) {
        case "Ouija":
            addLog(room, 'lOuija', { p: P(p) });
            if (p.isBot) g.botPeek = { id: p.id, real: g.crossPool[0] === 'real' };
            return M(g.crossPool[0] === 'real' ? 'effOuijaReal' : 'effOuijaFake');
        case "Incense": {
            const discarded = g.crossPool.shift(); g.thrown++;
            if (discarded === 'real') g.realThrown++; else g.fakeThrown++;
            g.fired.push(discarded);
            if (g.botPeek) g.botPeek = null;
            addLog(room, 'lIncense');
            return M('effIncense');
        }
        case "Soul":
            p.hp = Math.min(p.hp + 1, 3);
            addLog(room, 'lSoul');
            return M('effSoul');
        case "Blood":
            g.effects.inverted = !g.effects.inverted;
            addLog(room, 'lBlood');
            return M('effBlood');
        case "Chains":
            g.skipNextTurn = true;
            addLog(room, 'lChains');
            return M('effChains');
        case "Stake":
            g.effects.doubleDamage = true;
            addLog(room, 'lStake');
            return M('effStake');
    }
    return null;
}

const SUSPENSE_MS = 1800;   // ร่ายคาถาแล้วรอลุ้นก่อนเฉลยผล

function attackTarget(room, targetIdx) {
    const g = room.game;
    const me = room.players[g.turnIndex];
    const target = room.players[targetIdx];
    clearTimers(g);
    if (g.crossPool.length === 0) refillAndShuffleCrosses(g);

    const isSelf = targetIdx === g.turnIndex;
    const tRef = isSelf ? '@self' : P(target);
    g.phase = 'firing';
    g.message = isSelf ? M('mCastSelf', { p: P(me) }) : M('mCast', { p: P(me), t: tRef });
    addLog(room, 'lAttack', { p: P(me), word: g.word, t: tRef });
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
            if (target.hp === 0) markEliminated(g, target);
            g.message = M('mReal', { t: P(target), dmg });
            addLog(room, 'lReal', { dmg });
        } else if (isSelf) {
            // สาปตัวเองแล้วเป็นเงาลวง -> ได้เล่นอีกเทิร์น
            g.message = M('mFakeExtra', { p: P(me) });
            addLog(room, 'lFake');
            addLog(room, 'lExtraTurn', { p: P(me) });
        } else {
            g.message = M('mFake', { t: P(target) });
            addLog(room, 'lFake');
        }
        g.effects.doubleDamage = false;
        g.phase = 'busy';
        io.to(room.id).emit('shotResult', { targetId: target.id, real: isReal, dmg });

        if (checkGameOver(room)) return;
        sendRoomState(room);
        if (isSelf && !isReal) schedule(room, r => beginTurn(r, true), 3000);
        else schedule(room, nextTurn, 3000);
    }, SUSPENSE_MS);
}

// ==========================================
// 5.5 บอท (เซิร์ฟเวอร์เล่นแทน)
// ==========================================
const BOT_NAMES = ['กระสือ', 'ปอบ', 'แม่นาค', 'เปรต', 'กระหัง', 'ผีตายโหง', 'นางตานี', 'ผีกองกอย'];
let nextBotId = 1;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const between = (a, b) => a + Math.random() * (b - a);

function addBot(room) {
    const name = BOT_NAMES.find(n => !room.players.some(p => p.name === n)) || `Bot ${nextBotId}`;
    room.players.push({ id: `bot-${nextBotId++}`, name, hp: 3, cards: [], connected: true, isBot: true });
}

// บอทเลือกการ์ดที่จะใช้ก่อนเริ่มเทิร์น (หรือ null = ไม่ใช้)
function botPickCard(room, bot) {
    const g = room.game;
    const has = id => bot.cards.includes(id);
    const peek = g.botPeek && g.botPeek.id === bot.id ? (g.botPeek.real !== g.effects.inverted) : null;
    if (has('Soul') && bot.hp < 3) return 'Soul';
    if (has('Ouija') && peek === null) return 'Ouija';
    if (peek === true && has('Stake') && !g.effects.doubleDamage) return 'Stake';
    if (peek === false && has('Blood')) return 'Blood';           // เปลี่ยนเงาลวงให้เป็นวิญญาณร้ายแล้วสาปคนอื่น
    if (peek === null) {
        if (has('Incense') && bot.hp === 1 && Math.random() < 0.5) return 'Incense';
        if (has('Chains') && Math.random() < 0.35) return 'Chains';
        if (has('Stake') && !g.effects.doubleDamage && Math.random() < 0.25) return 'Stake';
    }
    return null;
}

// ให้บอทที่ถึงเทิร์นทำอะไรสักอย่างตามเฟส
function botAct(room) {
    const g = room.game;
    const bot = room.players[g.turnIndex];
    if (!bot || !bot.isBot) return;
    const phase = g.phase;
    const stillMyMove = () => room.game === g && g.phase === phase && room.players[g.turnIndex] === bot;

    if (phase === 'idle') {
        g.botTimer = setTimeout(() => {
            if (!stillMyMove()) return;
            const card = g.botCardsThisTurn < 3 ? botPickCard(room, bot) : null;
            if (card) useCard(room, bot.cards.indexOf(card));
            else startTurnPhase(room);
        }, between(1200, 2500));
    } else if (phase === 'typing') {
        g.botTimer = setTimeout(async () => {
            if (!stillMyMove()) return;
            let word = null;
            if (Math.random() > 0.1) {   // พลาดบ้าง ~10%
                const pool = botWords[g.letter] || [];
                for (let i = 0; i < 30 && pool.length; i++) {
                    const w = randomItem(pool);
                    if (!g.usedWords.has(w)) { word = w; break; }
                }
            }
            word ||= g.letter + 'ZQX';
            // พิมพ์ทีละตัวให้คนอื่นเห็น
            for (let i = 1; i <= word.length; i++) {
                if (!stillMyMove()) return;
                g.typing = word.slice(0, i);
                io.to(room.id).emit('typing', g.typing);
                await sleep(between(90, 170));
            }
            if (stillMyMove()) validateWord(room, word);
        }, between(1500, 3500));
    } else if (phase === 'target') {
        g.botTimer = setTimeout(() => {
            if (!stillMyMove()) return;
            const myIdx = g.turnIndex;
            const others = room.players.map((p, i) => i).filter(i => i !== myIdx && room.players[i].hp > 0);
            let target = randomItem(others);
            // ถ้าแอบดูแล้วรู้ว่าดวงต่อไปเป็นเงาลวง -> สาปตัวเองให้ปลอดภัย
            if (g.botPeek && g.botPeek.id === bot.id) {
                const real = g.botPeek.real !== !!g.effects.inverted;
                if (!real) target = myIdx;
            } else {
                // ใช้จำนวนร้าย/ลวงที่เหลือ (ทุกคนเห็นได้) — เงาลวงเยอะกว่า = สาปตัวเองเพื่อลุ้นเทิร์นพิเศษ
                const realLeft = g.crossPool.filter(c => c === 'real').length;
                const fakeLeft = g.crossPool.length - realLeft;
                if (g.crossPool.length && fakeLeft > realLeft && Math.random() < 0.7) target = myIdx;
                else if (Math.random() < 0.05) target = myIdx;
            }
            g.botPeek = null;
            attackTarget(room, target);
        }, between(1000, 2200));
    }
}

function handleInGameLeave(room, idx) {
    const g = room.game;
    const p = room.players[idx];
    if (g.phase === 'over') { p.connected = false; return; }
    if (p.hp > 0) markEliminated(g, p);
    p.connected = false; p.hp = 0; p.cards = [];
    addLog(room, 'lLeft', { p: P(p) });
    if (checkGameOver(room)) return;
    if (g.turnIndex === idx) {
        g.phase = 'busy';
        g.message = M('mLeftSkip', { p: P(p) });
        schedule(room, nextTurn, 1500);
    }
}

// ==========================================
// 6. Socket events
// ==========================================
io.on('connection', socket => {
    const err = k => socket.emit('errorMsg', M(k));
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
        if (!room) return err('eNotFound');
        if (socket.data.roomId === room.id) return sendRoomState(room);
        if (room.status !== 'waiting') return err('ePlaying');
        if (room.players.length >= room.max) return err('eFull');
        leaveCurrentRoom(socket);
        addPlayer(room, socket, playerName);
    });

    // หน้าสรุปผล -> กด "เล่นอีกครั้ง": พาทั้งห้องกลับห้องรอ
    socket.on('playAgain', () => {
        const room = myRoom();
        if (!room) return;
        if (room.status === 'playing' && room.game.phase === 'over') resetRoom(room);
        else sendRoomState(room);
    });

    socket.on('leaveRoom', () => {
        leaveCurrentRoom(socket);
        socket.emit('roomList', roomList());
    });

    // หัวห้องเพิ่ม/ลบบอทในห้องรอ
    socket.on('addBot', () => {
        const room = myRoom();
        if (!room || room.hostId !== socket.id || room.status !== 'waiting') return;
        if (room.players.length >= room.max) return err('eFull');
        addBot(room);
        sendRoomState(room);
        broadcastRoomList();
    });

    socket.on('removeBot', botId => {
        const room = myRoom();
        if (!room || room.hostId !== socket.id || room.status !== 'waiting') return;
        const idx = room.players.findIndex(p => p.id === botId && p.isBot);
        if (idx === -1) return;
        room.players.splice(idx, 1);
        sendRoomState(room);
        broadcastRoomList();
    });

    socket.on('startGame', () => {
        const room = myRoom();
        if (!room || room.hostId !== socket.id || room.status !== 'waiting') return;
        if (room.players.length < 2) return err('eNeedTwo');
        if (!dictionaryReady) return err('eDict');
        startGame(room);
    });

    socket.on('startTurn', () => {
        const ctx = myTurn('idle');
        if (ctx) startTurnPhase(ctx.room);
    });

    socket.on('useCard', index => {
        const ctx = myTurn('idle');
        if (!ctx) return;
        const idx = Number(index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= ctx.me.cards.length) return;
        useCard(ctx.room, idx);
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
