/* =========================
   CONSTANTS
========================= */
const SHEET_URL =
  "https://script.google.com/macros/s/AKfycby7sBvzh39iPd7_ov8Jsz_FYE2_pir_kPAFd7Swwl6Pks7SxHpuL8ktsJSXf56EhnWH/exec";

const STORAGE_KEY_CURRENT_USER = "airbounty_current_user"; // stores the logged-in name (or null)
const USER_PREFIX = "airbounty_user_";                     // prefix + name = per-user data key

/* =========================
   DOM REFS
========================= */
const loginScreen      = document.getElementById("loginScreen");
const appRoot          = document.getElementById("appRoot");
const loginNameInput   = document.getElementById("loginNameInput");
const loginError       = document.getElementById("loginError");
const returnHint       = document.getElementById("returnHint");
const returnName       = document.getElementById("returnName");
const userNameDisplay  = document.getElementById("userNameDisplay");
const tokenEl          = document.getElementById("token");
const missionCountEl   = document.getElementById("missionCount");
const modal            = document.getElementById("modal");
const gpsDisplay       = document.getElementById("gpsDisplay");

/* =========================
   HELPERS – per-user storage
========================= */
function getUserKey(name) {
  return USER_PREFIX + name.trim().toLowerCase();
}

function loadUserData(name) {
  const raw = localStorage.getItem(getUserKey(name));
  if (raw) return JSON.parse(raw);
  // brand new user
  return { displayName: name.trim(), missions: 0, tokens: 0 };
}

function saveUserData(data) {
  localStorage.setItem(getUserKey(data.displayName), JSON.stringify(data));
}

/* =========================
   CURRENT SESSION
========================= */
let currentUser = null; // { displayName, missions, tokens }

function setCurrentUser(name) {
  localStorage.setItem(STORAGE_KEY_CURRENT_USER, name);
  currentUser = loadUserData(name);
  saveUserData(currentUser); // ensure it exists
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  currentUser = null;
}

function getCurrentUserName() {
  return localStorage.getItem(STORAGE_KEY_CURRENT_USER);
}

/* =========================
   UI HELPERS
========================= */
function showApp() {
  loginScreen.style.display = "none";
  appRoot.style.display = "block";
  syncUI();
}

function showLogin() {
  loginScreen.style.display = "flex";
  appRoot.style.display = "none";
  loginNameInput.value = "";
  loginError.style.display = "none";
}

function syncUI() {
  if (!currentUser) return;
  userNameDisplay.textContent = currentUser.displayName;
  tokenEl.textContent         = currentUser.tokens;
  missionCountEl.textContent  = currentUser.missions;
}

/* =========================
   BOOT – check returning user
========================= */
(function boot() {
  const saved = getCurrentUserName();
  if (saved) {
    // Show hint for returning user
    returnName.textContent = saved;
    returnHint.style.display = "flex";
  }
})();

/* =========================
   LOGIN HANDLERS
========================= */
function handleLogin() {
  const raw = loginNameInput.value.trim();

  // Validate: at least 2 chars, only Thai / English / numbers / spaces
  if (!raw || raw.length < 2) {
    showError();
    return;
  }

  setCurrentUser(raw);
  showApp();
}

function handleReturn() {
  const saved = getCurrentUserName();
  if (!saved) return;
  setCurrentUser(saved);
  showApp();
}

function showError() {
  loginError.style.display = "block";
  // re-trigger shake animation
  loginError.style.animation = "none";
  void loginError.offsetWidth; // force reflow
  loginError.style.animation = "";
  loginNameInput.focus();
}

// Hide error on input
loginNameInput.addEventListener("input", () => {
  loginError.style.display = "none";
});

// Enter key submits
loginNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});

/* =========================
   LOGOUT
========================= */
function handleLogout() {
  clearCurrentUser();
  showLogin();
}

/* =========================
   MAP & GPS STATE
========================= */
let currentLat = null;
let currentLng = null;
let map        = null;
let marker     = null;

/* =========================
   OPEN / CLOSE MODAL
========================= */
function openModal() {
  modal.classList.add("active");

  if (!navigator.geolocation) {
    gpsDisplay.textContent = "อุปกรณ์ไม่รองรับ GPS";
    return;
  }

  gpsDisplay.textContent = "กำลังดึงตำแหน่ง…";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLat = position.coords.latitude;
      currentLng = position.coords.longitude;
      gpsDisplay.textContent = currentLat.toFixed(5) + ", " + currentLng.toFixed(5);
      initMap(currentLat, currentLng);
    },
    () => {
      gpsDisplay.textContent = "ไม่สามารถดึงตำแหน่งได้";
    },
    { enableHighAccuracy: true }
  );
}

function closeModal() {
  modal.classList.remove("active");
}

/* =========================
   INIT MAP (LEAFLET)
========================= */
function initMap(lat, lng) {
  if (map) {
    map.setView([lat, lng], 16);
    marker.setLatLng([lat, lng]);
    return;
  }

  map = L.map("map").setView([lat, lng], 16);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  marker = L.marker([lat, lng], { draggable: true }).addTo(map);

  marker.on("dragend", (e) => {
    const pos = e.target.getLatLng();
    currentLat = pos.lat;
    currentLng = pos.lng;
    gpsDisplay.textContent = currentLat.toFixed(5) + ", " + currentLng.toFixed(5);
  });

  loadAllReports();
}

/* =========================
   LOAD ALL REPORTS
========================= */
function loadAllReports() {
  fetch(SHEET_URL)
    .then((res) => res.json())
    .then((data) => {
      data.forEach((item) => {
        if (!item.lat || !item.lng) return;
        L.circleMarker([item.lat, item.lng], {
          radius: 6,
          color: "#ff5722",
          fillOpacity: 0.8
        })
          .addTo(map)
          .bindPopup(`🔥 ${item.mission_type}<br>👤 ${item.username}`);
      });
    })
    .catch((err) => console.error("Load reports error:", err));
}

/* =========================
   OPEN GOOGLE MAPS
========================= */
document.getElementById("openMapBtn").onclick = () => {
  if (!currentLat || !currentLng) return;
  window.open(`https://www.google.com/maps?q=${currentLat},${currentLng}`, "_blank");
};

/* =========================
   SUBMIT MISSION
========================= */
function submitMission() {
  closeModal();

  const selectedType = document.querySelector('input[name="type"]:checked');
  const type   = selectedType ? selectedType.value : "เผาขยะ";
  const reward = Math.floor(Math.random() * 10) + 10;

  // Update current user data
  currentUser.missions += 1;
  currentUser.tokens  += reward;
  saveUserData(currentUser);
  syncUI();

  // Push to Google Sheet
  fetch(SHEET_URL, {
    method: "POST",
    body: JSON.stringify({
      username:     currentUser.displayName,
      mission_type: type,
      token:        reward,
      lat:          currentLat,
      lng:          currentLng
    })
  });

  showToast(reward);
}

/* =========================
   TOAST
========================= */
function showToast(reward) {
  const toast       = document.getElementById("successToast");
  const rewardSpan  = document.getElementById("toastReward");
  rewardSpan.textContent = `+${reward}`;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}