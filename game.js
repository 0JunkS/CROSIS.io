// ==========================================
// GET NAVIGATED - FULL MULTIPLAYER & SURVIVAL ENGINE
// ==========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Image Assets ---
const images = {
  tile: new Image(),
  mob: new Image(),
  boss: new Image()
};

images.tile.src = 'assets/tile_bg.jpg';
images.mob.src = 'assets/mob_bug.png';
images.boss.src = 'assets/boss_bug.png';

let mobCanvas, mobCtx;
let bossCanvas, bossCtx;
let assetsLoaded = false;

function processChromaKeyImages() {
  mobCanvas = document.createElement('canvas');
  mobCanvas.width = images.mob.width || 300;
  mobCanvas.height = images.mob.height || 300;
  mobCtx = mobCanvas.getContext('2d');
  mobCtx.drawImage(images.mob, 0, 0);

  bossCanvas = document.createElement('canvas');
  bossCanvas.width = images.boss.width || 400;
  bossCanvas.height = images.boss.height || 400;
  bossCtx = bossCanvas.getContext('2d');
  bossCtx.drawImage(images.boss, 0, 0);

  try {
    const imgData = bossCtx.getImageData(0, 0, bossCanvas.width, bossCanvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
        data[i + 3] = 0;
      }
    }
    bossCtx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn("Chroma key filter skipped");
  }

  assetsLoaded = true;
}

let loadedCount = 0;
[images.tile, images.mob, images.boss].forEach(img => {
  img.onload = () => {
    loadedCount++;
    if (loadedCount >= 3) {
      processChromaKeyImages();
    }
  };
});

// --- Game State & User Resources ---
const GameState = {
  MAIN_MENU: 'MAIN_MENU',
  PLAYING: 'PLAYING',
  LEVEL_UP: 'LEVEL_UP',
  STAGE_CLEAR: 'STAGE_CLEAR',
  GAME_OVER: 'GAME_OVER'
};

let currentState = GameState.MAIN_MENU;

let userGold = Number(localStorage.getItem('get_nav_gold')) || 30400;
let userGem = Number(localStorage.getItem('get_nav_gem')) || 1920;
let userEnergy = 26;

let currentStage = Number(localStorage.getItem('get_nav_current_stage')) || 1;
let stageTargetKills = 10 + (currentStage - 1) * 5;
let stageKills = 0;

// --- Camera & Screen Shake ---
const camera = { x: 0, y: 0 };
let screenShakeTimer = 0;
let screenShakeIntensity = 0;

function triggerScreenShake(intensity = 10, duration = 15) {
  screenShakeIntensity = intensity;
  screenShakeTimer = duration;
}

// --- Player Object ---
const player = {
  x: 0,
  y: 0,
  radius: 24,
  speed: 5.2,
  hp: 100,
  maxHp: 100,
  angle: 0,
  level: 1,
  xp: 0,
  nextXp: 10,
  ultGauge: 0,
  maxUltGauge: 100,
  kills: 0,
  magnetRange: 160,

  skills: {
    multiArrow: 1,
    orbitShield: 0,
    laserBeam: 0,
    homingMissile: 0,
    airStrike: 0,
    speedBoost: 0,
    magnet: 0
  },

  shootTimer: 0,
  laserTimer: 0,
  missileTimer: 0,
  strikeTimer: 0
};

// --- Game Entities Arrays ---
let mobs = [];
let bullets = [];
let enemyBullets = [];
let gems = [];
let particles = [];
let damageTexts = [];
let bloodSplatters = [];
let boss = null;

// --- Timers & Stats ---
let gameTime = 0;
let mobSpawnTimer = 0;
let bossSpawned = false;
let bestKills = localStorage.getItem('get_nav_best_kills') || 0;
let bestTime = localStorage.getItem('get_nav_best_time') || 0;

// --- Socket.io Multiplayer & Friends Realtime Client ---
let socket = null;
if (typeof io !== 'undefined') {
  socket = io();
  socket.on('connect', () => {
    console.log('Connected to Socket.io gaming server!');
    socket.emit('user_join', { nickname: '화살표 용사' });
  });

  socket.on('receive_message', (msg) => {
    const chatContainer = document.getElementById('chat-messages-container');
    if (chatContainer) {
      const div = document.createElement('div');
      div.className = 'chat-msg';
      div.innerHTML = `<strong>${msg.senderName}:</strong> ${msg.text}`;
      chatContainer.appendChild(div);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  });
}

// --- Controls ---
const keys = {};
const mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
const joystick = {
  active: false,
  touchId: null,
  startX: 0,
  startY: 0,
  vectorX: 0,
  vectorY: 0
};

window.addEventListener('keydown', e => {
  sounds.init();
  keys[e.code] = true;
  if (e.code === 'Space') {
    e.preventDefault();
    activateUltimate();
  }
});

window.addEventListener('keyup', e => {
  keys[e.code] = false;
});

window.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// Touch Joystick Setup
const joystickZone = document.getElementById('joystick-zone');
const joystickStick = document.getElementById('joystick-stick');

if (joystickZone) {
  joystickZone.addEventListener('touchstart', e => {
    e.preventDefault();
    sounds.init();
    const touch = e.changedTouches[0];
    const rect = joystickZone.getBoundingClientRect();
    joystick.active = true;
    joystick.touchId = touch.identifier;
    joystick.startX = rect.left + rect.width / 2;
    joystick.startY = rect.top + rect.height / 2;
    updateJoystickPos(touch.clientX, touch.clientY);
  });

  window.addEventListener('touchmove', e => {
    if (!joystick.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystick.touchId) {
        updateJoystickPos(touch.clientX, touch.clientY);
        break;
      }
    }
  });

  window.addEventListener('touchend', e => {
    if (!joystick.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystick.touchId) {
        resetJoystick();
        break;
      }
    }
  });

  window.addEventListener('touchcancel', resetJoystick);
}

function updateJoystickPos(clientX, clientY) {
  const maxRadius = 45;
  let dx = clientX - joystick.startX;
  let dy = clientY - joystick.startY;
  const dist = Math.hypot(dx, dy);

  if (dist > maxRadius) {
    dx = (dx / dist) * maxRadius;
    dy = (dy / dist) * maxRadius;
  }

  joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  joystick.vectorX = dx / maxRadius;
  joystick.vectorY = dy / maxRadius;
}

function resetJoystick() {
  joystick.active = false;
  joystick.touchId = null;
  joystick.vectorX = 0;
  joystick.vectorY = 0;
  joystickStick.style.transform = `translate(-50%, -50%)`;
}

window.addEventListener('resize', resizeCanvas);
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();

// --- DOM Bindings & Modals ---
const ui = {
  mainMenu: document.getElementById('main-menu'),
  guideModal: document.getElementById('guide-modal'),
  hud: document.getElementById('hud'),

  hubStageName: document.getElementById('hub-stage-name'),
  hubStageTarget: document.getElementById('hub-stage-target'),
  bestScoreTime: document.getElementById('best-score-time'),
  headerUserLevel: document.getElementById('header-user-level'),

  userGold: document.getElementById('user-gold'),
  userGem: document.getElementById('user-gem'),

  authLoggedOut: document.getElementById('auth-logged-out'),
  authLoggedIn: document.getElementById('auth-logged-in'),
  googleLoginBtn: document.getElementById('google-login-btn'),
  guestLoginBtn: document.getElementById('guest-login-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  userName: document.getElementById('user-name'),
  userAvatarImg: document.getElementById('user-avatar-img'),
  userAvatarFallback: document.getElementById('user-avatar-fallback'),

  menuStartBtn: document.getElementById('menu-start-btn'),
  menuGuideBtn: document.getElementById('menu-guide-btn'),
  closeGuideBtn: document.getElementById('close-guide-btn'),

  // Generic & Social Modals
  friendsModal: document.getElementById('friends-modal'),
  btnFriendsModal: document.getElementById('btn-friends-modal'),
  closeFriendsBtn: document.getElementById('close-friends-btn'),

  genericModal: document.getElementById('generic-modal'),
  genModalTitle: document.getElementById('gen-modal-title'),
  genModalBody: document.getElementById('gen-modal-body'),
  genModalClaim: document.getElementById('gen-modal-claim'),
  closeGenericBtn: document.getElementById('close-generic-btn'),

  stageVal: document.getElementById('stage-val'),
  targetCounter: document.getElementById('target-counter'),
  timerVal: document.getElementById('timer-val'),
  xpBarFill: document.getElementById('xp-bar-fill'),
  levelBadge: document.getElementById('level-badge'),
  hpBarFill: document.getElementById('hp-bar-fill'),
  hpText: document.getElementById('hp-text'),
  ultBtn: document.getElementById('ult-button'),
  ultBarFill: document.getElementById('ult-bar-fill'),
  screenFlash: document.getElementById('screen-flash'),

  bossHpContainer: document.getElementById('boss-hp-container'),
  bossHpFill: document.getElementById('boss-hp-fill'),
  bossHpText: document.getElementById('boss-hp-text'),
  bossWarning: document.getElementById('boss-warning'),
  ultBanner: document.getElementById('ult-banner'),

  skillModal: document.getElementById('skill-modal'),
  skillCardsContainer: document.getElementById('skill-cards-container'),

  stageClearModal: document.getElementById('stage-clear-modal'),
  clearStageName: document.getElementById('clear-stage-name'),
  nextStageBtn: document.getElementById('next-stage-btn'),
  victoryHomeBtn: document.getElementById('victory-home-btn'),

  gameoverModal: document.getElementById('gameover-modal'),
  restartBtn: document.getElementById('restart-btn'),
  toMenuBtn: document.getElementById('to-menu-btn'),

  finalStage: document.getElementById('final-stage'),
  finalTime: document.getElementById('final-time'),
  finalKills: document.getElementById('final-kills')
};

// --- Firebase Auth Handler ---
if (typeof authManager !== 'undefined') {
  authManager.onUserChanged(user => {
    if (user) {
      ui.authLoggedOut.classList.add('hidden');
      ui.authLoggedIn.classList.remove('hidden');
      ui.userName.textContent = user.displayName || (user.isAnonymous ? "게스트 용사" : "화살표 용사");
      if (user.photoURL) {
        ui.userAvatarImg.src = user.photoURL;
        ui.userAvatarImg.classList.remove('hidden');
        ui.userAvatarFallback.classList.add('hidden');
      } else {
        ui.userAvatarImg.classList.add('hidden');
        ui.userAvatarFallback.classList.remove('hidden');
      }
    } else {
      ui.authLoggedOut.classList.remove('hidden');
      ui.authLoggedIn.classList.add('hidden');
    }
    updateHomeHubUI();
  });

  ui.googleLoginBtn.addEventListener('click', () => authManager.loginWithGoogle());
  ui.guestLoginBtn.addEventListener('click', () => authManager.loginAsGuest());
  ui.logoutBtn.addEventListener('click', () => authManager.logout());
}

// --- Interactive Modals Binding ---
function openGenericModal(title, htmlContent, onClaim) {
  ui.genModalTitle.textContent = title;
  ui.genModalBody.innerHTML = htmlContent;
  ui.genericModal.classList.remove('hidden');

  ui.genModalClaim.onclick = () => {
    if (onClaim) onClaim();
    sounds.playGem();
    ui.genericModal.classList.add('hidden');
  };
}

ui.closeGenericBtn.addEventListener('click', () => ui.genericModal.classList.add('hidden'));

// Ribbon Buttons Handlers
document.getElementById('btn-gift').onclick = () => {
  openGenericModal("🎁 매일 출석 선물 보상", "<p>오늘의 출석 보상을 수령하세요!</p><p>🪙 <strong>+1,000 골드</strong> | 💎 <strong>+50 보석</strong></p>", () => {
    userGold += 1000;
    userGem += 50;
    saveCurrencies();
  });
};

document.getElementById('btn-pass').onclick = () => {
  openGenericModal("🎫 시즌 패스 보상", "<p>시즌 패스 1단계 목표 달성 완료!</p><p>🪙 <strong>+2,500 골드</strong></p>", () => {
    userGold += 2500;
    saveCurrencies();
  });
};

document.getElementById('btn-growth').onclick = () => {
  openGenericModal("📈 성장 펀드", "<p>레벨 업 보상 달성!</p><p>💎 <strong>+100 보석</strong></p>", () => {
    userGem += 100;
    saveCurrencies();
  });
};

document.getElementById('btn-piggy').onclick = () => {
  openGenericModal("🐷 황금 저금통", "<p>저금통에 저축된 골드를 모두 인출합니다!</p><p>🪙 <strong>+5,000 골드</strong></p>", () => {
    userGold += 5000;
    saveCurrencies();
  });
};

document.getElementById('btn-echo').onclick = () => {
  openGenericModal("🌰 에코 이벤트 상점", "<p>도토리 이벤트 특별 보상을 수령하세요!</p><p>💎 <strong>+80 보석</strong></p>", () => {
    userGem += 80;
    saveCurrencies();
  });
};

document.getElementById('btn-quiz').onclick = () => {
  openGenericModal("📝 일일 퀴즈", `
    <p>Q. 주인공 화살표의 궁극기 스킬 명칭은?</p>
    <div style="margin-top:10px;">
      <button class="ftab" onclick="alert('정답입니다! +50보석 획득!')">1. DIMENSION OVERDRIVE</button>
      <button class="ftab" onclick="alert('오답입니다!')">2. SUPER BLAST</button>
    </div>
  `, () => {
    userGem += 50;
    saveCurrencies();
  });
};

document.getElementById('btn-achievements').onclick = () => {
  openGenericModal("📋 업적 목록", "<p>✔️ 몬스터 100마리 처치 달성!</p><p>🪙 <strong>+3,000 골드</strong></p>", () => {
    userGold += 3000;
    saveCurrencies();
  });
};

document.getElementById('btn-chapter-chest').onclick = () => {
  openGenericModal("🧰 챕터 보물상자", "<p>보물상자에서 희귀 아이템 획득!</p><p>🪙 <strong>+1,500 골드</strong> | 💎 <strong>+30 보석</strong></p>", () => {
    userGold += 1500;
    userGem += 30;
    saveCurrencies();
  });
};

document.getElementById('btn-patrol').onclick = () => {
  openGenericModal("🕒 빠른 순찰 (AFK 보상)", "<p>오프라인 순찰 보상이 쌓였습니다!</p><p>🪙 <strong>+4,200 골드</strong></p>", () => {
    userGold += 4200;
    saveCurrencies();
  });
};

document.getElementById('btn-daily-challenge').onclick = startGame;
document.getElementById('btn-daily-event').onclick = startGame;

// Friends Modal Handlers
ui.btnFriendsModal.onclick = () => ui.friendsModal.classList.remove('hidden');
ui.closeFriendsBtn.onclick = () => ui.friendsModal.classList.add('hidden');

// Friends Sub-tabs
const ftabs = ['ftab-list', 'ftab-add', 'ftab-chat', 'ftab-pvp'];
const fviews = ['fview-list', 'fview-add', 'fview-chat', 'fview-pvp'];

ftabs.forEach((tabId, idx) => {
  document.getElementById(tabId).onclick = () => {
    ftabs.forEach(t => document.getElementById(t).classList.remove('active'));
    fviews.forEach(v => document.getElementById(v).classList.add('hidden'));

    document.getElementById(tabId).classList.add('active');
    document.getElementById(fviews[idx]).classList.remove('hidden');
  };
});

// Direct Chat Sending
document.getElementById('btn-send-chat').onclick = () => {
  const input = document.getElementById('chat-input');
  if (input.value.trim() !== '') {
    if (socket) {
      socket.emit('send_message', {
        senderId: 'me',
        senderName: ui.userName.textContent,
        text: input.value
      });
    }
    input.value = '';
  }
};

// 1v1 PvP Friendly Room Creation
document.getElementById('btn-create-pvp').onclick = () => {
  const code = 'PVP-' + Math.floor(1000 + Math.random() * 9000);
  document.getElementById('pvp-room-code').textContent = code;
  alert(`1v1 친선전 방이 생성되었습니다! 방 코드: ${code}\n상대방 입장 시 자동 전투 시작!`);
  if (socket) {
    socket.emit('join_pvp_room', { roomCode: code, nickname: ui.userName.textContent });
  }
};

function saveCurrencies() {
  localStorage.setItem('get_nav_gold', userGold);
  localStorage.setItem('get_nav_gem', userGem);
  updateHomeHubUI();
}

ui.menuStartBtn.addEventListener('click', startGame);
ui.menuGuideBtn.addEventListener('click', () => ui.guideModal.classList.remove('hidden'));
ui.closeGuideBtn.addEventListener('click', () => ui.guideModal.classList.add('hidden'));
ui.restartBtn.addEventListener('click', startGame);
ui.toMenuBtn.addEventListener('click', showMainMenu);
ui.victoryHomeBtn.addEventListener('click', showMainMenu);
ui.nextStageBtn.addEventListener('click', () => {
  currentStage++;
  localStorage.setItem('get_nav_current_stage', currentStage);
  startGame();
});
ui.ultBtn.addEventListener('click', activateUltimate);

function updateHomeHubUI() {
  stageTargetKills = 10 + (currentStage - 1) * 5;
  ui.hubStageName.textContent = `${currentStage}. 초원 버그 대습격`;
  ui.hubStageTarget.textContent = `${stageTargetKills}마리 처치`;

  bestTime = localStorage.getItem('get_nav_best_time') || 0;
  ui.bestScoreTime.textContent = `${bestTime}초`;
  ui.headerUserLevel.textContent = player.level;

  ui.userGold.textContent = userGold.toLocaleString();
  ui.userGem.textContent = userGem.toLocaleString();
}
updateHomeHubUI();

function showMainMenu() {
  currentState = GameState.MAIN_MENU;
  ui.mainMenu.classList.remove('hidden');
  ui.hud.classList.add('hidden');
  ui.gameoverModal.classList.add('hidden');
  ui.skillModal.classList.add('hidden');
  ui.stageClearModal.classList.add('hidden');
  updateHomeHubUI();
}

function startGame() {
  sounds.init();
  currentState = GameState.PLAYING;

  stageTargetKills = 10 + (currentStage - 1) * 5;
  stageKills = 0;

  ui.mainMenu.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.gameoverModal.classList.add('hidden');
  ui.skillModal.classList.add('hidden');
  ui.stageClearModal.classList.add('hidden');
  ui.guideModal.classList.add('hidden');

  player.x = 0;
  player.y = 0;
  player.hp = 100;
  player.maxHp = 100;
  player.level = 1;
  player.xp = 0;
  player.nextXp = 10;
  player.ultGauge = 0;
  player.kills = 0;
  player.skills = {
    multiArrow: 1,
    orbitShield: 0,
    laserBeam: 0,
    homingMissile: 0,
    airStrike: 0,
    speedBoost: 0,
    magnet: 0
  };

  mobs = [];
  bullets = [];
  enemyBullets = [];
  gems = [];
  particles = [];
  damageTexts = [];
  bloodSplatters = [];
  boss = null;
  bossSpawned = false;
  gameTime = 0;

  ui.bossHpContainer.classList.add('hidden');
  updateHUD();
}

function checkStageClear() {
  if (stageKills >= stageTargetKills) {
    currentState = GameState.STAGE_CLEAR;
    sounds.playLevelUp();

    ui.clearStageName.textContent = `STAGE ${currentStage} 클리어 성공!`;
    ui.stageClearModal.classList.remove('hidden');

    userGold += 200;
    userGem += 15;
    saveCurrencies();

    if (player.kills > bestKills || gameTime > bestTime) {
      bestKills = Math.max(bestKills, player.kills);
      bestTime = Math.max(bestTime, gameTime);
      localStorage.setItem('get_nav_best_kills', bestKills);
      localStorage.setItem('get_nav_best_time', bestTime);
      if (typeof authManager !== 'undefined') {
        authManager.saveScore(bestKills, bestTime);
      }
    }
  }
}

function activateUltimate() {
  if (player.ultGauge < player.maxUltGauge || currentState !== GameState.PLAYING) return;

  player.ultGauge = 0;
  ui.ultBtn.disabled = true;
  ui.ultBtn.classList.remove('ready');

  triggerScreenShake(30, 55);
  sounds.playUltActivate();

  ui.ultBanner.classList.remove('hidden');
  setTimeout(() => ui.ultBanner.classList.add('hidden'), 1200);

  ui.screenFlash.className = 'flash-ult';
  setTimeout(() => ui.screenFlash.className = '', 300);

  for (let i = 0; i < 90; i++) {
    setTimeout(() => {
      const angle = (i / 90) * Math.PI * 2;
      const speed = 15;
      bullets.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 9,
        damage: 150,
        color: '#ffd700',
        isUlt: true,
        life: 200,
        pierce: 4
      });
    }, i * 10);
  }
}

const skillDatabase = [
  { id: 'multiArrow', imgSrc: 'assets/icon_multi_arrow.jpg', name: '다중 관통 화살', desc: '자동 록온 다중 화살발사' },
  { id: 'orbitShield', imgSrc: 'assets/icon_orbit_shield.jpg', name: '나침반 결계 방패', desc: '주위를 회전하며 적 반사' },
  { id: 'laserBeam', imgSrc: 'assets/icon_bezier_laser.jpg', name: '베지어 광선 레이저', desc: '적 무리를 관통하는 빔 발사' },
  { id: 'homingMissile', imgSrc: 'assets/icon_homing_missile.jpg', name: 'GPS 추적 미사일', desc: '100% 명중 유도 폭격 발사' },
  { id: 'airStrike', imgSrc: 'assets/icon_air_strike.jpg', name: '신호위반 십자로 폭격', desc: '전방 십자로 대규모 폭격' },
  { id: 'speedBoost', imgSrc: 'assets/icon_multi_arrow.jpg', name: '바람의 이정표', desc: '이동 속도가 +20% 증가' },
  { id: 'magnet', imgSrc: 'assets/icon_orbit_shield.jpg', name: '중력 자석', desc: '보석 흡수 범위 +50% 확대' }
];

function checkLevelUp() {
  if (player.xp >= player.nextXp) {
    player.xp -= player.nextXp;
    player.level++;
    player.nextXp = Math.floor(player.nextXp * 1.4);
    sounds.playLevelUp();

    ui.screenFlash.className = 'flash-level';
    setTimeout(() => ui.screenFlash.className = '', 300);

    currentState = GameState.LEVEL_UP;
    showSkillModal();
  }
}

function showSkillModal() {
  ui.skillCardsContainer.innerHTML = '';
  const shuffled = [...skillDatabase].sort(() => 0.5 - Math.random());
  const choices = shuffled.slice(0, 3);

  choices.forEach(skill => {
    const card = document.createElement('div');
    card.className = 'skill-card';
    card.innerHTML = `
      <img src="${skill.imgSrc}" alt="${skill.name}" class="card-img-icon">
      <div class="card-name">${skill.name}</div>
      <div class="card-desc">${skill.desc}</div>
    `;
    card.addEventListener('click', () => {
      player.skills[skill.id]++;
      if (skill.id === 'speedBoost') player.speed += 0.9;
      if (skill.id === 'magnet') player.magnetRange += 60;

      ui.skillModal.classList.add('hidden');
      currentState = GameState.PLAYING;
      updateHUD();
    });
    ui.skillCardsContainer.appendChild(card);
  });

  ui.skillModal.classList.remove('hidden');
}

function spawnMob() {
  const spawnDist = Math.max(canvas.width, canvas.height) / 2 + 80;
  const angle = Math.random() * Math.PI * 2;
  const x = player.x + Math.cos(angle) * spawnDist;
  const y = player.y + Math.sin(angle) * spawnDist;

  const isTank = Math.random() < 0.25;
  mobs.push({
    x: x,
    y: y,
    radius: isTank ? 60 : 42,
    baseSpeed: isTank ? 1.6 : 2.4 + Math.random() * 0.6,
    speed: 2.4,
    hp: isTank ? 120 + player.level * 30 : 40 + player.level * 12,
    maxHp: isTank ? 120 + player.level * 30 : 40 + player.level * 12,
    damage: isTank ? 15 : 8,
    isTank: isTank,
    hitFlash: 0
  });
}

function spawnBoss() {
  bossSpawned = true;
  sounds.playBossRoar();
  triggerScreenShake(25, 45);

  ui.bossWarning.classList.remove('hidden');
  setTimeout(() => ui.bossWarning.classList.add('hidden'), 2200);
  ui.bossHpContainer.classList.remove('hidden');

  const spawnDist = 500;
  const angle = Math.random() * Math.PI * 2;

  boss = {
    x: player.x + Math.cos(angle) * spawnDist,
    y: player.y + Math.sin(angle) * spawnDist,
    radius: 110,
    speed: 1.8,
    hp: 4500,
    maxHp: 4500,
    damage: 28,
    attackTimer: 0,
    hitFlash: 0
  };
}

function getNearestTarget(fromX, fromY) {
  let nearest = null;
  let minDist = Infinity;

  if (boss) {
    const d = Math.hypot(boss.x - fromX, boss.y - fromY);
    if (d < minDist) {
      minDist = d;
      nearest = boss;
    }
  }

  mobs.forEach(mob => {
    const d = Math.hypot(mob.x - fromX, mob.y - fromY);
    if (d < minDist) {
      minDist = d;
      nearest = mob;
    }
  });

  return nearest;
}

function updateWeapons() {
  player.shootTimer++;
  const fireRate = Math.max(10, 26 - player.skills.multiArrow * 3);
  if (player.shootTimer >= fireRate) {
    player.shootTimer = 0;
    sounds.playShoot();

    const target = getNearestTarget(player.x, player.y);
    let targetAngle = player.angle;
    if (target) {
      targetAngle = Math.atan2(target.y - player.y, target.x - player.x);
      player.angle = targetAngle;
    }

    const count = player.skills.multiArrow;
    const spread = 0.12;

    for (let i = 0; i < count; i++) {
      const angleOffset = (i - (count - 1) / 2) * spread;
      const angle = targetAngle + angleOffset;
      const speed = 14;

      bullets.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 6,
        damage: 25 + player.skills.multiArrow * 6,
        color: '#00f0ff',
        life: 90,
        pierce: 1,
        target: target
      });
    }
  }

  if (player.skills.laserBeam > 0) {
    player.laserTimer++;
    if (player.laserTimer >= 85 - player.skills.laserBeam * 10) {
      player.laserTimer = 0;
      sounds.playLaser();

      const target = getNearestTarget(player.x, player.y);
      let laserAngle = player.angle;
      if (target) {
        laserAngle = Math.atan2(target.y - player.y, target.x - player.x);
      }

      bullets.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(laserAngle) * 18,
        vy: Math.sin(laserAngle) * 18,
        radius: 14,
        damage: 75 + player.skills.laserBeam * 22,
        color: '#ff0077',
        isLaser: true,
        target: target,
        life: 80,
        pierce: 99
      });
    }
  }

  if (player.skills.homingMissile > 0) {
    player.missileTimer++;
    if (player.missileTimer >= 100 - player.skills.homingMissile * 12) {
      player.missileTimer = 0;
      bullets.push({
        x: player.x,
        y: player.y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        radius: 9,
        damage: 100 + player.skills.homingMissile * 35,
        color: '#ffd700',
        isMissile: true,
        life: 180,
        pierce: 1
      });
    }
  }

  if (player.skills.airStrike > 0) {
    player.strikeTimer++;
    if (player.strikeTimer >= 150) {
      player.strikeTimer = 0;
      triggerScreenShake(14, 22);
      sounds.playExplosion(true);

      const target = getNearestTarget(player.x, player.y);
      const cx = target ? target.x : player.x;
      const cy = target ? target.y : player.y;

      for (let i = -3; i <= 3; i++) {
        particles.push({
          x: cx + i * 90,
          y: cy,
          radius: 45,
          color: '#ff3300',
          life: 30,
          isExplosion: true,
          damage: 160
        });
        particles.push({
          x: cx,
          y: cy + i * 90,
          radius: 45,
          color: '#ff3300',
          life: 30,
          isExplosion: true,
          damage: 160
        });
      }
    }
  }
}

function update() {
  if (currentState !== GameState.PLAYING) return;

  gameTime += 1 / 60;

  let moveX = 0;
  let moveY = 0;

  if (keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) moveY += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

  if (joystick.active) {
    moveX = joystick.vectorX;
    moveY = joystick.vectorY;
  } else if (moveX !== 0 && moveY !== 0) {
    moveX *= 0.7071;
    moveY *= 0.7071;
  }

  player.x += moveX * player.speed;
  player.y += moveY * player.speed;

  if (!joystick.active) {
    mouse.worldX = mouse.x + camera.x - canvas.width / 2;
    mouse.worldY = mouse.y + camera.y - canvas.height / 2;
    player.angle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
  } else if (Math.hypot(moveX, moveY) > 0.1) {
    player.angle = Math.atan2(moveY, moveX);
  }

  camera.x += (player.x - camera.x) * 0.1;
  camera.y += (player.y - camera.y) * 0.1;

  updateWeapons();

  mobSpawnTimer++;
  const spawnRate = Math.max(8, 45 - Math.floor(gameTime / 8));
  if (mobSpawnTimer >= spawnRate) {
    mobSpawnTimer = 0;
    spawnMob();
  }

  if (gameTime >= 60 && !bossSpawned) {
    spawnBoss();
  }

  const speedMultiplier = 1 + Math.min(2.5, gameTime * 0.035);

  for (let i = mobs.length - 1; i >= 0; i--) {
    const mob = mobs[i];
    mob.speed = mob.baseSpeed * speedMultiplier;

    const angle = Math.atan2(player.y - mob.y, player.x - mob.x);
    mob.x += Math.cos(angle) * mob.speed;
    mob.y += Math.sin(angle) * mob.speed;

    if (mob.hitFlash > 0) mob.hitFlash--;

    const dist = Math.hypot(player.x - mob.x, player.y - mob.y);
    if (dist < player.radius + mob.radius) {
      player.hp -= mob.damage;
      sounds.playHit();
      ui.screenFlash.className = 'flash-hit';
      setTimeout(() => ui.screenFlash.className = '', 150);

      if (player.hp <= 0) {
        player.hp = 0;
        gameOver();
      }
    }
  }

  if (player.skills.orbitShield > 0) {
    const shieldCount = player.skills.orbitShield;
    const shieldOrbitRadius = 110;

    for (let i = 0; i < shieldCount; i++) {
      const shieldAngle = gameTime * 3 + (i / shieldCount) * Math.PI * 2;
      const sx = player.x + Math.cos(shieldAngle) * shieldOrbitRadius;
      const sy = player.y + Math.sin(shieldAngle) * shieldOrbitRadius;

      mobs.forEach(mob => {
        if (Math.hypot(sx - mob.x, sy - mob.y) < 30 + mob.radius) {
          mob.hp -= 5;
          mob.hitFlash = 3;
        }
      });

      if (boss && Math.hypot(sx - boss.x, sy - boss.y) < 30 + boss.radius) {
        boss.hp -= 5;
        boss.hitFlash = 3;
      }
    }
  }

  if (boss) {
    const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
    boss.x += Math.cos(angle) * (boss.speed * speedMultiplier * 0.8);
    boss.y += Math.sin(angle) * (boss.speed * speedMultiplier * 0.8);

    if (boss.hitFlash > 0) boss.hitFlash--;

    boss.attackTimer++;
    if (boss.attackTimer >= 80) {
      boss.attackTimer = 0;
      for (let b = 0; b < 18; b++) {
        const bulletAngle = (b / 18) * Math.PI * 2;
        enemyBullets.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(bulletAngle) * 4.5,
          vy: Math.sin(bulletAngle) * 4.5,
          radius: 9,
          damage: 16
        });
      }
    }

    if (Math.hypot(player.x - boss.x, player.y - boss.y) < player.radius + boss.radius) {
      player.hp -= boss.damage * 0.1;
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const target = getNearestTarget(b.x, b.y);

    if (target) {
      const targetAngle = Math.atan2(target.y - b.y, target.x - b.x);
      const curSpeed = Math.hypot(b.vx, b.vy);
      b.vx = b.vx * 0.75 + Math.cos(targetAngle) * curSpeed * 0.25;
      b.vy = b.vy * 0.75 + Math.sin(targetAngle) * curSpeed * 0.25;
    }

    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    if (b.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }

    for (let m = mobs.length - 1; m >= 0; m--) {
      const mob = mobs[m];
      if (Math.hypot(b.x - mob.x, b.y - mob.y) < b.radius + mob.radius) {
        mob.hp -= b.damage;
        mob.hitFlash = 4;
        sounds.playHit();

        damageTexts.push({
          x: mob.x,
          y: mob.y - 20,
          text: Math.floor(b.damage),
          color: b.isUlt ? '#ffd700' : '#ffffff',
          life: 30
        });

        for (let p = 0; p < 4; p++) {
          particles.push({
            x: mob.x,
            y: mob.y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            radius: Math.random() * 3 + 1,
            color: b.color,
            life: 20
          });
        }

        if (mob.hp <= 0) {
          bloodSplatters.push({
            x: mob.x,
            y: mob.y,
            radius: mob.radius * (0.8 + Math.random() * 0.4)
          });

          gems.push({
            x: mob.x,
            y: mob.y,
            value: mob.isTank ? 30 : 12
          });

          player.kills++;
          stageKills++;
          checkStageClear();

          player.ultGauge = Math.min(player.maxUltGauge, player.ultGauge + (mob.isTank ? 10 : 4));
          if (player.ultGauge >= player.maxUltGauge) {
            ui.ultBtn.disabled = false;
            ui.ultBtn.classList.add('ready');
          }

          mobs.splice(m, 1);
          sounds.playExplosion();
        }

        b.pierce--;
        if (b.pierce <= 0) {
          bullets.splice(i, 1);
          break;
        }
      }
    }

    if (boss && Math.hypot(b.x - boss.x, b.y - boss.y) < b.radius + boss.radius) {
      boss.hp -= b.damage;
      boss.hitFlash = 4;
      sounds.playHit();

      damageTexts.push({
        x: boss.x,
        y: boss.y - 50,
        text: Math.floor(b.damage),
        color: '#ff0055',
        life: 35
      });

      if (boss.hp <= 0) {
        triggerScreenShake(32, 60);
        sounds.playExplosion(true);
        boss = null;
        ui.bossHpContainer.classList.add('hidden');
        player.kills += 50;
        stageKills += 5;
        checkStageClear();
      }

      b.pierce--;
      if (b.pierce <= 0) {
        bullets.splice(i, 1);
      }
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const eb = enemyBullets[i];
    eb.x += eb.vx;
    eb.y += eb.vy;

    if (Math.hypot(eb.x - player.x, eb.y - player.y) < eb.radius + player.radius) {
      player.hp -= eb.damage;
      sounds.playHit();
      enemyBullets.splice(i, 1);
      if (player.hp <= 0) gameOver();
      continue;
    }

    if (Math.hypot(eb.x - player.x, eb.y - player.y) > 1200) {
      enemyBullets.splice(i, 1);
    }
  }

  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    const dist = Math.hypot(player.x - g.x, player.y - g.y);

    if (dist < player.magnetRange) {
      const angle = Math.atan2(player.y - g.y, player.x - g.x);
      g.x += Math.cos(angle) * 10;
      g.y += Math.sin(angle) * 10;
    }

    if (dist < player.radius + 15) {
      player.xp += g.value;
      sounds.playGem();
      gems.splice(i, 1);
      checkLevelUp();
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx || 0;
    p.y += p.vy || 0;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = damageTexts.length - 1; i >= 0; i--) {
    const dt = damageTexts[i];
    dt.y -= 0.8;
    dt.life--;
    if (dt.life <= 0) damageTexts.splice(i, 1);
  }

  updateHUD();
}

function updateHUD() {
  ui.stageVal.textContent = currentStage;
  ui.targetCounter.textContent = `${stageKills} / ${stageTargetKills}`;

  const mins = String(Math.floor(gameTime / 60)).padStart(2, '0');
  const secs = String(Math.floor(gameTime % 60)).padStart(2, '0');
  ui.timerVal.textContent = `${mins}:${secs}`;

  ui.levelBadge.textContent = `LV ${player.level}`;

  const xpPercent = Math.min(100, (player.xp / player.nextXp) * 100);
  ui.xpBarFill.style.width = `${xpPercent}%`;

  const hpPercent = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  ui.hpBarFill.style.width = `${hpPercent}%`;
  ui.hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;

  const ultPercent = Math.min(100, (player.ultGauge / player.maxUltGauge) * 100);
  ui.ultBarFill.style.width = `${ultPercent}%`;

  if (boss) {
    const bossHpPercent = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
    ui.bossHpFill.style.width = `${bossHpPercent}%`;
    ui.bossHpText.textContent = `${Math.ceil(bossHpPercent)}%`;
  }
}

function gameOver() {
  currentState = GameState.GAME_OVER;

  if (player.kills > bestKills || gameTime > bestTime) {
    bestKills = Math.max(bestKills, player.kills);
    bestTime = Math.max(bestTime, gameTime);
    localStorage.setItem('get_nav_best_kills', bestKills);
    localStorage.setItem('get_nav_best_time', bestTime);

    if (typeof authManager !== 'undefined') {
      authManager.saveScore(bestKills, bestTime);
    }
  }

  const mins = String(Math.floor(gameTime / 60)).padStart(2, '0');
  const secs = String(Math.floor(gameTime % 60)).padStart(2, '0');

  ui.finalStage.textContent = `STAGE ${currentStage}`;
  ui.finalTime.textContent = `${mins}:${secs}`;
  ui.finalKills.textContent = player.kills;

  ui.gameoverModal.classList.remove('hidden');
}

// --- Render Canvas ---
function draw() {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (screenShakeTimer > 0) {
    screenShakeTimer--;
    const rx = (Math.random() - 0.5) * screenShakeIntensity;
    const ry = (Math.random() - 0.5) * screenShakeIntensity;
    ctx.translate(rx, ry);
  }

  ctx.translate(canvas.width / 2 - camera.x, canvas.height / 2 - camera.y);

  if (images.tile.complete) {
    const tileSize = 256;
    const startCol = Math.floor((camera.x - canvas.width / 2) / tileSize) - 1;
    const endCol = Math.floor((camera.x + canvas.width / 2) / tileSize) + 1;
    const startRow = Math.floor((camera.y - canvas.height / 2) / tileSize) - 1;
    const endRow = Math.floor((camera.y + canvas.height / 2) / tileSize) + 1;

    for (let c = startCol; c <= endCol; c++) {
      for (let r = startRow; r <= endRow; r++) {
        ctx.drawImage(images.tile, c * tileSize, r * tileSize, tileSize, tileSize);
      }
    }
  }

  bloodSplatters.forEach(bs => {
    ctx.fillStyle = 'rgba(50, 60, 40, 0.45)';
    ctx.beginPath();
    ctx.arc(bs.x, bs.y, bs.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  gems.forEach(g => {
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  if (player.skills.orbitShield > 0) {
    const shieldCount = player.skills.orbitShield;
    const shieldOrbitRadius = 110;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(player.x, player.y, shieldOrbitRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < shieldCount; i++) {
      const shieldAngle = gameTime * 3 + (i / shieldCount) * Math.PI * 2;
      const sx = player.x + Math.cos(shieldAngle) * shieldOrbitRadius;
      const sy = player.y + Math.sin(shieldAngle) * shieldOrbitRadius;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(shieldAngle + Math.PI / 2);

      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 22;

      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 18);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }
  }

  bullets.forEach(b => {
    if (b.isLaser && b.target) {
      ctx.save();
      ctx.strokeStyle = '#ff0077';
      ctx.shadowColor = '#ff0077';
      ctx.shadowBlur = 25;
      ctx.lineWidth = 8;

      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      const midX = (player.x + b.target.x) / 2 + (Math.sin(gameTime * 10) * 40);
      const midY = (player.y + b.target.y) / 2 + (Math.cos(gameTime * 10) * 40);
      ctx.quadraticCurveTo(midX, midY, b.target.x, b.target.y);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();
    }
  });

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  ctx.fillStyle = '#ff5500';
  ctx.beginPath();
  ctx.moveTo(-player.radius - 8, -6);
  ctx.lineTo(-player.radius - 24 - Math.random() * 8, 0);
  ctx.lineTo(-player.radius - 8, 6);
  ctx.fill();

  ctx.fillStyle = '#00f0ff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.5;
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 20;

  ctx.beginPath();
  ctx.moveTo(player.radius + 14, 0);
  ctx.lineTo(-player.radius, -player.radius + 4);
  ctx.lineTo(-player.radius + 8, 0);
  ctx.lineTo(-player.radius, player.radius - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore();

  mobs.forEach(mob => {
    ctx.save();
    ctx.translate(mob.x, mob.y);

    if (mob.hitFlash > 0) {
      ctx.filter = 'brightness(2.5)';
    }

    const renderSize = mob.radius * 2.4;
    if (assetsLoaded && mobCanvas) {
      ctx.drawImage(mobCanvas, -renderSize / 2, -renderSize / 2, renderSize, renderSize);
    } else {
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(0, 0, mob.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });

  if (boss) {
    ctx.save();
    ctx.translate(boss.x, boss.y);

    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 40;

    if (boss.hitFlash > 0) {
      ctx.filter = 'brightness(3)';
    }

    const renderSize = boss.radius * 2.4;
    if (assetsLoaded && bossCanvas) {
      ctx.drawImage(bossCanvas, -renderSize / 2, -renderSize / 2, renderSize, renderSize);
    } else {
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(0, 0, boss.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  bullets.forEach(b => {
    if (!b.isLaser) {
      ctx.save();
      ctx.translate(b.x, b.y);

      if (b.isMissile) {
        const missileAngle = Math.atan2(b.vy, b.vx);
        ctx.rotate(missileAngle);

        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ff5500';
        ctx.shadowBlur = 15;
        ctx.fillRect(-12, -4, 24, 8);

        ctx.fillStyle = '#ff3300';
        ctx.beginPath();
        ctx.arc(-14, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  });

  enemyBullets.forEach(eb => {
    ctx.fillStyle = '#ff0055';
    ctx.shadowColor = '#ff0055';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(eb.x, eb.y, eb.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  damageTexts.forEach(dt => {
    ctx.font = '900 20px Orbitron';
    ctx.fillStyle = dt.color;
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(dt.text, dt.x - 12, dt.y);
  });

  particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
