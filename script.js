// ==========================================
// 1. ระบบจัดการหน้าจอและห้อง (Room System)
// ==========================================
let rooms = [
    { id: 1, name: "KAIJA", max: 5, current: 5 },
    { id: 2, name: "KIMSOK", max: 3, current: 3 },
    { id: 3, name: "HIWKAW", max: 5, current: 5 },
    { id: 4, name: "JIMMYMEMS", max: 3, current: 2 },
    { id: 5, name: "KISSME", max: 5, current: 3 },
    { id: 6, name: "HIWGO", max: 3, current: 2 }
];

let createSize = 3; 

function showScreen(screenId) {
    document.getElementById('main-menu-screen').classList.add('hidden');
    document.getElementById('join-room-screen').classList.add('hidden');
    document.getElementById('create-room-screen').classList.add('hidden');
    document.getElementById('game-board-screen').classList.add('hidden');
    document.getElementById(screenId).classList.remove('hidden');
}

function renderRooms() {
    const grid = document.getElementById('room-grid');
    grid.innerHTML = '';

    rooms.forEach(room => {
        let skullHTML = '';
        for(let i=0; i<room.current; i++) skullHTML += '💀';
        if(room.current < room.max) {
            skullHTML += `<span class="skull-missing">`;
            for(let i=room.current; i<room.max; i++) skullHTML += '💀';
            skullHTML += `</span>`;
        }
        
        let statusClass = room.current === room.max ? 'red' : 'green';
        let clickableClass = room.current < room.max ? 'clickable' : '';
        let onclickAction = room.current < room.max ? `onclick="enterGameRoom(${room.max})"` : '';

        grid.innerHTML += `
            <div class="room-card ${clickableClass}" ${onclickAction}>
                <div class="room-fraction">${room.max}/${room.current}</div>
                <div class="room-info">
                    <div class="room-name">${room.name}</div>
                    <div class="room-skulls">${skullHTML}</div>
                </div>
                <div class="status-light ${statusClass}"></div>
            </div>
        `;
    });
}

function selectRoomSize(size) {
    createSize = size;
    document.getElementById('btn-size-3').classList.remove('selected');
    document.getElementById('btn-size-5').classList.remove('selected');
    document.getElementById(`btn-size-${size}`).classList.add('selected');
}

function createNewRoom() {
    let nameInput = document.getElementById('new-room-name').value.trim();
    if (nameInput === "") nameInput = "MY ROOM";
    rooms.push({ id: rooms.length + 1, name: nameInput, max: createSize, current: 1 });
    document.getElementById('new-room-name').value = ""; 
    renderRooms(); 
    showScreen('join-room-screen'); 
}

// ==========================================
// 2. ระบบเตรียมผู้เล่นเข้าเกม & Action Log
// ==========================================
let players = [];
const enemyNamesList = ["Slenderman", "Plant Monster", "Vampire", "Ghost"];

let usedWords = new Set();
let currentTypedWord = ""; 

function addLog(htmlStr) {
    const logBox = document.getElementById('log-content');
    const entry = document.createElement('div');
    entry.innerHTML = htmlStr;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight; 
}

function enterGameRoom(maxPlayers) {
    players = [{ id: 0, hp: 3, cards: [], name: "YOU (คุณ)" }];
    for (let i = 1; i < maxPlayers; i++) {
        players.push({ id: i, hp: 3, cards: [], name: enemyNamesList[i-1] });
    }

    let gameBoard = document.getElementById('game-board-screen');
    gameBoard.className = `game-board layout-${maxPlayers}`;

    for (let i = 1; i <= 4; i++) {
        let el = document.getElementById(`player-${i}`);
        if (i < maxPlayers) {
            el.querySelector('.name').innerText = enemyNamesList[i-1];
            el.classList.remove("dead-player"); 
            updateBotCardsUI(i);
        }
    }

    usedWords.clear();
    document.getElementById('log-content').innerHTML = "";
    addLog(`<span class="log-sys">-- เริ่มเกมใหม่ --</span>`);

    refillAndShuffleCrosses();
    updateCrossUI();
    updateHpUI();
    updateCardsUI();
    showScreen('game-board-screen');
    
    currentPlayerTurn = 0;
    ui.message.innerText = "เกมเริ่มแล้ว! ถึงเทิร์นของคุณ";
    ui.startBtn.style.display = "inline-block";
    ui.startBtn.innerText = "เริ่มเทิร์นของคุณ";
}

// ==========================================
// 3. ระบบโหลดพจนานุกรม
// ==========================================
let dictionary = new Set();
let isDictionaryLoaded = false;
const dictionaryUrl = 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt';

fetch(dictionaryUrl)
    .then(response => response.text())
    .then(text => {
        const wordsArray = text.split(/\r?\n/).map(w => w.trim().toUpperCase());
        dictionary = new Set(wordsArray);
        isDictionaryLoaded = true;
        document.getElementById("message-box").innerText = "โหลดพจนานุกรมออนไลน์สำเร็จ! พร้อมเล่น";
    }).catch(err => {
        document.getElementById("message-box").innerText = "ใช้ศัพท์สำรอง (ไม่มีเน็ต)";
        dictionary = new Set(["SAW", "SOUL", "SKULL", "SCARE", "SAD", "MONSTER", "NIGHTMARE", "VAMPIRE", "GHOST"]);
        isDictionaryLoaded = true;
    });

// ==========================================
// 4. ข้อมูลการ์ดและสถานะเกม (Game State)
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

let crossPool = [];
let totalCrosses = 5, thrownCrosses = 0, realThrown = 0, fakeThrown = 0;
let timer, timeLeft = 5, currentLetter = "", isSkillMode = false, selectedCardIndex = -1;

let currentPlayerTurn = 0; 
let skipNextTurn = false; 
let activeEffects = { doubleDamage: false, inverted: false, skipStabPhase: false };

const ui = {
    letter: document.getElementById("target-letter"),
    time: document.getElementById("time"),
    input: document.getElementById("word-input"),
    message: document.getElementById("message-box"),
    startBtn: document.getElementById("start-btn"),
    targets: document.getElementById("target-selection"),
    crossStatus: document.getElementById("cross-status"),
    myCards: document.getElementById("my-cards-container")
};

function refillAndShuffleCrosses() {
    let newPool = ['real', 'real', 'real', 'fake', 'fake'];
    for (let i = newPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newPool[i], newPool[j]] = [newPool[j], newPool[i]];
    }
    crossPool = newPool;
    thrownCrosses = 0; realThrown = 0; fakeThrown = 0;
}

function updateCrossUI() {
    ui.crossStatus.innerHTML = `✝️ จริง: ${3 - realThrown} | ✝️ ปลอม: ${2 - fakeThrown}<br><span style="font-size: 14px; color: #aaa;">สถานะ: ${totalCrosses}/${thrownCrosses}</span>`;
}

function updateHpUI() {
    players.forEach(p => {
        let hpStr = "";
        for(let j = 0; j < p.hp; j++) hpStr += "🩸 ";
        let hpEl = document.getElementById(`hp-${p.id}`);
        if (p.hp > 0) {
            hpEl.innerText = hpStr;
        } else {
            hpEl.innerText = "💀 ตาย";
            document.getElementById(`player-${p.id}`).classList.add("dead-player");
        }
    });
}

function updateCardsUI() {
    ui.myCards.innerHTML = "";
    players[0].cards.forEach((cardId, index) => {
        let cardData = cardsData[cardId];
        let btn = document.createElement("button");
        btn.className = `skill-card ${cardData.tier === 'rare' ? 'card-rare' : 'card-normal'}`;
        btn.innerText = cardData.name;
        btn.onclick = () => startSkillTurn(index);
        ui.myCards.appendChild(btn);
    });
}

function updateBotCardsUI(botId) {
    let el = document.getElementById(`player-${botId}`);
    let cardsHiddenEl = el.querySelector('.cards-hidden');
    let cardsCount = players[botId].cards.length;
    if (cardsCount === 0) {
        cardsHiddenEl.innerText = "ไม่มีการ์ด";
    } else {
        let icons = "";
        for (let i=0; i<cardsCount; i++) icons += "🎴";
        cardsHiddenEl.innerText = `${icons} (ซ่อน)`;
    }
}

// ==========================================
// 5. ระบบหมุนเวียนเทิร์น (Turn Loop System)
// ==========================================
function nextTurn() {
    if (checkGameOver()) return;

    currentPlayerTurn++;
    if (currentPlayerTurn >= players.length) currentPlayerTurn = 0;

    let currentPlayer = players[currentPlayerTurn];

    if (currentPlayer.hp <= 0) {
        nextTurn();
        return;
    }

    if (skipNextTurn) {
        skipNextTurn = false;
        ui.message.innerText = `⛓️ ${currentPlayer.name} ถูกข้ามเทิร์น!`;
        addLog(`<span class="log-sys">⛓️ ${currentPlayer.name} ถูกข้ามเทิร์น</span>`);
        setTimeout(nextTurn, 2500);
        return;
    }

    if (currentPlayerTurn === 0) {
        ui.message.innerText = "ถึงเทิร์นของคุณแล้ว!";
        ui.startBtn.style.display = "inline-block";
        ui.startBtn.innerText = "เริ่มเทิร์นของคุณ";
    } else {
        ui.message.innerText = `เทิร์นของ ${currentPlayer.name} (กำลังหาคำศัพท์...)`;
        ui.startBtn.style.display = "none";
        setTimeout(() => { playBotTurn(currentPlayerTurn); }, 2000);
    }
}

// ==========================================
// 6. AI ของบอท (Bot Logic)
// ==========================================
function playBotTurn(botId) {
    if (checkGameOver()) return;
    if (crossPool.length === 0) refillAndShuffleCrosses();

    let botPlayer = players[botId];
    let alivePlayers = players.filter(p => p.hp > 0);

    // 1. บอทหาคำศัพท์
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let botLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
    ui.letter.innerText = botLetter; // โชว์อักษรบนกระดานให้สมจริง

    // กรองหาคำศัพท์ที่ตรงเงื่อนไขและยังไม่ถูกใช้
    let validWords = [];
    for (let word of dictionary) {
        if (word.startsWith(botLetter) && word.length >= 3 && !usedWords.has(word)) {
            validWords.push(word);
        }
    }

    if (validWords.length === 0) {
        // กรณีบอทหาคำศัพท์ไม่เจอ (หายากมาก)
        addLog(`<span class="log-sys">${botPlayer.name} นึกคำศัพท์ไม่ออก! ข้ามเทิร์น</span>`);
        ui.message.innerText = `${botPlayer.name} นึกคำไม่ออก!`;
        setTimeout(nextTurn, 2500);
        return;
    }

    // สุ่มเลือก 1 คำ
    let botWord = validWords[Math.floor(Math.random() * validWords.length)];
    usedWords.add(botWord);
    ui.input.value = botWord; // พิมพ์โชว์ในช่อง Input

    // บอทได้การ์ดไหม?
    if (botWord.length >= 5) {
        let tier = botWord.length >= 8 ? 'rare' : 'normal';
        let pool = tier === 'rare' ? rareCardsPool : normalCardsPool;
        botPlayer.cards.push(pool[Math.floor(Math.random() * pool.length)]);
        addLog(`<span class="log-sys">✨ ${botPlayer.name} ได้รับการ์ด 1 ใบ</span>`);
        updateBotCardsUI(botId);
    }

    // 2. บอทใช้สกิล (มีโอกาส 70% ถ้ามีการ์ดในมือ)
    if (botPlayer.cards.length > 0 && Math.random() < 0.7) {
        let usedCardId = botPlayer.cards.shift(); // ใช้ใบแรกสุด
        applySkillEffect(botId, usedCardId);
        updateBotCardsUI(botId);
        
        // ถ้าบอทใช้ธูปบูชา จะปัดข้ามการโจมตี
        if (activeEffects.skipStabPhase) {
            activeEffects.skipStabPhase = false;
            setTimeout(nextTurn, 3000);
            return;
        }
    }

    // 3. บอทเลือกโจมตี
    setTimeout(() => {
        let randomTarget = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
        let targetName = randomTarget.id === 0 ? "YOU" : randomTarget.name;
        let tClass = randomTarget.id === 0 ? "log-p-0" : "log-p-enemy";
        
        addLog(`<span class="log-p-enemy">${botPlayer.name}</span> ใช้คำว่า <span class="log-word">${botWord}</span> โจมตี <span class="${tClass}">${targetName}</span>`);

        let drawnCross = crossPool.shift(); 
        thrownCrosses++;
        
        let isReal = (drawnCross === 'real');
        if (activeEffects.inverted) { isReal = !isReal; activeEffects.inverted = false; }
        if (isReal) realThrown++; else fakeThrown++;

        let resultMsg = "";
        if (isReal) {
            let dmg = activeEffects.doubleDamage ? 2 : 1;
            randomTarget.hp -= dmg;
            resultMsg = `🔴 ${botPlayer.name} ปาไม้กางเขนจริงใส่ ${targetName}!`;
            addLog(`- <span class="log-real">กางเขนจริง!</span> ทำดาเมจ ${dmg}`);
        } else {
            resultMsg = `⚪ ${botPlayer.name} ปาไม้กางเขนปลอมใส่ ${targetName}`;
            addLog(`- <span class="log-fake">กางเขนปลอม!</span> รอดตัวไป`);
        }

        activeEffects.doubleDamage = false; 

        updateCrossUI(); 
        updateHpUI();
        ui.message.innerText = resultMsg;

        if (checkGameOver()) return;
        setTimeout(nextTurn, 3500);
    }, 1500); // หน่วงเวลาให้เห็นคำศัพท์นิดนึง
}

// ==========================================
// 7. การเล่นเทิร์นของผู้เล่น (คุณ)
// ==========================================
function startNormalTurn() { startTurnPhase(false, -1); }
function startSkillTurn(index) {
    if (!ui.input.disabled && ui.startBtn.style.display === "none") return;
    startTurnPhase(true, index);
}

function startTurnPhase(skillMode, cardIndex) {
    if (!isDictionaryLoaded || currentPlayerTurn !== 0) return;
    
    isSkillMode = skillMode; selectedCardIndex = cardIndex;
    currentLetter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    timeLeft = 5;
    
    ui.letter.innerText = currentLetter;
    ui.time.innerText = timeLeft;
    ui.input.value = ""; ui.input.disabled = false; ui.input.focus();
    ui.startBtn.style.display = "none"; ui.targets.classList.add("hidden");

    ui.message.innerText = isSkillMode ? `ใช้สกิล! รีบพิมพ์ศัพท์ที่ขึ้นต้นด้วย ${currentLetter}` : `พิมพ์ศัพท์ที่ขึ้นต้นด้วย ${currentLetter} (ยาว 3 ขึ้นไป)`;

    timer = setInterval(() => {
        timeLeft--; ui.time.innerText = timeLeft;
        if (timeLeft <= 0) { clearInterval(timer); failTurn("หมดเวลา!"); }
    }, 1000);
}

ui.input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") validateWord(ui.input.value.toUpperCase().trim());
});

function validateWord(word) {
    clearInterval(timer);
    if (!word.startsWith(currentLetter)) return failTurn(`ผิด! ต้องขึ้นต้นด้วย ${currentLetter}`);
    if (!dictionary.has(word)) return failTurn("ไม่มีศัพท์นี้ในพจนานุกรม");
    
    if (usedWords.has(word)) return failTurn("พลาด! คำนี้ถูกใช้ไปแล้ว");
    
    let len = word.length;
    if (len < 3) return failTurn("ศัพท์ต้องยาว 3 ตัวอักษรขึ้นไป");

    usedWords.add(word);
    currentTypedWord = word; 

    ui.input.disabled = true;
    let successMsg = "เยี่ยมมาก! ได้สิทธิ์ปาไม้กางเขน";
    
    if (len >= 5) {
        let tier = len >= 8 ? 'rare' : 'normal';
        let pool = tier === 'rare' ? rareCardsPool : normalCardsPool;
        players[0].cards.push(pool[Math.floor(Math.random() * pool.length)]);
        successMsg += `\n+ ได้การ์ดระดับ ${tier.toUpperCase()}!`;
    }

    if (isSkillMode) {
        let usedCardId = players[0].cards.splice(selectedCardIndex, 1)[0];
        successMsg += applySkillEffect(0, usedCardId);
    }
    updateCardsUI();

    if (activeEffects.skipStabPhase) {
        ui.message.innerText = successMsg;
        activeEffects.skipStabPhase = false; 
        setTimeout(nextTurn, 3000); 
        return;
    }

    successMsg += "\nเลือกเป้าหมายที่จะปา!";
    ui.message.innerText = successMsg;
    
    ui.targets.innerHTML = "";
    players.forEach(p => {
        if (p.hp > 0) {
            let btn = document.createElement("button");
            btn.className = "btn-stab";
            btn.innerText = (p.id === 0) ? "ปาใส่ตัวเอง" : `ปาใส่ ${p.name}`;
            btn.onclick = () => attackTarget(p.id);
            ui.targets.appendChild(btn);
        }
    });
    ui.targets.classList.remove("hidden");
}

function failTurn(reason) {
    ui.input.disabled = true;
    if (isSkillMode) {
        let lostCard = cardsData[players[0].cards.splice(selectedCardIndex, 1)[0]].name;
        updateCardsUI();
        reason += `\nถูกยึดการ์ด [${lostCard}]!`;
    }
    ui.message.innerText = reason + "\nหมดสิทธิ์ปาไม้กางเขนในเทิร์นนี้!";
    addLog(`<span class="log-sys">YOU พิมพ์พลาดและเสียเทิร์น</span>`);
    setTimeout(nextTurn, 3000);
}

// ==========================================
// 8. การใช้งานไอเทมร่วมกัน (Player & Bot)
// ==========================================
function applySkillEffect(playerId, cardId) {
    if (crossPool.length === 0) refillAndShuffleCrosses(); 
    
    let playerName = playerId === 0 ? "YOU" : players[playerId].name;
    let pClass = playerId === 0 ? "log-p-0" : "log-p-enemy";
    let cardName = cardsData[cardId].name;
    
    addLog(`<span class="${pClass}">${playerName}</span> ใช้สกิล <span class="log-card">[${cardName}]</span>`);

    switch (cardId) {
        case "Ouija": 
            if (playerId === 0) return `\n👁️ อันบนสุดคือ [${crossPool[0] === 'real' ? "🔴ของจริง" : "⚪ของปลอม"}]!`;
            else { addLog(`- <span class="log-sys">${playerName} แอบดูไม้กางเขน!</span>`); return ""; }
        case "Incense": 
            let discarded = crossPool.shift(); thrownCrosses++;
            if(discarded === 'real') realThrown++; else fakeThrown++;
            updateCrossUI(); activeEffects.skipStabPhase = true; 
            if (playerId === 0) return `\n🔥 ปัดไม้กางเขนทิ้งไป 1 อัน!`;
            else { addLog(`- <span class="log-sys">ปัดไม้กางเขนทิ้ง 1 อันอย่างปลอดภัย</span>`); return ""; }
        case "Soul": 
            players[playerId].hp = Math.min(players[playerId].hp + 1, 3); updateHpUI();
            if (playerId === 0) return `\n🌑 ฟื้นฟู HP 1 หน่วย!`;
            else { addLog(`- <span class="log-sys">ฟื้นฟูเลือด 1 ขีด</span>`); return ""; }
        case "Blood": 
            activeEffects.inverted = true; 
            if (playerId === 0) return `\n🩸 สลับสถานะกางเขนอันต่อไป!`;
            else { addLog(`- <span class="log-sys">สลับสถานะกางเขนอันต่อไป!</span>`); return ""; }
        case "Chains": 
            skipNextTurn = true; 
            if (playerId === 0) return `\n⛓️ ผู้เล่นคนถัดไปจะถูกข้ามเทิร์น!`;
            else { addLog(`- <span class="log-sys">เตรียมข้ามเทิร์นคนถัดไป!</span>`); return ""; }
        case "Stake": 
            activeEffects.doubleDamage = true; 
            if (playerId === 0) return `\n🗡️ หากเป็นของจริงจะทำดาเมจ x2!`;
            else { addLog(`- <span class="log-sys">เสริมพลังทำดาเมจ x2!</span>`); return ""; }
    }
    return "";
}

function attackTarget(targetId) {
    ui.targets.classList.add("hidden");
    if (crossPool.length === 0) refillAndShuffleCrosses();

    let drawnCross = crossPool.shift(); thrownCrosses++;
    let isReal = (drawnCross === 'real');
    
    if (activeEffects.inverted) { isReal = !isReal; activeEffects.inverted = false; }
    if (drawnCross === 'real') realThrown++; else fakeThrown++;
    
    let targetName = targetId === 0 ? "ตัวเอง" : players[targetId].name;
    let tClass = targetId === 0 ? "log-p-0" : "log-p-enemy";
    addLog(`<span class="log-p-0">YOU</span> ใช้คำว่า <span class="log-word">${currentTypedWord}</span> โจมตี <span class="${tClass}">${targetName}</span>`);

    let resultMsg = "";
    if (isReal) {
        let dmg = activeEffects.doubleDamage ? 2 : 1;
        players[targetId].hp -= dmg; 
        resultMsg = `🔴 ไม้กางเขนจริง! ${targetName} โดนไป ${dmg} ดาเมจ`;
        addLog(`- <span class="log-real">กางเขนจริง!</span> ทำดาเมจ ${dmg}`);
    } else {
        resultMsg = `⚪ ไม้กางเขนปลอม! ไม่มีอะไรเกิดขึ้น`;
        addLog(`- <span class="log-fake">กางเขนปลอม!</span>`);
    }
    activeEffects.doubleDamage = false; 

    updateCrossUI(); updateHpUI();
    ui.message.innerText = resultMsg;

    if (checkGameOver()) return; 
    setTimeout(nextTurn, 3000);
}

function checkGameOver() {
    let alive = players.filter(p => p.hp > 0);
    if (alive.length === 1) {
        ui.message.innerHTML = `🎉 <b>จบเกม! ${alive[0].name} รอดชีวิตเป็นคนสุดท้าย!</b> 🎉`;
        addLog(`<span class="log-sys">🎉 จบเกม! ${alive[0].name} ชนะ!</span>`);
        ui.startBtn.style.display = "none"; return true; 
    }
    if (alive.length === 0) {
        ui.message.innerHTML = `💀 <b>ตายเรียบ! เสมอกัน!</b> 💀`;
        addLog(`<span class="log-sys">💀 ตายเรียบ! เสมอกัน!</span>`);
        ui.startBtn.style.display = "none"; return true;
    }
    return false; 
}