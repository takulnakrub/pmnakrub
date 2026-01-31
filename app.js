/* =========================
   CONSTANTS
========================= */
const SHEET_URL =
  "https://script.google.com/macros/s/AKfycby7sBvzh39iPd7_ov8Jsz_FYE2_pir_kPAFd7Swwl6Pks7SxHpuL8ktsJSXf56EhnWH/exec";

const STORAGE_KEY_CURRENT_USER = "airbounty_current_phone";
const USER_PREFIX = "airbounty_user_";

const OTP_EXPIRY_SECONDS = 60;

/* =========================
   DOM REFS
========================= */
const loginScreen       = document.getElementById("loginScreen");
const appRoot           = document.getElementById("appRoot");
const phoneStep         = document.getElementById("phoneStep");
const otpStep           = document.getElementById("otpStep");
const phoneInput        = document.getElementById("phoneInput");
const phoneError        = document.getElementById("phoneError");
const maskedPhone       = document.getElementById("maskedPhone");
const mockOTPCode       = document.getElementById("mockOTPCode");
const otpError          = document.getElementById("otpError");
const returnHint        = document.getElementById("returnHint");
const returnPhone       = document.getElementById("returnPhone");
const resendText        = document.getElementById("resendText");
const resendTimer       = document.getElementById("resendTimer");
const userPhoneDisplay  = document.getElementById("userPhoneDisplay");
const tokenEl           = document.getElementById("token");
const missionCountEl    = document.getElementById("missionCount");
const modal             = document.getElementById("modal");
const gpsDisplay        = document.getElementById("gpsDisplay");

const otpDigits = [
  document.getElementById("otp1"),
  document.getElementById("otp2"),
  document.getElementById("otp3"),
  document.getElementById("otp4"),
  document.getElementById("otp5"),
  document.getElementById("otp6")
];

/* =========================
   STATE
========================= */
let currentUser       = null; // { phone, missions, tokens }
let generatedOTP      = null;
let otpExpiryTime     = null;
let resendCountdown   = null;

/* =========================
   HELPERS – per-user storage
========================= */
function getUserKey(phone) {
  return USER_PREFIX + phone.replace(/\D/g, '');
}

function loadUserData(phone) {
  const raw = localStorage.getItem(getUserKey(phone));
  if (raw) return JSON.parse(raw);
  return { phone, missions: 0, tokens: 0 };
}

function saveUserData(data) {
  localStorage.setItem(getUserKey(data.phone), JSON.stringify(data));
}

function setCurrentUser(phone) {
  localStorage.setItem(STORAGE_KEY_CURRENT_USER, phone);
  currentUser = loadUserData(phone);
  saveUserData(currentUser);
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  currentUser = null;
}

function getCurrentUserPhone() {
  return localStorage.getItem(STORAGE_KEY_CURRENT_USER);
}

/* =========================
   PHONE VALIDATION
========================= */
function validatePhone(phone) {
  const clean = phone.replace(/\D/g, '');
  // Thai mobile: 10 digits starting with 0
  return /^0[0-9]{9}$/.test(clean);
}

function formatPhoneMask(phone) {
  const clean = phone.replace(/\D/g, '');
  if (clean.length !== 10) return phone;
  // 08X-XXX-XXXX
  return clean[0] + clean[1] + clean[2] + '-XXX-' + clean.slice(-4);
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
  phoneStep.style.display = "flex";
  otpStep.style.display = "none";
  phoneInput.value = "";
  phoneError.style.display = "none";
  clearOTPInputs();
}

function syncUI() {
  if (!currentUser) return;
  userPhoneDisplay.textContent = formatPhoneMask(currentUser.phone);
  tokenEl.textContent          = currentUser.tokens;
  missionCountEl.textContent   = currentUser.missions;
}

/* =========================
   BOOT – check returning user
========================= */
(function boot() {
  const saved = getCurrentUserPhone();
  if (saved) {
    returnPhone.textContent = formatPhoneMask(saved);
    returnHint.style.display = "flex";
  }
})();

/* =========================
   STEP 1: SEND OTP
========================= */
function sendOTP() {
  const phone = phoneInput.value.trim();

  if (!validatePhone(phone)) {
    showPhoneError();
    return;
  }

  // Generate 6-digit OTP
  generatedOTP = String(Math.floor(100000 + Math.random() * 900000));
  otpExpiryTime = Date.now() + (OTP_EXPIRY_SECONDS * 1000);

  // Show OTP in mock display
  mockOTPCode.textContent = generatedOTP;

  // TODO: Replace with actual SMS API call
  // sendSMSviaAPI(phone, generatedOTP);

  console.log(`[MOCK SMS] Sending OTP ${generatedOTP} to ${phone}`);

  // Switch to OTP step
  phoneStep.style.display = "none";
  otpStep.style.display = "flex";
  maskedPhone.textContent = formatPhoneMask(phone);

  clearOTPInputs();
  otpDigits[0].focus();

  startResendTimer();
}

function showPhoneError() {
  phoneError.style.display = "block";
  phoneError.style.animation = "none";
  void phoneError.offsetWidth;
  phoneError.style.animation = "";
  phoneInput.focus();
}

phoneInput.addEventListener("input", () => {
  phoneError.style.display = "none";
  // Auto-format or limit to numbers only
  phoneInput.value = phoneInput.value.replace(/[^0-9]/g, '');
});

phoneInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendOTP();
});

/* =========================
   STEP 2: VERIFY OTP
========================= */
function verifyOTP() {
  const enteredOTP = otpDigits.map(inp => inp.value).join("");

  if (enteredOTP.length !== 6) {
    showOTPError("กรุณากรอกรหัส OTP ให้ครบ 6 หลัก");
    return;
  }

  // Check expiry
  if (Date.now() > otpExpiryTime) {
    showOTPError("รหัส OTP หมดอายุ กรุณาขอรหัสใหม่");
    return;
  }

  // Check code
  if (enteredOTP !== generatedOTP) {
    showOTPError("รหัส OTP ไม่ถูกต้อง");
    shakeOTPInputs();
    return;
  }

  // Success!
  const phone = phoneInput.value.trim();
  setCurrentUser(phone);
  stopResendTimer();
  showApp();
}

function showOTPError(msg) {
  otpError.textContent = msg;
  otpError.style.display = "block";
  otpError.style.animation = "none";
  void otpError.offsetWidth;
  otpError.style.animation = "";
}

function shakeOTPInputs() {
  otpDigits.forEach(inp => {
    inp.classList.add("error");
    setTimeout(() => inp.classList.remove("error"), 400);
  });
}

function clearOTPInputs() {
  otpDigits.forEach(inp => {
    inp.value = "";
    inp.classList.remove("filled", "error");
  });
  otpError.style.display = "none";
}

/* =========================
   OTP INPUT AUTO-FOCUS
========================= */
otpDigits.forEach((input, idx) => {
  input.addEventListener("input", (e) => {
    otpError.style.display = "none";

    const val = e.target.value;
    if (val.length > 0) {
      input.classList.add("filled");
      // Move to next
      if (idx < 5) otpDigits[idx + 1].focus();
    } else {
      input.classList.remove("filled");
    }
  });

  input.addEventListener("keydown", (e) => {
    // Backspace: move to previous
    if (e.key === "Backspace" && !input.value && idx > 0) {
      otpDigits[idx - 1].focus();
    }
    // Enter on last digit: verify
    if (e.key === "Enter" && idx === 5) {
      verifyOTP();
    }
  });

  // Only allow digits
  input.addEventListener("beforeinput", (e) => {
    if (e.data && !/^[0-9]$/.test(e.data)) {
      e.preventDefault();
    }
  });
});

/* =========================
   RESEND OTP
========================= */
function resendOTP() {
  // Re-generate OTP
  generatedOTP = String(Math.floor(100000 + Math.random() * 900000));
  otpExpiryTime = Date.now() + (OTP_EXPIRY_SECONDS * 1000);
  mockOTPCode.textContent = generatedOTP;

  const phone = phoneInput.value.trim();
  console.log(`[MOCK SMS] Resending OTP ${generatedOTP} to ${phone}`);

  clearOTPInputs();
  otpDigits[0].focus();
  startResendTimer();
}

function startResendTimer() {
  let remaining = OTP_EXPIRY_SECONDS;
  const btn = document.querySelector(".resend-btn");

  btn.disabled = true;
  resendText.style.display = "none";
  resendTimer.style.display = "inline";
  resendTimer.textContent = `(${remaining})`;

  resendCountdown = setInterval(() => {
    remaining--;
    resendTimer.textContent = `(${remaining})`;

    if (remaining <= 0) {
      stopResendTimer();
    }
  }, 1000);
}

function stopResendTimer() {
  if (resendCountdown) clearInterval(resendCountdown);
  const btn = document.querySelector(".resend-btn");
  btn.disabled = false;
  resendText.style.display = "inline";
  resendTimer.style.display = "none";
}

/* =========================
   BACK TO PHONE
========================= */
function backToPhone() {
  otpStep.style.display = "none";
  phoneStep.style.display = "flex";
  phoneInput.focus();
  stopResendTimer();
}

/* =========================
   QUICK LOGIN (returning user)
========================= */
function handleQuickLogin() {
  const saved = getCurrentUserPhone();
  if (!saved) return;
  setCurrentUser(saved);
  showApp();
}

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
          .bindPopup(`🔥 ${item.mission_type}<br>📱 ${item.username}`);
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

  currentUser.missions += 1;
  currentUser.tokens  += reward;
  saveUserData(currentUser);
  syncUI();

  fetch(SHEET_URL, {
    method: "POST",
    body: JSON.stringify({
      username:     currentUser.phone,
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
  const toast      = document.getElementById("successToast");
  const rewardSpan = document.getElementById("toastReward");
  rewardSpan.textContent = `+${reward}`;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}