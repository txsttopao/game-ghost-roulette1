// ==========================================
// ภาษา ไทย / English
// เซิร์ฟเวอร์ส่งข้อความมาเป็น { k: รหัสข้อความ, p: ข้อมูล } แล้วแปลที่เครื่องผู้เล่นแต่ละคน
// ==========================================
const STR = {
    th: {
        // ---- หน้าเว็บ ----
        offline: '⚠️ ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์เกม — ปิดหน้านี้ แล้ว <b>ดับเบิลคลิกไฟล์ start.bat</b> ในโฟลเดอร์เกม (เกมจะเปิดขึ้นมาเอง)',
        soundTitle: 'เปิด/ปิดเสียง', langTitle: 'เปลี่ยนภาษา',
        subtitle: 'SPELL TO SURVIVE · สะกดให้รอด แล้วปล่อยวิญญาณ',
        chatTitle: '💬 แชท', chatPh: 'พิมพ์ข้อความ...', chatSend: 'ส่ง', chatEmpty: 'ยังไม่มีข้อความ ทักทายกันหน่อย 👋', chatToggle: 'เปิด/ปิดแชท', chatBtn: 'แชท', soundOn: 'เสียง: เปิด', soundOff: 'เสียง: ปิด',
        cJoin: '👋 {p} เข้าห้องมา', cLeave: '🚪 {p} ออกจากห้อง',
        menuJoin: 'เข้าห้อง', menuCreate: 'สร้างห้อง', menuRule: 'กติกา', menuSetting: 'ตั้งค่า',
        btnCreate: 'สร้างห้อง', btnStart: 'เริ่มเกม',
        back: 'กลับ', leaveRoom: 'ออกจากห้อง', close: 'ปิด',
        phName: 'ชื่อของคุณ', phRoom: 'ชื่อห้อง',
        lblYourName: 'ชื่อของคุณ', lblRoomName: 'ชื่อห้อง', lblPlayers: 'จำนวนผู้เล่น',
        addBot: '+ เพิ่มบอท', phWord: 'พิมพ์ศัพท์...', waitingStart: 'รอเริ่มเกม...',
        startTurn: 'เริ่มเทิร์นของคุณ', logTitle: '📜 บันทึกพิธี',
        resRank: 'อันดับ', resPlayer: 'ผู้เล่น', resStatus: 'สถานะ', resWords: 'คำที่ใช้', resLongest: 'คำยาวสุด',
        btnHome: 'กลับหน้าแรก', btnAgain: 'เล่นอีกครั้ง',
        setName: '👤 ชื่อผู้เล่น', setNameSub: 'ใช้เป็นชื่อเริ่มต้นตอนสร้าง/เข้าห้อง',
        setLang: '🌐 ภาษา', setLangSub: 'ภาษาของเกมบนเครื่องคุณ',
        setSound: '🔊 เสียง', setSoundSub: 'เสียงผี การ์ด และเอฟเฟกต์ทั้งหมด',
        setVolume: '🎚️ ระดับเสียง', setTest: 'ลองฟัง',
        setShake: '💥 จอสั่น & แฟลช', setShakeSub: 'ตอนมีคนโดนวิญญาณร้าย (ปิดถ้าเวียนหัว)',
        setBg: '✨ แอนิเมชันพื้นหลัง', setBgSub: 'หมอกและผีลอย (ปิดถ้าเครื่องช้า)',
        setReset: 'คืนค่าเริ่มต้น', setDone: 'เสร็จ',

        // ---- ข้อความที่สร้างในหน้าเว็บ ----
        roomEmpty: 'ยังไม่มีห้องเปิดอยู่', roomEmptyCreate: '+ สร้างห้องใหม่',
        roomNoServer: 'ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ เลยโหลดรายชื่อห้องไม่ได้',
        join: 'JOIN', full: 'เต็ม', playing: 'กำลังเล่น',
        lobbyCount: 'ผู้เล่น {n}/{max}', botTag: '(บอท)', youTag: '(คุณ)', waitingSeat: 'รอผู้เล่น...', removeBot: 'เอาบอทออก',
        lobbyNeed: 'รอเพื่อนเข้าห้อง หรือกด + เพิ่มบอท เพื่อเล่นกับบอท',
        lobbyCan: 'กด เริ่มเกม ได้เลย (หรือรอให้ห้องเต็ม)', lobbyFull: 'ห้องเต็มแล้ว! กด เริ่มเกม ได้เลย',
        lobbyWait: 'รอหัวห้อง 👑 กดเริ่มเกม...',
        leftTag: '(ออกแล้ว)', becameGhost: '👻 กลายเป็นผี', noCards: 'ไม่มีการ์ด',
        dealIn: '🎴 แจกการ์ดรอบหน้าอีก {n} เทิร์น', dealNext: '🎴 แจกการ์ดเทิร์นหน้า!',
        crossStatus: '<span class="real">👻 ร้าย {real}</span> · <span class="fake">💨 ลวง {fake}</span><br><span class="sub">ปล่อยไปแล้ว {thrown}/{total} ดวง</span>',
        curseSelf: 'สาปตัวเอง', curse: 'สาป {name}', usedCardCaption: '{name} ใช้การ์ด!',
        you: 'คุณ', youLog: 'คุณ', self: 'ตัวเอง',
        resWinMe: '🎉 คุณรอดเป็นคนสุดท้าย! ชนะแล้ว! 🎉', resWinOther: '👑 {name} รอดเป็นคนสุดท้าย', resDraw: '👻 กลายเป็นผีกันหมด เสมอกัน!',
        stWinner: '👑 ผู้รอดชีวิต', stGhost: '👻 กลายเป็นผี', stLeft: '🚪 ออกจากเกม', words: '{n} คำ', word1: '{n} คำ',

        // ---- ข้อความจากเซิร์ฟเวอร์ ----
        eNotFound: 'ไม่พบห้องนี้ (อาจถูกปิดไปแล้ว)', ePlaying: 'ห้องนี้กำลังเล่นอยู่', eFull: 'ห้องเต็มแล้ว',
        eNeedTwo: 'ต้องมีผู้เล่นอย่างน้อย 2 คนถึงจะเริ่มได้', eDict: 'เซิร์ฟเวอร์ยังโหลดพจนานุกรมไม่เสร็จ รอแป๊บนึงแล้วลองใหม่',

        mGameOverWin: '🎉 จบเกม! {p} รอดชีวิตเป็นคนสุดท้าย! 🎉', mDraw: '👻 กลายเป็นผีกันหมด! เสมอกัน! 👻',
        mSkipped: '⛓️ {p} ถูกข้ามเทิร์น!', mTurnOf: 'ถึงเทิร์นของ {p}',
        mIncenseEnd: '🔥 {p} จุดธูปปัดเป่าวิญญาณทิ้ง 1 ดวง แล้วจบเทิร์น', mUsedCard: '{p} ใช้การ์ด {card}',
        mTyping: '{p} กำลังพิมพ์ศัพท์ที่ขึ้นต้นด้วย {letter}', mChoosing: '{p} ใช้คำว่า {word} — กำลังเลือกว่าจะสาปใคร...',
        mFail: '{p} พลาด! ({reason}) หมดสิทธิ์ปล่อยวิญญาณในเทิร์นนี้',
        mCastSelf: '{p} ร่ายคาถาสาปตัวเอง...', mCast: '{p} ร่ายคาถาสาปใส่ {t}...',
        mReal: '👻 BOO! วิญญาณร้าย! {t} โดนไป {dmg} ดาเมจ', mFake: '💨 ...แค่เงาลวง! {t} รอดไป',
        mLeftSkip: '{p} ออกจากเกม — ข้ามไปคนถัดไป',
        mFakeExtra: '💨 ...แค่เงาลวง! {p} รอด และได้เล่นอีกเทิร์น! 🔁',

        pYourTurnCards: 'ถึงเทิร์นของคุณ! ใช้การ์ดก่อนได้ แล้วกดเริ่มเทิร์น',
        pCardMore: 'ใช้การ์ดเพิ่มได้ หรือกดเริ่มเทิร์น', pCardStart: 'กดเริ่มเทิร์นได้เลย',
        pTypePrompt: 'พิมพ์ศัพท์ที่ขึ้นต้นด้วย {letter} (ยาว 3 ขึ้นไป)',
        pSuccess: 'เยี่ยมมาก! ได้สิทธิ์ปล่อยวิญญาณ', pChoose: 'เลือกคนที่จะสาป!', pFail: 'หมดสิทธิ์ปล่อยวิญญาณในเทิร์นนี้!',
        rWrongLetter: 'ผิด! ต้องขึ้นต้นด้วย {letter}', rNotDict: 'ไม่มีศัพท์นี้ในพจนานุกรม', rUsed: 'พลาด! คำนี้ถูกใช้ไปแล้ว',
        rShort: 'ศัพท์ต้องยาว 3 ตัวอักษรขึ้นไป', rTimeout: 'หมดเวลา!',
        effOuijaReal: '👁️ ดวงต่อไปคือ [👻 วิญญาณร้าย]!', effOuijaFake: '👁️ ดวงต่อไปคือ [💨 เงาลวง]!',
        effIncense: '🔥 ปัดเป่าวิญญาณทิ้งไป 1 ดวง จบเทิร์นอย่างปลอดภัย', effSoul: '🌑 จุดเทียนชีวิตคืน 1 เล่ม!',
        effBlood: '🩸 สลับวิญญาณดวงต่อไป ร้าย⇄ลวง (เฉพาะการสาปเทิร์นนี้)', effChains: '⛓️ ผู้เล่นคนถัดไปจะถูกข้ามเทิร์น!',
        effStake: '🗡️ การสาปเทิร์นนี้ ถ้าเป็นวิญญาณร้ายทำดาเมจ x2!',

        lNewGame: '<span class="log-sys">-- เริ่มเกมใหม่ --</span>',
        lReload: '<span class="log-sys">🔮 วงเวทใหม่: <span class="log-real">ร้าย {real}</span> · <span class="log-fake">ลวง {fake}</span></span>',
        lWin: '<span class="log-sys">🎉 จบเกม! {p} ชนะ!</span>', lDraw: '<span class="log-sys">👻 กลายเป็นผีกันหมด! เสมอกัน!</span>',
        lDeal: '<span class="log-sys">🎴 ครบ 1 รอบ! แจกการ์ดคนละ 1 ใบ</span>',
        lAfk: '<span class="log-sys">⌛ {p} ไม่กดเริ่มเทิร์น ข้ามเทิร์น</span>',
        lSkipped: '<span class="log-sys">⛓️ {p} ถูกข้ามเทิร์น</span>',
        lTargetTimeout: '<span class="log-sys">⌛ {p} เลือกเป้าไม่ทัน สุ่มเป้าให้</span>',
        lFail: '<span class="log-sys">{p} พิมพ์พลาดและเสียเทิร์น</span>',
        lUsedCard: '{p} ใช้การ์ด <span class="log-card">[{card}]</span>',
        lOuija: '- <span class="log-sys">{p} แอบส่องวงเวท!</span>',
        lIncense: '- <span class="log-sys">ปัดเป่าวิญญาณทิ้ง 1 ดวง แล้วจบเทิร์น</span>',
        lSoul: '- <span class="log-sys">จุดเทียนชีวิตคืน 1 เล่ม</span>',
        lBlood: '- <span class="log-sys">สลับวิญญาณดวงต่อไป ร้าย⇄ลวง!</span>',
        lChains: '- <span class="log-sys">เตรียมข้ามเทิร์นคนถัดไป!</span>',
        lStake: '- <span class="log-sys">เสริมพลังทำดาเมจ x2!</span>',
        lAttack: '{p} ใช้คำว่า <span class="log-word">{word}</span> สาป {t}',
        lReal: '- <span class="log-real">👻 BOO! วิญญาณร้าย</span> ทำดาเมจ {dmg}',
        lFake: '- <span class="log-fake">💨 เงาลวง</span> รอดตัวไป',
        lLeft: '<span class="log-sys">🚪 {p} ออกจากเกม</span>',
        lExtraTurn: '<span class="log-sys">🔁 {p} สาปตัวเองเจอเงาลวง ได้เล่นอีกเทิร์น!</span>'
    },

    en: {
        offline: '⚠️ Not connected to the game server — close this page and <b>double-click start.bat</b> in the game folder (the game will open by itself)',
        soundTitle: 'Sound on/off', langTitle: 'Change language',
        subtitle: 'SPELL TO SURVIVE · spell it right, then unleash a spirit',
        chatTitle: '💬 Chat', chatPh: 'Type a message...', chatSend: 'Send', chatEmpty: 'No messages yet — say hi 👋', chatToggle: 'Open/close chat', chatBtn: 'CHAT', soundOn: 'SOUND: ON', soundOff: 'SOUND: OFF',
        cJoin: '👋 {p} joined', cLeave: '🚪 {p} left',
        menuJoin: 'JOIN ROOM', menuCreate: 'CREATE ROOM', menuRule: 'Rule', menuSetting: 'SETTING',
        btnCreate: 'CREATE', btnStart: 'START GAME',
        back: 'Back', leaveRoom: 'Leave room', close: 'Close',
        phName: 'YOUR NAME', phRoom: 'ROOM NAME',
        lblYourName: 'Your name', lblRoomName: 'Room name', lblPlayers: 'Players',
        addBot: '+ Add bot', phWord: 'Type a word...', waitingStart: 'Waiting for the game...',
        startTurn: 'Start your turn', logTitle: '📜 Ritual log',
        resRank: 'Rank', resPlayer: 'Player', resStatus: 'Status', resWords: 'Words', resLongest: 'Longest',
        btnHome: 'Main menu', btnAgain: 'Play again',
        setName: '👤 Player name', setNameSub: 'Default name when creating/joining rooms',
        setLang: '🌐 Language', setLangSub: 'Game language on this device',
        setSound: '🔊 Sound', setSoundSub: 'Ghost sounds, cards and all effects',
        setVolume: '🎚️ Volume', setTest: 'Test',
        setShake: '💥 Screen shake & flash', setShakeSub: 'When someone is hit by an evil spirit',
        setBg: '✨ Background animation', setBgSub: 'Fog and floating ghosts (turn off if laggy)',
        setReset: 'Reset to default', setDone: 'Done',

        roomEmpty: 'No open rooms yet', roomEmptyCreate: '+ Create a room',
        roomNoServer: 'Not connected to the server, so rooms cannot be loaded',
        join: 'JOIN', full: 'Full', playing: 'Playing',
        lobbyCount: 'Players {n}/{max}', botTag: '(bot)', youTag: '(you)', waitingSeat: 'Waiting for player...', removeBot: 'Remove bot',
        lobbyNeed: 'Wait for friends, or press + Add bot to play with bots',
        lobbyCan: 'Press START GAME (or wait for the room to fill)', lobbyFull: 'Room is full! Press START GAME',
        lobbyWait: 'Waiting for the host 👑 to start...',
        leftTag: '(left)', becameGhost: '👻 Became a ghost', noCards: 'No cards',
        dealIn: '🎴 Next deal in {n} turn(s)', dealNext: '🎴 Cards are dealt next turn!',
        crossStatus: '<span class="real">👻 Evil {real}</span> · <span class="fake">💨 Decoy {fake}</span><br><span class="sub">Released {thrown}/{total}</span>',
        curseSelf: 'Curse yourself', curse: 'Curse {name}', usedCardCaption: '{name} played a card!',
        you: 'You', youLog: 'YOU', self: 'themselves',
        resWinMe: '🎉 You are the last one standing! You win! 🎉', resWinOther: '👑 {name} is the last one standing', resDraw: '👻 Everyone became a ghost. Draw!',
        stWinner: '👑 Survivor', stGhost: '👻 Ghost', stLeft: '🚪 Left', words: '{n} words', word1: '{n} word',

        eNotFound: 'Room not found (it may have closed)', ePlaying: 'This room is already playing', eFull: 'The room is full',
        eNeedTwo: 'You need at least 2 players to start', eDict: 'The server is still loading the dictionary. Try again in a moment',

        mGameOverWin: '🎉 Game over! {p} is the last one standing! 🎉', mDraw: '👻 Everyone became a ghost! Draw! 👻',
        mSkipped: '⛓️ {p} is skipped!', mTurnOf: "{p}'s turn",
        mIncenseEnd: '🔥 {p} burned incense, dispelled 1 spirit and ended the turn', mUsedCard: '{p} played {card}',
        mTyping: '{p} is typing a word starting with {letter}', mChoosing: '{p} used {word} — choosing who to curse...',
        mFail: '{p} missed! ({reason}) No spirit this turn',
        mCastSelf: '{p} casts a curse on themselves...', mCast: '{p} casts a curse on {t}...',
        mReal: '👻 BOO! Evil spirit! {t} takes {dmg} damage', mFake: '💨 ...just a decoy! {t} survives',
        mLeftSkip: '{p} left the game — moving to the next player',
        mFakeExtra: '💨 ...just a decoy! {p} survives and plays again! 🔁',
        mTurnOfMe: 'Your turn', mTypingMe: 'You are typing a word starting with {letter}', mSkippedMe: '⛓️ You are skipped!',
        mGameOverWinMe: '🎉 Game over! You are the last one standing! 🎉', mCastMe: 'You cast a curse on {t}...',
        mCastSelfMe: 'You cast a curse on yourself...', mCastMeT: '{p} casts a curse on you...',
        mRealMeT: '👻 BOO! Evil spirit! You take {dmg} damage', mFakeMeT: '💨 ...just a decoy! You survive', mFakeExtraMe: '💨 ...just a decoy! You survive and play again! 🔁',
        lExtraTurnMe: '<span class="log-sys">🔁 {p} cursed yourself with a decoy — play again!</span>',
        lWinMe: '<span class="log-sys">🎉 Game over! {p} win!</span>', lSkippedMe: '<span class="log-sys">⛓️ {p} were skipped</span>',

        pYourTurnCards: 'Your turn! Play cards first if you like, then start your turn',
        pCardMore: 'Play another card, or start your turn', pCardStart: 'Start your turn now',
        pTypePrompt: 'Type a word starting with {letter} (3+ letters)',
        pSuccess: 'Nice! You may unleash a spirit', pChoose: 'Choose who to curse!', pFail: 'No spirit for you this turn!',
        rWrongLetter: 'Wrong! It must start with {letter}', rNotDict: 'Not in the dictionary', rUsed: 'That word was already used',
        rShort: 'Words need 3+ letters', rTimeout: "Time's up!",
        effOuijaReal: '👁️ The next spirit is [👻 EVIL]!', effOuijaFake: '👁️ The next spirit is [💨 a DECOY]!',
        effIncense: '🔥 Dispelled 1 spirit, your turn ends safely', effSoul: '🌑 One life candle relit!',
        effBlood: '🩸 Next spirit flipped evil⇄decoy (your curse this turn only)', effChains: '⛓️ The next player will be skipped!',
        effStake: '🗡️ Your curse this turn deals x2 if it is evil!',

        lNewGame: '<span class="log-sys">-- New game --</span>',
        lReload: '<span class="log-sys">🔮 New circle: <span class="log-real">{real} evil</span> · <span class="log-fake">{fake} decoy</span></span>',
        lWin: '<span class="log-sys">🎉 Game over! {p} wins!</span>', lDraw: '<span class="log-sys">👻 Everyone became a ghost! Draw!</span>',
        lDeal: '<span class="log-sys">🎴 Round complete! 1 card dealt to each player</span>',
        lAfk: "<span class=\"log-sys\">⌛ {p} didn't start in time, turn skipped</span>",
        lSkipped: '<span class="log-sys">⛓️ {p} was skipped</span>',
        lTargetTimeout: '<span class="log-sys">⌛ {p} took too long, random target chosen</span>',
        lFail: '<span class="log-sys">{p} misspelled and lost the turn</span>',
        lUsedCard: '{p} played <span class="log-card">[{card}]</span>',
        lOuija: '- <span class="log-sys">{p} peeked into the circle!</span>',
        lIncense: '- <span class="log-sys">dispelled 1 spirit and ended the turn</span>',
        lSoul: '- <span class="log-sys">relit 1 life candle</span>',
        lBlood: '- <span class="log-sys">next spirit flipped evil⇄decoy!</span>',
        lChains: '- <span class="log-sys">the next player will be skipped!</span>',
        lStake: '- <span class="log-sys">empowered: x2 damage!</span>',
        lAttack: '{p} used <span class="log-word">{word}</span> to curse {t}',
        lReal: '- <span class="log-real">👻 BOO! Evil spirit</span> deals {dmg}',
        lFake: '- <span class="log-fake">💨 Decoy</span> no harm done',
        lLeft: '<span class="log-sys">🚪 {p} left the game</span>',
        lExtraTurn: '<span class="log-sys">🔁 {p} cursed themselves with a decoy — plays again!</span>'
    }
};

const CARD_TEXT = {
    Ouija:   { th: ['ดวงตาผีสาง', 'แอบดูว่าดวงถัดไปเป็นวิญญาณร้ายหรือเงาลวง'],   en: ['Spirit Eye', 'Peek whether the next spirit is evil or a decoy'] },
    Incense: { th: ['ธูปบูชา', 'ปัดเป่าวิญญาณดวงบนทิ้ง แล้วจบเทิร์นทันที'],       en: ['Incense', 'Dispel the top spirit and end your turn at once'] },
    Soul:    { th: ['เศษเสี้ยววิญญาณ', 'จุดเทียนชีวิตคืน 1 เล่ม'],                en: ['Soul Shard', 'Relight 1 life candle'] },
    Blood:   { th: ['เลือดศักดิ์สิทธิ์', 'สลับดวงถัดไป ร้าย⇄ลวง (เทิร์นนี้)'],     en: ['Holy Blood', 'Flip the next spirit evil⇄decoy (this turn)'] },
    Chains:  { th: ['โซ่ตรวนยมโลก', 'ผู้เล่นคนถัดไปถูกข้ามเทิร์น'],                en: ['Chains of Hell', 'The next player is skipped'] },
    Stake:   { th: ['ลิ่มเงิน', 'สาปเทิร์นนี้ ถ้าโดนวิญญาณร้าย ดาเมจ x2'],         en: ['Silver Stake', 'Your curse this turn deals x2 if evil'] }
};

let lang = localStorage.getItem('ghostLang') || ((navigator.language || '').startsWith('th') ? 'th' : 'en');
if (!STR[lang]) lang = 'th';

function htmlEsc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ข้อความในหน้าเว็บ: t('key', { name: ... })  (ใส่ค่าแบบข้อความธรรมดา)
function t(key, params = {}) {
    const tpl = STR[lang][key] ?? STR.th[key] ?? key;
    return tpl.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
}

const CARD_EMOJI = { Ouija: '👁️', Incense: '🔥', Soul: '🌑', Blood: '🩸', Chains: '⛓️', Stake: '🗡️' };
function cardEmoji(id) { return CARD_EMOJI[id]; }
function cardLabel(id) { return CARD_TEXT[id][lang][0]; }

// แปลค่าที่เซิร์ฟเวอร์ส่งมา (ผู้เล่น / การ์ด / ข้อความซ้อน)
function fmtParam(v, html) {
    if (v === null || v === undefined) return '';
    if (v === '@self') return t('self');
    if (typeof v === 'object') {
        if (v.pid) {
            const isMe = typeof myId !== 'undefined' && v.pid === myId;
            const name = isMe ? (html ? t('youLog') : t('you')) : v.name;
            return html ? `<span class="${isMe ? 'log-p-0' : 'log-p-enemy'}">${htmlEsc(name)}</span>` : name;
        }
        if (v.card) return `${cardEmoji(v.card)} ${cardLabel(v.card)}`;
        if (v.k) return tr(v, html);
    }
    return html ? htmlEsc(String(v)) : String(v);
}

// แปลข้อความจากเซิร์ฟเวอร์: { k, p } หรือ array ของข้อความ (คนละบรรทัด)
function tr(m, html = false) {
    if (!m) return '';
    if (typeof m === 'string') return html ? htmlEsc(m) : m;
    if (Array.isArray(m)) return m.map(x => tr(x, html)).join('\n');
    // ประโยคที่ต้องเปลี่ยนรูปเมื่อ "คุณ" เป็นผู้ทำ (Me) หรือเป็นเป้า (MeT) — มีแค่ภาษาอังกฤษ
    const me = typeof myId !== 'undefined' ? myId : null;
    const isMe = v => v && typeof v === 'object' && v.pid === me;
    const variant = m.p && (isMe(m.p.p) ? m.k + 'Me' : isMe(m.p.t) ? m.k + 'MeT' : null);
    const tpl = (variant && STR[lang][variant]) ?? STR[lang][m.k] ?? STR.th[m.k] ?? m.k;
    return tpl.replace(/\{(\w+)\}/g, (_, k) => fmtParam(m.p ? m.p[k] : undefined, html));
}

// ใส่ข้อความให้ element ที่มี data-i18n* ในหน้า
function applyStaticI18n() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    const btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = lang === 'th' ? 'TH' : 'EN';
    if (typeof syncSoundButton === 'function') syncSoundButton();
    document.querySelectorAll('.lang-choice').forEach(b => b.classList.toggle('selected', b.dataset.code === lang));
}
