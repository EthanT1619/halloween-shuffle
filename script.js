/*
 * ARCHIVE RECOVERY TERMINAL
 * 학생 화면에는 심볼과 순서만 보여 준다.
 * answer 숫자는 VERIFY CODE를 열었을 때만 표시한다.
 *
 * 장소나 심볼을 바꿀 때는 아래 locations 배열만 수정한다.
 * symbol 문자열을 바꾸면 바로 반영된다.
 * 나중에 그림으로 바꾸려면 해당 항목에 icon: "icons/xray.svg" 처럼 경로를 추가한다.
 */

const locations = [
  {
    id: "record",
    name: "PATIENT RECORD",
    symbol: "👤",
    answer: 1
  },
  {
    id: "notice",
    name: "RULE / NOTICE",
    symbol: "📋",
    answer: 3
  },
  {
    id: "bed",
    name: "PATIENT BED",
    symbol: "🛏️",
    answer: 4
  },
  {
    id: "specimen",
    name: "EYE SPECIMEN",
    symbol: "👁️",
    answer: 5
  },
  {
    id: "cctv",
    name: "CCTV",
    symbol: "📹",
    answer: 7
  },
  {
    id: "xray",
    name: "X-RAY",
    symbol: "🩻",
    answer: 8
  }
];

const ASSIGN_FLICKER_MS = 240;
const ADMIN_TAP_LIMIT = 5;
const ADMIN_TAP_GAP_MS = 700;

const state = {
  missionLength: 4,
  currentMission: null,
  routeCounter: 0,
  busy: false,
  booted: false,
  booting: false,
  adminTaps: []
};

const ui = {};

function cacheUi() {
  ui.screen = document.getElementById("screen");
  ui.standby = document.getElementById("standby");
  ui.standbyStatus = document.getElementById("standby-status");
  ui.initButton = document.getElementById("init-button");
  ui.mission = document.getElementById("mission");
  ui.route = document.getElementById("route");
  ui.assignFlash = document.getElementById("assign-flash");
  ui.routeId = document.getElementById("route-id");
  ui.newMission = document.getElementById("new-mission");
  ui.verifyTrigger = document.getElementById("verify-code");
  ui.verifyDrawer = document.getElementById("verify-drawer");
  ui.verifyRoute = document.getElementById("verify-route");
  ui.verifyCode = document.getElementById("verify-code-value");
  ui.verifyClose = document.getElementById("verify-close");
  ui.adminHotspot = document.getElementById("admin-hotspot");
  ui.admin = document.getElementById("admin");
  ui.len3 = document.getElementById("len-3");
  ui.len4 = document.getElementById("len-4");
  ui.lengthNote = document.getElementById("length-note");
  ui.adminGenerate = document.getElementById("admin-generate");
  ui.adminReset = document.getElementById("admin-reset");
  ui.adminFullscreen = document.getElementById("admin-fullscreen");
  ui.adminClose = document.getElementById("admin-close");
  ui.adminStatus = document.getElementById("admin-status");
}

function missionKey(mission) {
  if (!mission || !mission.length) {
    return "";
  }
  return mission.map((location) => location.id).join(">");
}

function sameMission(left, right) {
  return missionKey(left) !== "" && missionKey(left) === missionKey(right);
}

/* 전체 순열을 미리 만들지 않는다. n개 셔플 후 앞의 k개를 취하면 순서 있는 조합이 균등하다. */
function shuffleLocations(source) {
  const list = source.slice();

  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = list[index];
    list[index] = list[swapIndex];
    list[swapIndex] = current;
  }

  return list;
}

function pickMission(length) {
  const count = Math.min(length, locations.length);
  let selected = null;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    selected = shuffleLocations(locations).slice(0, count);
    if (!sameMission(selected, state.currentMission)) {
      return selected;
    }
  }

  return selected;
}

function generateRouteId() {
  state.routeCounter += 1;
  const serial = String(state.routeCounter).padStart(3, "0");
  return "AR-" + serial;
}

function createSymbolNode(location) {
  if (location.icon) {
    const image = document.createElement("img");
    image.className = "symbol-icon";
    image.src = location.icon;
    image.alt = "";
    image.draggable = false;
    image.setAttribute("aria-hidden", "true");
    return image;
  }

  const symbol = document.createElement("span");
  symbol.className = "symbol";
  symbol.textContent = location.symbol;
  symbol.setAttribute("aria-hidden", "true");
  return symbol;
}

function renderMission(mission, routeId) {
  const fragment = document.createDocumentFragment();

  mission.forEach((location, index) => {
    if (index > 0) {
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "→";
      arrow.setAttribute("aria-hidden", "true");
      fragment.appendChild(arrow);
    }

    fragment.appendChild(createSymbolNode(location));
  });

  ui.route.replaceChildren(fragment);
  ui.routeId.textContent = "ROUTE ID: " + routeId;
}

function renderVerifiedRoute(mission) {
  const fragment = document.createDocumentFragment();

  mission.forEach((location, index) => {
    if (index > 0) {
      const arrow = document.createElement("span");
      arrow.className = "verify-arrow";
      arrow.textContent = "→";
      fragment.appendChild(arrow);
    }

    const step = document.createElement("span");
    step.className = "verify-step";

    const symbol = document.createElement("span");
    symbol.className = "verify-symbol";
    symbol.textContent = location.symbol;

    const digit = document.createElement("span");
    digit.className = "verify-digit";
    digit.textContent = String(location.answer);

    step.append(symbol, digit);
    fragment.appendChild(step);
  });

  ui.verifyRoute.replaceChildren(fragment);
  ui.verifyCode.textContent = mission.map((location) => String(location.answer)).join("");
}

function openVerifyDrawer() {
  if (!state.currentMission || state.busy) {
    return;
  }

  renderVerifiedRoute(state.currentMission);
  ui.verifyDrawer.classList.add("is-open");
  ui.verifyDrawer.setAttribute("aria-hidden", "false");
}

function closeVerifyDrawer() {
  ui.verifyDrawer.classList.remove("is-open");
  ui.verifyDrawer.setAttribute("aria-hidden", "true");
  ui.verifyRoute.replaceChildren();
  ui.verifyCode.textContent = "";
}

function beginAssignFlash() {
  ui.screen.classList.add("is-routing");
  ui.route.classList.add("is-hidden");
  ui.assignFlash.hidden = false;
}

function endAssignFlash() {
  ui.screen.classList.remove("is-routing");
  ui.route.classList.remove("is-hidden");
  ui.assignFlash.hidden = true;
}

function generateMission() {
  if (!state.booted || state.busy) {
    return;
  }

  state.busy = true;
  closeVerifyDrawer();
  const mission = pickMission(state.missionLength);
  beginAssignFlash();

  window.setTimeout(() => {
    const routeId = generateRouteId();
    state.currentMission = mission;
    renderMission(mission, routeId);
    endAssignFlash();
    state.busy = false;
  }, ASSIGN_FLICKER_MS);
}

function setStandbyMessage(text, mode) {
  ui.standbyStatus.textContent = text;
  ui.standbyStatus.classList.toggle("is-alert", mode === "alert");
  ui.standbyStatus.classList.toggle("is-working", mode === "working");
}

function initializeSystem() {
  if (state.booted || state.booting) {
    return;
  }

  state.booting = true;
  ui.initButton.disabled = true;
  requestFullscreen(false);

  const steps = [
    { at: 0, text: "INITIALIZING..." },
    { at: 280, text: "ACCESSING ARCHIVE..." },
    { at: 560, text: "SYSTEM READY" }
  ];

  steps.forEach((step) => {
    window.setTimeout(() => {
      setStandbyMessage(step.text, "working");
    }, step.at);
  });

  window.setTimeout(() => {
    state.booted = true;
    state.booting = false;
    ui.standby.hidden = true;
    ui.mission.hidden = false;
    generateMission();
  }, 780);
}

function updateLengthButtons() {
  const useThree = state.missionLength === 3;
  ui.len3.setAttribute("aria-pressed", useThree ? "true" : "false");
  ui.len4.setAttribute("aria-pressed", useThree ? "false" : "true");
}

function setMissionLength(length) {
  state.missionLength = length === 3 ? 3 : 4;
  updateLengthButtons();
  ui.lengthNote.textContent = "SET TO " + state.missionLength + " CLUES. APPLIES ON NEXT MISSION.";
  ui.adminStatus.textContent = "";
}

function setAdminStatus(text) {
  ui.adminStatus.textContent = text;
}

function openAdminPanel() {
  state.adminTaps = [];
  ui.admin.hidden = false;
  setAdminStatus("");
}

function closeAdminPanel() {
  ui.admin.hidden = true;
}

function registerAdminTap() {
  const now = Date.now();
  const taps = state.adminTaps;
  const previous = taps[taps.length - 1];

  if (previous && now - previous > ADMIN_TAP_GAP_MS) {
    taps.length = 0;
  }

  taps.push(now);

  if (taps.length >= ADMIN_TAP_LIMIT) {
    openAdminPanel();
  }
}

function resetRouteCounter() {
  state.routeCounter = 0;
  setAdminStatus("COUNTER RESET. NEXT ROUTE: AR-001");
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function requestFullscreen(notify) {
  if (fullscreenElement()) {
    return;
  }

  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;

  if (!request) {
    if (notify) {
      setAdminStatus("FULLSCREEN UNAVAILABLE. TERMINAL STILL ACTIVE.");
    }
    return;
  }

  try {
    const pending = request.call(root);
    if (pending && typeof pending.catch === "function") {
      pending.catch(() => {
        if (notify) {
          setAdminStatus("FULLSCREEN BLOCKED. TERMINAL STILL ACTIVE.");
        }
      });
    }
  } catch (error) {
    if (notify) {
      setAdminStatus("FULLSCREEN BLOCKED. TERMINAL STILL ACTIVE.");
    }
  }
}

function toggleFullscreen() {
  if (fullscreenElement()) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) {
      const pending = exit.call(document);
      if (pending && typeof pending.catch === "function") {
        pending.catch(() => {
          setAdminStatus("FULLSCREEN BLOCKED. TERMINAL STILL ACTIVE.");
        });
      }
    }
    return;
  }

  requestFullscreen(true);
}

function syncFullscreenButton() {
  ui.adminFullscreen.textContent = fullscreenElement() ? "EXIT FULLSCREEN" : "FULLSCREEN";
}

function onAdminGenerate() {
  if (!state.booted) {
    setAdminStatus("SYSTEM STANDBY. USE INITIALIZE.");
    return;
  }

  generateMission();
}

function lockStudentInput() {
  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  document.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

  document.addEventListener("selectstart", (event) => {
    event.preventDefault();
  });

  document.addEventListener("gesturestart", (event) => {
    event.preventDefault();
  });

  document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  }, { passive: false });
}

function bindEvents() {
  ui.initButton.addEventListener("click", initializeSystem);
  ui.newMission.addEventListener("click", generateMission);
  ui.verifyTrigger.addEventListener("click", openVerifyDrawer);
  ui.verifyClose.addEventListener("click", closeVerifyDrawer);

  ui.adminHotspot.addEventListener("pointerup", (event) => {
    event.preventDefault();
    if (!ui.admin.hidden) {
      return;
    }
    registerAdminTap();
  });

  ui.len3.addEventListener("click", () => {
    setMissionLength(3);
  });

  ui.len4.addEventListener("click", () => {
    setMissionLength(4);
  });

  ui.adminGenerate.addEventListener("click", onAdminGenerate);
  ui.adminReset.addEventListener("click", resetRouteCounter);
  ui.adminFullscreen.addEventListener("click", toggleFullscreen);
  ui.adminClose.addEventListener("click", closeAdminPanel);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !ui.admin.hidden) {
      closeAdminPanel();
    }
  });

  document.addEventListener("fullscreenchange", syncFullscreenButton);
  document.addEventListener("webkitfullscreenchange", syncFullscreenButton);
}

function start() {
  cacheUi();
  updateLengthButtons();
  lockStudentInput();
  bindEvents();
}

start();
