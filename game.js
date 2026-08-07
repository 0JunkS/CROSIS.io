// ==========================================
// GET NAVIGATED - STARR DROP GACHA & 40s 1v1 ARENA ENGINE
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

// --- Game State & Resources ---
const GameState = {
  MAIN_MENU: 'MAIN_MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  LEVEL_UP: 'LEVEL_UP',
  STAGE_CLEAR: 'STAGE_CLEAR',
  GAME_OVER: 'GAME_OVER'
};

let currentState = GameState.MAIN_MENU;
let currentMatchMode = 'PVE'; // 'PVE', 'PVP_RANKED', 'PVP_NORMAL'

let userGold = Number(localStorage.getItem('get_nav_gold')) || 30400;
let userGem = Number(localStorage.getItem('get_nav_gem')) || 1920;
let userEnergy = 26;

let bonusAtk = Number(localStorage.getItem('get_nav_bonus_atk')) || 0;
let bonusHp = Number(localStorage.getItem('get_nav_bonus_hp')) || 0;

let currentStage = Number(localStorage.getItem('get_nav_current_stage')) || 1;
let stageTargetKills = 10 + (currentStage - 1) * 5;
let stageKills = 0;

// 1v1 PvP 40s Build Phase & Narrow Arena Timers
let pvpBuildTimer = 40;
let isPvpNarrowArenaActive = false;

// --- 5-RANK EQUIPMENT SYSTEM (S, A, B, C, D) ---
const RankStats = {
  'S': { def: 250, hp: 1200, colorClass: 'rank-s', label: 'S등급 (전설)', maxTaps: 5 },
  'A': { def: 100, hp: 500, colorClass: 'rank-a', label: 'A등급 (영웅)', maxTaps: 4 },
  'B': { def: 50, hp: 250, colorClass: 'rank-b', label: 'B등급 (희귀)', maxTaps: 3 },
  'C': { def: 25, hp: 120, colorClass: 'rank-c', label: 'C등급 (고급)', maxTaps: 2 },
  'D': { def: 10, hp: 50, colorClass: 'rank-d', label: 'D등급 (일반)', maxTaps: 1 }
};

const SlotTypes = {
  HELMET: { name: '헬멧', icon: 'assets/helmet.svg' },
  ARMOR: { name: '몸통 방어구', icon: 'assets/armor.svg' },
  LEGGINGS: { name: '다리 방어구', icon: 'assets/leggings.svg' },
  BOOTS: { name: '부츠', icon: 'assets/boots.svg' }
};

let inventory = JSON.parse(localStorage.getItem('get_nav_inventory')) || [];
let equippedGear = JSON.parse(localStorage.getItem('get_nav_equipped')) || {
  HELMET: null,
  ARMOR: null,
  LEGGINGS: null,
  BOOTS: null
};

// --- 7-TIER RANKING SYSTEM ---
let placementWins = Number(localStorage.getItem('get_nav_placements_wins')) || 0;
let placementsCompleted = Number(localStorage.getItem('get_nav_placements_completed')) || 0;
let userMMR = Number(localStorage.getItem('get_nav_mmr')) || 0;

const TierList = [
  { name: '플라스틱 (PLASTIC)', minMMR: 0, badge: 'assets/tier_plastic.svg' },
  { name: '브론즈 (BRONZE)', minMMR: 500, badge: 'assets/tier_bronze.svg' },
  { name: '실버 (SILVER)', minMMR: 1000, badge: 'assets/tier_silver.svg' },
  { name: '골드 (GOLD)', minMMR: 1500, badge: 'assets/tier_gold.svg' },
  { name: '다이아몬드 (DIAMOND)', minMMR: 2000, badge: 'assets/tier_diamond.svg' },
  { name: '세던 (SEDAN)', minMMR: 2500, badge: 'assets/tier_sedan.svg' },
  { name: '크로시스 (CROSIS)', minMMR: 3000, badge: 'assets/tier_crosis.svg' }
];

function getCurrentTierInfo() {
  if (placementsCompleted < 3) {
    return {
      name: `플라스틱 (배치고사 중)`,
      placementText: `배치고사: ${placementsCompleted} / 3 완료`,
      badge: 'assets/tier_plastic.svg'
    };
  }

  for (let i = TierList.length - 1; i >= 0; i--) {
    if (userMMR >= TierList[i].minMMR) {
      return {
        name: TierList[i].name,
        placementText: `MMR: ${userMMR}`,
        badge: TierList[i].badge
      };
    }
  }
  return { name: TierList[0].name, placementText: `MMR: ${userMMR}`, badge: TierList[0].badge };
}

// --- Camera & Screen Shake ---
const camera = { x: 0, y: 0 };
let screenShakeTimer = 0;
let screenShakeIntensity = 0;

function triggerScreenShake(intensity = 10, duration = 15) {
  screenShakeIntensity = intensity;
  screenShakeTimer = duration;
}

// --- Player 1 (You) ---
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

  shootTimer: 0
};

// --- Player 2 (1v1 Opponent) ---
let opponentPlayer = null;

function createOpponentPlayer() {
  opponentPlayer = {
    x: 180,
    y: 180,
    radius: 24,
    speed: 4.5,
    hp: 120,
    maxHp: 120,
    angle: 0,
    shootTimer: 0
  };
}

// --- Game Entities Arrays ---
let mobs = [];
let bullets = [];
let enemyBullets = [];
let gems = [];
let particles = [];
let damageTexts = [];
let bloodSplatters = [];
let boss = null;

// Timers & Stats
let gameTime = 0;
let mobSpawnTimer = 0;
let bossSpawned = false;
let bestKills = localStorage.getItem('get_nav_best_kills') || 0;
let bestTime = localStorage.getItem('get_nav_best_time') || 0;

// Socket.io Client
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

// Controls
const keys = {};
const mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
const joystick = { active: false, touchId: null, startX: 0, startY: 0, vectorX: 0, vectorY: 0 };

window.addEventListener('keydown', e => {
  sounds.init();
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); activateUltimate(); }
  if (e.code === 'Escape' && currentState === GameState.PLAYING && currentMatchMode === 'PVE') { togglePauseGame(); }
});

window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

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
      if (touch.identifier === joystick.touchId) { updateJoystickPos(touch.clientX, touch.clientY); break; }
    }
  });

  window.addEventListener('touchend', e => {
    if (!joystick.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystick.touchId) { resetJoystick(); break; }
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
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
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

  userTierBadgeImg: document.getElementById('user-tier-badge-img'),
  userTierName: document.getElementById('user-tier-name'),
  userTierPlacement: document.getElementById('user-tier-placement'),

  modalTierBadge: document.getElementById('modal-tier-badge'),
  modalTierName: document.getElementById('modal-tier-name'),
  modalPlacementText: document.getElementById('modal-placement-text'),

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

  // Starr Drop Modal
  starrDropModal: document.getElementById('starr-drop-modal'),
  starrDropOrb: document.getElementById('starr-drop-orb'),
  starrDropStatus: document.getElementById('starr-drop-status'),

  // Gacha Result Modal
  gachaResultModal: document.getElementById('gacha-result-modal'),
  gachaImg: document.getElementById('gacha-img'),
  gachaItemName: document.getElementById('gacha-item-name'),
  gachaItemStat: document.getElementById('gacha-item-stat'),
  closeGachaBtn: document.getElementById('close-gacha-btn'),

  // Pause Modal
  pauseModal: document.getElementById('pause-modal'),
  btnPauseGame: document.getElementById('btn-pause-game'),
  btnResumeGame: document.getElementById('btn-resume-game'),
  btnQuitGame: document.getElementById('btn-quit-game'),

  // Multiplayer Select Modal
  multiSelectModal: document.getElementById('multiplayer-select-modal'),
  btnOpenMultiSelect: document.getElementById('btn-open-multi-select'),
  closeMultiSelectBtn: document.getElementById('close-multi-select-btn'),
  btnStartRanked: document.getElementById('btn-start-ranked'),
  btnNormalAuto: document.getElementById('btn-normal-auto'),
  btnNormalCode: document.getElementById('btn-normal-code'),
  input4DigitCode: document.getElementById('4digit-code-input'),

  // Friends & Generic Modals
  friendsModal: document.getElementById('friends-modal'),
  btnFriendsModal: document.getElementById('btn-friends-modal'),
  closeFriendsBtn: document.getElementById('close-friends-btn'),

  genericModal: document.getElementById('generic-modal'),
  genModalTitle: document.getElementById('gen-modal-title'),
  genModalBody: document.getElementById('gen-modal-body'),
  genModalClaim: document.getElementById('gen-modal-claim'),
  closeGenericBtn: document.getElementById('close-generic-btn'),

  // 1v1 PvP HUD & 40s Build Banner
  pvpHpContainer: document.getElementById('pvp-hp-container'),
  p1HpVal: document.getElementById('p1-hp-val'),
  p2HpVal: document.getElementById('p2-hp-val'),
  pvpBuildTimerBox: document.getElementById('pvp-build-timer-box'),
  buildTimerVal: document.getElementById('build-timer-val'),

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

// --- INTERACTIVE TABS ---
const mainTabs = ['tab-shop', 'tab-equip', 'tab-battle', 'tab-lab'];
const mainViews = ['view-shop-tab', 'view-equip-tab', 'view-battle-tab', 'view-lab-tab'];

mainTabs.forEach((tabId, idx) => {
  document.getElementById(tabId).onclick = () => {
    mainTabs.forEach(t => document.getElementById(t).classList.remove('active-battle-tab'));
    mainViews.forEach(v => document.getElementById(v).classList.add('hidden'));

    document.getElementById(tabId).classList.add('active-battle-tab');
    document.getElementById(mainViews[idx]).classList.remove('hidden');
  };
});

document.getElementById('btn-shop-ribbon').onclick = () => document.getElementById('tab-shop').click();

// --- BRAWL STARS STARR DROP GACHA UNBOXING LOGIC ---
let activeStarrDropItem = null;
let currentTapCount = 0;
let targetTapsNeeded = 1;

document.getElementById('btn-open-diamond').onclick = () => startStarrDropGacha('DIAMOND', 100);
document.getElementById('btn-open-sedan').onclick = () => startStarrDropGacha('SEDAN', 300);
document.getElementById('btn-open-crosis').onclick = () => startStarrDropGacha('CROSIS', 500);

function startStarrDropGacha(chestType, cost) {
  if (userGem < cost) {
    alert("보석이 부족합니다!");
    return;
  }
  userGem -= cost;
  saveCurrencies();

  let rank = 'C';
  const rand = Math.random() * 100;

  if (chestType === 'DIAMOND') {
    if (rand < 60) rank = 'C';
    else if (rand < 92) rank = 'B';
    else rank = 'A';
  } else if (chestType === 'SEDAN') {
    if (rand < 45) rank = 'B';
    else if (rand < 85) rank = 'A';
    else rank = 'S';
  } else if (chestType === 'CROSIS') {
    if (rand < 55) rank = 'A';
    else rank = 'S';
  }

  const slotKeys = Object.keys(SlotTypes);
  const slotKey = slotKeys[Math.floor(Math.random() * slotKeys.length)];
  const slotInfo = SlotTypes[slotKey];
  const rankInfo = RankStats[rank];

  activeStarrDropItem = {
    id: Date.now(),
    slotType: slotKey,
    rank: rank,
    name: `${rankInfo.label} ${slotInfo.name}`,
    icon: slotInfo.icon,
    def: rankInfo.def,
    hp: rankInfo.hp,
    colorClass: rankInfo.colorClass
  };

  currentTapCount = 0;
  targetTapsNeeded = rankInfo.maxTaps;

  // Reset Starr Drop Modal UI
  ui.starrDropOrb.className = 'starr-drop-orb-box rare';
  ui.starrDropStatus.textContent = '✨ TAP TO UPGRADE! ✨';
  ui.starrDropModal.classList.remove('hidden');

  sounds.playGem();
}

// Tap Handler for Starr Drop Upgrade
ui.starrDropOrb.onclick = () => {
  if (!activeStarrDropItem) return;
  currentTapCount++;

  sounds.playLevelUp();
  triggerScreenShake(8 + currentTapCount * 6, 12);

  if (currentTapCount === 1) {
    ui.starrDropOrb.className = 'starr-drop-orb-box rare';
    ui.starrDropStatus.textContent = '🔵 RARE!';
  } else if (currentTapCount === 2) {
    ui.starrDropOrb.className = 'starr-drop-orb-box epic';
    ui.starrDropStatus.textContent = '🟣 EPIC!';
  } else if (currentTapCount === 3) {
    ui.starrDropOrb.className = 'starr-drop-orb-box mythic';
    ui.starrDropStatus.textContent = '💖 MYTHIC!';
  } else if (currentTapCount >= 4) {
    ui.starrDropOrb.className = 'starr-drop-orb-box legendary';
    ui.starrDropStatus.textContent = '👑 LEGENDARY S-RANK!';
  }

  if (currentTapCount >= targetTapsNeeded) {
    setTimeout(() => {
      ui.starrDropModal.classList.add('hidden');

      inventory.push(activeStarrDropItem);
      localStorage.setItem('get_nav_inventory', JSON.stringify(inventory));

      ui.gachaImg.src = activeStarrDropItem.icon;
      ui.gachaItemName.textContent = activeStarrDropItem.name;
      ui.gachaItemName.className = activeStarrDropItem.colorClass;
      ui.gachaItemStat.textContent = `🛡️ 방어력 +${activeStarrDropItem.def} | ❤️ 추가 체력 +${activeStarrDropItem.hp}`;
      ui.gachaResultModal.classList.remove('hidden');

      renderInventory();
      activeStarrDropItem = null;
    }, 450);
  }
};

ui.closeGachaBtn.onclick = () => ui.gachaResultModal.classList.add('hidden');

// --- RENDER INVENTORY ---
function renderInventory() {
  const container = document.getElementById('inventory-grid-box');
  if (!container) return;
  container.innerHTML = '';

  let totalDef = 0;
  let totalHp = 0;

  Object.keys(equippedGear).forEach(slotKey => {
    const gear = equippedGear[slotKey];
    const displayEl = document.getElementById(`${slotKey.toLowerCase()}-name-display`);
    if (gear) {
      totalDef += gear.def;
      totalHp += gear.hp;
      if (displayEl) {
        displayEl.textContent = gear.name;
        displayEl.className = gear.colorClass;
      }
    } else if (displayEl) {
      displayEl.textContent = `미착용 (D등급)`;
      displayEl.className = 'rank-d';
    }
  });

  document.getElementById('equip-def-val').textContent = totalDef;
  document.getElementById('equip-hp-val').textContent = `+${totalHp}`;

  inventory.forEach(item => {
    const card = document.createElement('div');
    card.className = 'inventory-item-card';
    card.innerHTML = `
      <img src="${item.icon}" class="inv-img" alt="${item.name}">
      <span class="inv-name ${item.colorClass}">${item.rank}급 ${SlotTypes[item.slotType].name}</span>
    `;
    card.onclick = () => {
      equippedGear[item.slotType] = item;
      localStorage.setItem('get_nav_equipped', JSON.stringify(equippedGear));
      alert(`🛡️ [${item.name}] 장비를 착용했습니다!`);
      renderInventory();
    };
    container.appendChild(card);
  });
}
renderInventory();

// TECH LAB UPGRADES
document.getElementById('btn-tech-atk').onclick = () => {
  if (userGold >= 1500) {
    userGold -= 1500;
    bonusAtk += 10;
    localStorage.setItem('get_nav_bonus_atk', bonusAtk);
    alert("🧪 영구 공격력 +10 연구 완료!");
    saveCurrencies();
  } else alert("골드가 부족합니다!");
};

document.getElementById('btn-tech-hp').onclick = () => {
  if (userGold >= 1500) {
    userGold -= 1500;
    bonusHp += 50;
    localStorage.setItem('get_nav_bonus_hp', bonusHp);
    alert("🧪 영구 최대 체력 +50 연구 완료!");
    saveCurrencies();
  } else alert("골드가 부족합니다!");
};

document.getElementById('btn-tech-speed').onclick = () => {
  if (userGold >= 2000) {
    userGold -= 2000;
    player.speed += 0.5;
    alert("🧪 영구 이동 속도 +10% 연구 완료!");
    saveCurrencies();
  } else alert("골드가 부족합니다!");
};

// Pause Handlers
ui.btnPauseGame.addEventListener('click', togglePauseGame);
ui.btnResumeGame.addEventListener('click', () => {
  ui.pauseModal.classList.add('hidden');
  currentState = GameState.PLAYING;
});
ui.btnQuitGame.addEventListener('click', () => {
  ui.pauseModal.classList.add('hidden');
  showMainMenu();
});

function togglePauseGame() {
  if (currentMatchMode !== 'PVE') return;
  if (currentState === GameState.PLAYING) {
    currentState = GameState.PAUSED;
    ui.pauseModal.classList.remove('hidden');
  } else if (currentState === GameState.PAUSED) {
    currentState = GameState.PLAYING;
    ui.pauseModal.classList.add('hidden');
  }
}

// Multiplayer Select Modal Handlers
ui.btnOpenMultiSelect.addEventListener('click', () => ui.multiSelectModal.classList.remove('hidden'));
ui.closeMultiSelectBtn.addEventListener('click', () => ui.multiSelectModal.classList.add('hidden'));

// 1v1 Ranked & Normal Matches
ui.btnStartRanked.addEventListener('click', () => {
  ui.multiSelectModal.classList.add('hidden');
  currentMatchMode = 'PVP_RANKED';
  start1v1PvPGame(`🏆 1v1 랭크전 (${placementsCompleted < 3 ? `배치고사 ${placementsCompleted + 1}/3` : 'MMR 1v1'})`);
});

ui.btnNormalAuto.addEventListener('click', () => {
  ui.multiSelectModal.classList.add('hidden');
  currentMatchMode = 'PVP_NORMAL';
  start1v1PvPGame("🎮 1v1 일반전");
});

ui.btnNormalCode.addEventListener('click', () => {
  const code = ui.input4DigitCode.value.trim();
  if (code.length !== 4 || isNaN(code)) {
    alert("올바른 4자리 코드를 입력하세요!");
    return;
  }
  ui.multiSelectModal.classList.add('hidden');
  currentMatchMode = 'PVP_NORMAL';
  start1v1PvPGame(`🎮 1v1 코드: ${code}`);
});

function start1v1PvPGame(title) {
  sounds.init();
  currentState = GameState.PLAYING;

  ui.btnPauseGame.classList.add('hidden');
  ui.pvpHpContainer.classList.remove('hidden');
  ui.pvpBuildTimerBox.classList.remove('hidden');

  pvpBuildTimer = 40;
  isPvpNarrowArenaActive = false;

  stageTargetKills = 1;
  stageKills = 0;

  ui.mainMenu.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.gameoverModal.classList.add('hidden');
  ui.skillModal.classList.add('hidden');
  ui.stageClearModal.classList.add('hidden');

  resetPlayerState();
  createOpponentPlayer();
  updateHUD();

  // Give immediate Skill Upgrades during Build Phase!
  showSkillModal();
}

function resetPlayerState() {
  let gearHp = 0;
  Object.keys(equippedGear).forEach(k => {
    if (equippedGear[k]) gearHp += equippedGear[k].hp;
  });

  player.x = 0;
  player.y = 0;
  player.hp = 100 + bonusHp + gearHp;
  player.maxHp = 100 + bonusHp + gearHp;
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
}

// Generic Modal Helper
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

// Ribbon Handlers
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

document.getElementById('btn-achievements').onclick = () => {
  openGenericModal("📋 업적 목록", "<p>✔️ 몬스터 100마리 처치 달성!</p><p>🪙 <strong>+3,000 골드</strong></p>", () => {
    userGold += 3000;
    saveCurrencies();
  });
};

document.getElementById('btn-daily-challenge').onclick = startGame;
document.getElementById('btn-daily-event').onclick = startGame;

// Friends Modal Handlers
ui.btnFriendsModal.onclick = () => ui.friendsModal.classList.remove('hidden');
ui.closeFriendsBtn.onclick = () => ui.friendsModal.classList.add('hidden');

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

document.getElementById('btn-create-pvp').onclick = () => {
  const code = Math.floor(1000 + Math.random() * 9000);
  document.getElementById('pvp-room-code').textContent = code;
  ui.friendsModal.classList.add('hidden');
  currentMatchMode = 'PVP_NORMAL';
  start1v1PvPGame(`⚔️ 1v1 친선전 (방 코드: ${code})`);
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
  if (currentMatchMode === 'PVE') {
    currentStage++;
    localStorage.setItem('get_nav_current_stage', currentStage);
    startGame();
  } else {
    start1v1PvPGame("⚔️ 1v1 재대결");
  }
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

  const tierInfo = getCurrentTierInfo();
  ui.userTierBadgeImg.src = tierInfo.badge;
  ui.userTierName.textContent = tierInfo.name;
  ui.userTierPlacement.textContent = tierInfo.placementText;

  ui.modalTierBadge.src = tierInfo.badge;
  ui.modalTierName.textContent = tierInfo.name;
  ui.modalPlacementText.textContent = tierInfo.placementText;
}
updateHomeHubUI();

function showMainMenu() {
  currentState = GameState.MAIN_MENU;
  ui.mainMenu.classList.remove('hidden');
  ui.hud.classList.add('hidden');
  ui.gameoverModal.classList.add('hidden');
  ui.skillModal.classList.add('hidden');
  ui.stageClearModal.classList.add('hidden');
  ui.pauseModal.classList.add('hidden');
  ui.pvpHpContainer.classList.add('hidden');
  ui.pvpBuildTimerBox.classList.add('hidden');
  updateHomeHubUI();
}

function startGame() {
  sounds.init();
  currentState = GameState.PLAYING;
  currentMatchMode = 'PVE';
  opponentPlayer = null;

  ui.btnPauseGame.classList.remove('hidden');
  ui.pvpHpContainer.classList.add('hidden');
  ui.pvpBuildTimerBox.classList.add('hidden');

  stageTargetKills = 10 + (currentStage - 1) * 5;
  stageKills = 0;

  ui.mainMenu.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.gameoverModal.classList.add('hidden');
  ui.skillModal.classList.add('hidden');
  ui.stageClearModal.classList.add('hidden');
  ui.guideModal.classList.add('hidden');

  resetPlayerState();
  updateHUD();
}

function checkStageClear() {
  if (stageKills >= stageTargetKills) {
    currentState = GameState.STAGE_CLEAR;
    sounds.playLevelUp();

    ui.clearStageName.textContent = currentMatchMode.startsWith('PVP') ? `1v1 대결 승리!` : `STAGE ${currentStage} 클리어 성공!`;
    ui.stageClearModal.classList.remove('hidden');

    userGold += 250;
    userGem += 20;

    if (currentMatchMode === 'PVP_RANKED') {
      if (placementsCompleted < 3) {
        placementsCompleted++;
        placementWins++;
        localStorage.setItem('get_nav_placements_completed', placementsCompleted);
        localStorage.setItem('get_nav_placements_wins', placementWins);

        if (placementsCompleted === 3) {
          userMMR = 1000 + placementWins * 500;
          localStorage.setItem('get_nav_mmr', userMMR);
          alert(`🏆 3회 배치고사 완료! 당신의 MMR은 [ ${userMMR} ] 이며, 최종 티어가 부여되었습니다!`);
        } else {
          alert(`🏆 배치고사 ${placementsCompleted}/3 완료! (승리!)`);
        }
      } else {
        userMMR += 50;
        localStorage.setItem('get_nav_mmr', userMMR);
      }
    }

    saveCurrencies();
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

  if (opponentPlayer && opponentPlayer.hp > 0) {
    const d = Math.hypot(opponentPlayer.x - fromX, opponentPlayer.y - fromY);
    if (d < minDist) {
      minDist = d;
      nearest = opponentPlayer;
    }
  }

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
        damage: (25 + player.skills.multiArrow * 6) + bonusAtk,
        color: '#00f0ff',
        life: 90,
        pierce: 1,
        target: target
      });
    }
  }
}

// Engine Update Loop
function update() {
  if (currentState !== GameState.PLAYING) return;

  gameTime += 1 / 60;

  // 1v1 PvP 40-Second Build Timer Countdown & Teleport to Narrow Ring Arena
  if (currentMatchMode.startsWith('PVP')) {
    if (pvpBuildTimer > 0) {
      pvpBuildTimer -= 1 / 60;
      ui.buildTimerVal.textContent = `${Math.ceil(pvpBuildTimer)}s`;

      if (pvpBuildTimer <= 0) {
        pvpBuildTimer = 0;
        isPvpNarrowArenaActive = true;
        ui.pvpBuildTimerBox.classList.add('hidden');

        sounds.playBossRoar();
        triggerScreenShake(25, 40);

        // Teleport both players into 300px Narrow Arena Ring
        player.x = -120;
        player.y = 0;
        if (opponentPlayer) {
          opponentPlayer.x = 120;
          opponentPlayer.y = 0;
        }
      }
    }

    // Constrain players inside Narrow Arena Ring
    if (isPvpNarrowArenaActive) {
      const arenaRadius = 320;
      const distP1 = Math.hypot(player.x, player.y);
      if (distP1 > arenaRadius) {
        player.x = (player.x / distP1) * arenaRadius;
        player.y = (player.y / distP1) * arenaRadius;
      }
      if (opponentPlayer) {
        const distP2 = Math.hypot(opponentPlayer.x, opponentPlayer.y);
        if (distP2 > arenaRadius) {
          opponentPlayer.x = (opponentPlayer.x / distP2) * arenaRadius;
          opponentPlayer.y = (opponentPlayer.y / distP2) * arenaRadius;
        }
      }
    }
  }

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

  // 1v1 Opponent Player AI Logic
  if (opponentPlayer && opponentPlayer.hp > 0) {
    const oppAngle = Math.atan2(player.y - opponentPlayer.y, player.x - opponentPlayer.x);
    opponentPlayer.x += Math.cos(oppAngle) * (opponentPlayer.speed * 0.6);
    opponentPlayer.y += Math.sin(oppAngle) * (opponentPlayer.speed * 0.6);
    opponentPlayer.angle = oppAngle;

    opponentPlayer.shootTimer++;
    if (opponentPlayer.shootTimer >= 40) {
      opponentPlayer.shootTimer = 0;
      enemyBullets.push({
        x: opponentPlayer.x,
        y: opponentPlayer.y,
        vx: Math.cos(oppAngle) * 9,
        vy: Math.sin(oppAngle) * 9,
        radius: 7,
        damage: 12
      });
    }
  }

  mobSpawnTimer++;
  const spawnRate = Math.max(8, 45 - Math.floor(gameTime / 8));
  if (mobSpawnTimer >= spawnRate && !isPvpNarrowArenaActive) {
    mobSpawnTimer = 0;
    spawnMob();
  }

  if (gameTime >= 60 && !bossSpawned && currentMatchMode === 'PVE') {
    spawnBoss();
  }

  const speedMultiplier = 1 + Math.min(2.5, gameTime * 0.035);

  let gearDef = 0;
  Object.keys(equippedGear).forEach(k => {
    if (equippedGear[k]) gearDef += equippedGear[k].def;
  });
  const dmgReduction = Math.min(0.8, gearDef * 0.002);

  for (let i = mobs.length - 1; i >= 0; i--) {
    const mob = mobs[i];
    mob.speed = mob.baseSpeed * speedMultiplier;

    const angle = Math.atan2(player.y - mob.y, player.x - mob.x);
    mob.x += Math.cos(angle) * mob.speed;
    mob.y += Math.sin(angle) * mob.speed;

    const dist = Math.hypot(player.x - mob.x, player.y - mob.y);
    if (dist < player.radius + mob.radius) {
      const netDamage = Math.max(1, mob.damage * (1 - dmgReduction));
      player.hp -= netDamage;
      sounds.playHit();
      ui.screenFlash.className = 'flash-hit';
      setTimeout(() => ui.screenFlash.className = '', 150);

      if (player.hp <= 0) {
        player.hp = 0;
        gameOver();
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    if (b.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }

    if (opponentPlayer && opponentPlayer.hp > 0) {
      if (Math.hypot(b.x - opponentPlayer.x, b.y - opponentPlayer.y) < b.radius + opponentPlayer.radius) {
        opponentPlayer.hp -= b.damage;
        sounds.playHit();

        damageTexts.push({
          x: opponentPlayer.x,
          y: opponentPlayer.y - 30,
          text: Math.floor(b.damage),
          color: '#ffd700',
          life: 30
        });

        if (opponentPlayer.hp <= 0) {
          opponentPlayer.hp = 0;
          stageKills++;
          checkStageClear();
        }

        bullets.splice(i, 1);
        continue;
      }
    }

    for (let m = mobs.length - 1; m >= 0; m--) {
      const mob = mobs[m];
      if (Math.hypot(b.x - mob.x, b.y - mob.y) < b.radius + mob.radius) {
        mob.hp -= b.damage;
        sounds.playHit();

        if (mob.hp <= 0) {
          // Drop Visually Glowing Blue Diamond XP Gem
          gems.push({ x: mob.x, y: mob.y, value: 12 });
          player.kills++;
          if (currentMatchMode === 'PVE') {
            stageKills++;
            checkStageClear();
          }
          mobs.splice(m, 1);
        }

        bullets.splice(i, 1);
        break;
      }
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const eb = enemyBullets[i];
    eb.x += eb.vx;
    eb.y += eb.vy;

    if (Math.hypot(eb.x - player.x, eb.y - player.y) < eb.radius + player.radius) {
      const netDamage = Math.max(1, eb.damage * (1 - dmgReduction));
      player.hp -= netDamage;
      sounds.playHit();
      enemyBullets.splice(i, 1);
      if (player.hp <= 0) gameOver();
      continue;
    }
  }

  // XP Gems Magnet Attraction Logic
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    const d = Math.hypot(player.x - g.x, player.y - g.y);

    if (d < player.magnetRange) {
      const angle = Math.atan2(player.y - g.y, player.x - g.x);
      g.x += Math.cos(angle) * 9;
      g.y += Math.sin(angle) * 9;
    }

    if (d < player.radius + 15) {
      player.xp += g.value;
      sounds.playGem();
      gems.splice(i, 1);
      checkLevelUp();
    }
  }

  updateHUD();
}

function updateHUD() {
  ui.stageVal.textContent = currentMatchMode.startsWith('PVP') ? '1v1 MATCH' : `STAGE ${currentStage}`;
  ui.targetCounter.textContent = `${stageKills} / ${stageTargetKills}`;

  const mins = String(Math.floor(gameTime / 60)).padStart(2, '0');
  const secs = String(Math.floor(gameTime % 60)).padStart(2, '0');
  ui.timerVal.textContent = `${mins}:${secs}`;

  ui.levelBadge.textContent = `LV ${player.level}`;

  const hpPercent = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  ui.hpBarFill.style.width = `${hpPercent}%`;
  ui.hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;

  if (opponentPlayer) {
    ui.p1HpVal.textContent = Math.ceil(player.hp);
    ui.p2HpVal.textContent = Math.ceil(opponentPlayer.hp);
  }
}

function gameOver() {
  currentState = GameState.GAME_OVER;
  const mins = String(Math.floor(gameTime / 60)).padStart(2, '0');
  const secs = String(Math.floor(gameTime % 60)).padStart(2, '0');

  ui.finalStage.textContent = currentMatchMode.startsWith('PVP') ? '1v1 패배' : `STAGE ${currentStage}`;
  ui.finalTime.textContent = `${mins}:${secs}`;
  ui.finalKills.textContent = player.kills;

  ui.gameoverModal.classList.remove('hidden');
}

// Render Canvas
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

  // Render Narrow 1v1 Arena Plasma Fence
  if (isPvpNarrowArenaActive) {
    ctx.save();
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 6;
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#ff0055';
    ctx.beginPath();
    ctx.arc(0, 0, 320, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Render High Visibility XP Gems (Bright Glowing Cyan Diamonds)
  gems.forEach(g => {
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(g.x, g.y - 12);
    ctx.lineTo(g.x + 10, g.y);
    ctx.lineTo(g.x, g.y + 12);
    ctx.lineTo(g.x - 10, g.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  // Render Player 1 (Blue Arrow)
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  ctx.fillStyle = '#00f0ff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(player.radius + 14, 0);
  ctx.lineTo(-player.radius, -player.radius + 4);
  ctx.lineTo(-player.radius + 8, 0);
  ctx.lineTo(-player.radius, player.radius - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // Render Player 2 Opponent (Red Arrow) in 1v1 PvP
  if (opponentPlayer && opponentPlayer.hp > 0) {
    ctx.save();
    ctx.translate(opponentPlayer.x, opponentPlayer.y);
    ctx.rotate(opponentPlayer.angle);

    ctx.fillStyle = '#ff0055';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(opponentPlayer.radius + 14, 0);
    ctx.lineTo(-opponentPlayer.radius, -opponentPlayer.radius + 4);
    ctx.lineTo(-opponentPlayer.radius + 8, 0);
    ctx.lineTo(-opponentPlayer.radius, opponentPlayer.radius - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // Render Mobs
  mobs.forEach(mob => {
    ctx.save();
    ctx.translate(mob.x, mob.y);
    const renderSize = mob.radius * 2.4;
    if (assetsLoaded && mobCanvas) {
      ctx.drawImage(mobCanvas, -renderSize / 2, -renderSize / 2, renderSize, renderSize);
    }
    ctx.restore();
  });

  // Render Bullets
  bullets.forEach(b => {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  enemyBullets.forEach(eb => {
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(eb.x, eb.y, eb.radius, 0, Math.PI * 2);
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
