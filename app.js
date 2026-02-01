/* =========================
   ระบบรายงานภัยสิ่งแวดล้อมอัจฉริยะ
   Features:
   - 🤖 AI Image Screening
   - ✅ Community Verification
   - 🔥 Heatmap Visualization
========================= */

// Global Error Handler
window.onerror = function(msg, url, line, col, error) {
  console.error("Error:", msg, "Line:", line, "Col:", col);
  return false;
};

const SHEET_URL = "https://script.google.com/macros/s/AKfycbykTdZi9uSydKlqWrDwVPbeSpTNvw221mFJR23buqMFO1XKybR0g3-lo8PRyKmUbu5X/exec";
const STORAGE_KEY_CURRENT_USER = "airbounty_current_user_data";
const USER_PREFIX = "airbounty_user_v2_";
const OTP_EXPIRY_SECONDS = 60;

/* =========================
   DOM REFS
========================= */
const loginScreen = document.getElementById("loginScreen");
const appRoot = document.getElementById("appRoot");
const loginStep = document.getElementById("loginStep");
const otpStep = document.getElementById("otpStep");
const phoneInput = document.getElementById("phoneInput");
const phoneError = document.getElementById("phoneError");
const emailInput = document.getElementById("emailInput");
const emailError = document.getElementById("emailError");
const maskedEmail = document.getElementById("maskedEmail");
const otpError = document.getElementById("otpError");
const returnHint = document.getElementById("returnHint");
const returnPhone = document.getElementById("returnPhone");
const resendText = document.getElementById("resendText");
const resendTimer = document.getElementById("resendTimer");
const userPhoneDisplay = document.getElementById("userPhoneDisplay");
const tokenEl = document.getElementById("token");
const missionCountEl = document.getElementById("missionCount");
const modal = document.getElementById("modal");
const gpsDisplay = document.getElementById("gpsDisplay");
const submitBtn = document.getElementById("submitBtn");

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
let currentUser = null;
let generatedOTP = null;
let otpExpiryTime = null;
let resendCountdown = null;
let isSendingOTP = false;

// AI & Verification State
let aiScreeningResult = null;
let allReports = [];
let heatmapLayer = null;
let heatmapActive = false;

/* =========================
   HELPERS
========================= */
function getUserKey(phone) {
  return USER_PREFIX + phone.replace(/\D/g, '');
}

function loadUserData(phone) {
  const raw = localStorage.getItem(getUserKey(phone));
  if (raw) return JSON.parse(raw);
  return { phone, email: "", missions: 0, tokens: 0 };
}

function saveUserData(data) {
  localStorage.setItem(getUserKey(data.phone), JSON.stringify(data));
}

function setCurrentUser(phone, email) {
  let data = loadUserData(phone);
  if (email) data.email = email;
  currentUser = data;
  localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(currentUser));
  saveUserData(currentUser);
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  currentUser = null;
}

function getCurrentUserSaved() {
  const raw = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
  if (raw) return JSON.parse(raw);
  return null;
}

/* =========================
   VALIDATION
========================= */
function validatePhone(phone) {
  const clean = phone.replace(/\D/g, '');
  return /^0[0-9]{9}$/.test(clean);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatPhoneMask(phone) {
  const clean = phone.replace(/\D/g, '');
  if (clean.length !== 10) return phone;
  return clean[0] + clean[1] + clean[2] + '-XXX-' + clean.slice(-4);
}

function formatEmailMask(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 3) return local + '***@' + domain;
  return local.substring(0, 3) + '***@' + domain;
}

/* =========================
   UI HELPERS
========================= */
function showApp() {
  loginScreen.style.display = "none";
  appRoot.style.display = "block";
  syncUI();
  loadAllReportsAndStats();
}

function showLogin() {
  loginScreen.style.display = "flex";
  appRoot.style.display = "none";
  loginStep.style.display = "flex";
  otpStep.style.display = "none";
  phoneInput.value = "";
  emailInput.value = "";
  phoneError.style.display = "none";
  emailError.style.display = "none";
  clearOTPInputs();
}

function syncUI() {
  if (!currentUser) return;
  userPhoneDisplay.textContent = formatPhoneMask(currentUser.phone);
  tokenEl.textContent = currentUser.tokens;
  missionCountEl.textContent = currentUser.missions;
}

/* =========================
   BOOT
========================= */
(function boot() {
  const saved = getCurrentUserSaved();
  if (saved && saved.phone) {
    returnPhone.textContent = formatPhoneMask(saved.phone);
    returnHint.style.display = "flex";
  }
})();

/* =========================
   OTP FUNCTIONS
========================= */
function sendOTP() {
  if (isSendingOTP) return;
  
  const phone = phoneInput.value.trim();
  const email = emailInput.value.trim();
  let valid = true;

  if (!validatePhone(phone)) {
    showPhoneError();
    valid = false;
  }

  if (!validateEmail(email)) {
    showEmailError();
    valid = false;
  }

  if (!valid) return;

  isSendingOTP = true;
  generatedOTP = String(Math.floor(100000 + Math.random() * 900000));
  otpExpiryTime = Date.now() + (OTP_EXPIRY_SECONDS * 1000);

  console.log(`[OTP] Generated: ${generatedOTP}`);

  fetch(SHEET_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "send_otp",
      email: email,
      otp: generatedOTP,
      phone: phone
    })
  }).finally(() => {
    isSendingOTP = false;
  });

  loginStep.style.display = "none";
  otpStep.style.display = "flex";
  maskedEmail.textContent = formatEmailMask(email);
  startResendTimer();
  setTimeout(() => otpDigits[0].focus(), 100);
}

function showPhoneError() {
  phoneError.style.display = "block";
  phoneInput.classList.add("input-error");
  setTimeout(() => {
    phoneError.style.display = "none";
    phoneInput.classList.remove("input-error");
  }, 3000);
}

function showEmailError() {
  emailError.style.display = "block";
  emailInput.classList.add("input-error");
  setTimeout(() => {
    emailError.style.display = "none";
    emailInput.classList.remove("input-error");
  }, 3000);
}

function verifyOTP() {
  if (Date.now() > otpExpiryTime) {
    showOTPError("รหัส OTP หมดอายุแล้ว");
    return;
  }

  const entered = otpDigits.map(d => d.value).join("").trim();
  if (entered.length !== 6) {
    showOTPError("กรุณากรอกรหัสให้ครบ 6 หลัก");
    return;
  }

  if (entered !== generatedOTP) {
    showOTPError("รหัส OTP ไม่ถูกต้อง");
    return;
  }

  setCurrentUser(phoneInput.value.trim(), emailInput.value.trim());
  showApp();
}

function showOTPError(msg) {
  otpError.textContent = msg;
  otpError.style.display = "block";
  setTimeout(() => otpError.style.display = "none", 3000);
}

function clearOTPInputs() {
  otpDigits.forEach(d => d.value = "");
}

// OTP input auto-focus
otpDigits.forEach((digit, idx) => {
  digit.addEventListener("input", (e) => {
    if (e.target.value && idx < 5) otpDigits[idx + 1].focus();
  });
  digit.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !e.target.value && idx > 0) {
      otpDigits[idx - 1].focus();
    }
  });
});

function resendOTP() {
  generatedOTP = String(Math.floor(100000 + Math.random() * 900000));
  otpExpiryTime = Date.now() + (OTP_EXPIRY_SECONDS * 1000);

  fetch(SHEET_URL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({
      action: "send_otp",
      email: emailInput.value.trim(),
      otp: generatedOTP,
      phone: phoneInput.value.trim()
    })
  });

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
      clearInterval(resendCountdown);
      btn.disabled = false;
      resendText.style.display = "inline";
      resendTimer.style.display = "none";
    }
  }, 1000);
}

function backToLogin() {
  otpStep.style.display = "none";
  loginStep.style.display = "flex";
  phoneInput.focus();
  if (resendCountdown) clearInterval(resendCountdown);
}

function handleQuickLogin() {
  const saved = getCurrentUserSaved();
  if (!saved || !saved.phone) return;
  setCurrentUser(saved.phone, saved.email);
  showApp();
}

function handleLogout() {
  clearCurrentUser();
  showLogin();
}

/* =========================
   MAP & GPS
========================= */
let currentLat = null;
let currentLng = null;
let map = null;
let marker = null;

function openModal() {
  modal.classList.add("active");
  resetImageUpload();
  aiScreeningResult = null;
  submitBtn.disabled = true;

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
    (err) => {
      console.warn("GPS Error:", err);
      currentLat = 13.7563;
      currentLng = 100.5018;
      gpsDisplay.textContent = "ไม่พบตำแหน่ง (ค่าเริ่มต้น: กทม.)";
      initMap(currentLat, currentLng);
    },
    { enableHighAccuracy: true }
  );
}

function closeModal() {
  modal.classList.remove("active");
}

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

document.getElementById("openMapBtn").onclick = () => {
  if (!currentLat || !currentLng) return;
  window.open(`https://www.google.com/maps?q=${currentLat},${currentLng}`, "_blank");
};

/* =========================
   🔥 HEATMAP TOGGLE
========================= */
function toggleHeatmap() {
  const btn = document.getElementById("heatmapBtn");
  const legend = document.getElementById("heatmapLegend");

  if (heatmapActive) {
    // ปิด heatmap
    if (heatmapLayer) {
      map.removeLayer(heatmapLayer);
      heatmapLayer = null;
    }
    legend.classList.remove("active");
    btn.classList.remove("active");
    heatmapActive = false;
  } else {
    // เปิด heatmap
    if (allReports.length > 0) {
      const heatData = allReports
        .filter(r => r.lat && r.lng)
        .map(r => [r.lat, r.lng, 1]); // [lat, lng, intensity]

      heatmapLayer = L.heatLayer(heatData, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        max: 1.0,
        gradient: {
          0.0: '#3b82f6',
          0.5: '#eab308',
          1.0: '#ef4444'
        }
      }).addTo(map);

      legend.classList.add("active");
      btn.classList.add("active");
      heatmapActive = true;
    } else {
      alert("ยังไม่มีข้อมูลรายงานเพื่อแสดง Heatmap");
    }
  }
}

/* =========================
   📥 LOAD ALL REPORTS & STATS
========================= */
function loadAllReportsAndStats() {
  fetch(SHEET_URL)
    .then(res => res.json())
    .then(data => {
      allReports = data;
      
      // Update stats
      document.getElementById("totalReports").textContent = data.length;
      
      const verified = data.filter(r => r.verified_count >= 2).length;
      document.getElementById("verifiedReports").textContent = verified;
      
      const accuracy = data.length > 0 ? Math.round((verified / data.length) * 100) : 0;
      document.getElementById("accuracyRate").textContent = accuracy + "%";

      // Update pending badge
      const pending = data.filter(r => r.ai_approved && (!r.verified_count || r.verified_count < 2) && r.username !== currentUser.phone);
      const badge = document.getElementById("pendingBadge");
      if (pending.length > 0) {
        badge.textContent = pending.length;
        badge.style.display = "block";
      } else {
        badge.style.display = "none";
      }
    })
    .catch(err => console.error("Load reports error:", err));
}

function loadAllReports() {
  fetch(SHEET_URL)
    .then(res => res.json())
    .then(data => {
      allReports = data;
      data.forEach(item => {
        if (!item.lat || !item.lng) return;
        const color = item.verified_count >= 2 ? "#22c55e" : "#ff5722";
        L.circleMarker([item.lat, item.lng], {
          radius: 6,
          color: color,
          fillOpacity: 0.8
        })
        .addTo(map)
        .bindPopup(`
          🔥 ${item.mission_type}<br>
          📱 ${item.username}<br>
          ${item.verified_count >= 2 ? '✅ ยืนยันแล้ว' : '⏳ รอการยืนยัน'}
        `);
      });
    })
    .catch(err => console.error("Load reports error:", err));
}

/* =========================
   🤖 AI IMAGE SCREENING
========================= */
let currentImageBase64 = null;

window.handleImageUpload = async function(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async function(e) {
      currentImageBase64 = e.target.result;
      const previewImage = document.getElementById('previewImage');
      const imagePlaceholder = document.getElementById('imagePlaceholder');
      const removeImageBtn = document.getElementById('removeImageBtn');

      if (previewImage) {
        previewImage.src = currentImageBase64;
        previewImage.style.display = 'block';
      }
      if (imagePlaceholder) imagePlaceholder.style.display = 'none';
      if (removeImageBtn) removeImageBtn.style.display = 'flex';

      // 🤖 เริ่ม AI Screening
      await runAIScreening(currentImageBase64);
    };

    reader.readAsDataURL(file);
  }
};

async function runAIScreening(imageBase64) {
  const section = document.getElementById("aiScreeningSection");
  const loadingState = document.getElementById("aiLoadingState");
  const resultState = document.getElementById("aiResultState");

  section.classList.add("active");
  loadingState.style.display = "flex";
  resultState.style.display = "none";
  submitBtn.disabled = true;

  try {
    // ตรวจสอบ media type จาก base64
    let mediaType = "image/jpeg";
    if (imageBase64.startsWith("data:image/png")) {
      mediaType = "image/png";
    } else if (imageBase64.startsWith("data:image/webp")) {
      mediaType = "image/webp";
    } else if (imageBase64.startsWith("data:image/gif")) {
      mediaType = "image/gif";
    }

    const base64Data = imageBase64.split(',')[1];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "ANTHROPIC_API_KEY_PLACEHOLDER"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data
                }
              },
              {
                type: "text",
                text: `คุณเป็น AI ผู้เชี่ยวชาญในการตรวจจับภัยสิ่งแวดล้อม วิเคราะห์รูปภาพนี้และตอบในรูปแบบ JSON เท่านั้น:

{
  "is_environmental_hazard": true/false,
  "hazard_type": "เผาขยะ/ไฟป่า/ควันโรงงาน/ควันรถ/ไม่พบภัย",
  "confidence": 0-100,
  "description": "คำอธิบายสั้นๆ ว่าเห็นอะไรในรูป ภาษาไทย"
}

ตรวจหา: ควัน, ไฟ, เปลวไฟ, การเผา, มลพิษทางอากาศ, ควันโรงงาน, ท่อควัน`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log("AI Response:", data);
    
    const aiText = data.content.find(c => c.type === "text")?.text || "{}";
    
    // ลบ markdown code fences ถ้ามี
    const cleanJson = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanJson);

    aiScreeningResult = result;

    // แสดงผลลัพธ์
    loadingState.style.display = "none";
    resultState.style.display = "flex";

    const resultIcon = document.getElementById("aiResultIcon");
    const resultTitle = document.getElementById("aiResultTitle");
    const resultDetail = document.getElementById("aiResultDetail");
    const confidence = document.getElementById("aiConfidence");

    if (result.is_environmental_hazard && result.confidence >= 70) {
      resultIcon.textContent = "✅";
      resultTitle.textContent = "ตรวจพบภัยสิ่งแวดล้อม";
      resultDetail.textContent = result.description;
      confidence.textContent = `🎯 ความมั่นใจ: ${result.confidence}%`;
      confidence.className = "ai-confidence";
      submitBtn.disabled = false;
    } else if (result.is_environmental_hazard && result.confidence >= 40) {
      resultIcon.textContent = "⚠️";
      resultTitle.textContent = "พบภัยไม่แน่ชัด";
      resultDetail.textContent = result.description + " - แนะนำให้ตรวจสอบเพิ่มเติม";
      confidence.textContent = `⚠️ ความมั่นใจ: ${result.confidence}%`;
      confidence.className = "ai-confidence medium";
      submitBtn.disabled = false;
    } else {
      resultIcon.textContent = "❌";
      resultTitle.textContent = "ไม่พบภัยสิ่งแวดล้อมที่ชัดเจน";
      resultDetail.textContent = result.description;
      confidence.textContent = `❌ ความมั่นใจ: ${result.confidence}%`;
      confidence.className = "ai-confidence low";
      submitBtn.disabled = true;
    }

  } catch (error) {
    console.error("AI Screening Error:", error);
    loadingState.style.display = "none";
    resultState.style.display = "flex";
    
    const resultIcon = document.getElementById("aiResultIcon");
    const resultTitle = document.getElementById("aiResultTitle");
    const resultDetail = document.getElementById("aiResultDetail");
    
    resultIcon.textContent = "⚠️";
    resultTitle.textContent = "เกิดข้อผิดพลาด";
    
    // แสดง error message ที่เป็นประโยชน์
    if (error.message.includes("API Error")) {
      resultDetail.textContent = "ไม่สามารถเชื่อมต่อ AI API ได้ กรุณาตรวจสอบ API Key หรือลองใหม่ในภายหลัง";
    } else if (error.message.includes("JSON")) {
      resultDetail.textContent = "AI ตอบกลับไม่ถูกต้อง กรุณาลองอัปโหลดรูปใหม่";
    } else {
      resultDetail.textContent = `ข้อผิดพลาด: ${error.message}`;
    }
    
    submitBtn.disabled = true;
  }
}

window.removeImage = function(event) {
  if (event) event.stopPropagation();
  resetImageUpload();
};

function resetImageUpload() {
  const input = document.getElementById('incidentImage');
  const previewImage = document.getElementById('previewImage');
  const imagePlaceholder = document.getElementById('imagePlaceholder');
  const removeImageBtn = document.getElementById('removeImageBtn');
  const section = document.getElementById("aiScreeningSection");

  if (input) input.value = '';
  currentImageBase64 = null;
  aiScreeningResult = null;
  
  if (previewImage) {
    previewImage.src = '';
    previewImage.style.display = 'none';
  }
  if (imagePlaceholder) imagePlaceholder.style.display = 'flex';
  if (removeImageBtn) removeImageBtn.style.display = 'none';
  if (section) section.classList.remove("active");
  
  submitBtn.disabled = true;
}

/* =========================
   📤 SUBMIT MISSION
========================= */
function submitMission() {
  if (!currentImageBase64 || !aiScreeningResult || !aiScreeningResult.is_environmental_hazard) {
    alert("กรุณาอัปโหลดรูปภาพที่ผ่านการตรวจสอบจาก AI");
    return;
  }

  closeModal();

  const selectedType = document.querySelector('input[name="type"]:checked');
  const type = selectedType ? selectedType.value : "เผาขยะ";
  const reward = Math.floor(Math.random() * 10) + 15; // 15-25 tokens

  currentUser.missions += 1;
  currentUser.tokens += reward;
  saveUserData(currentUser);
  syncUI();

  // บันทึกพร้อม AI result
  fetch(SHEET_URL, {
    method: "POST",
    body: JSON.stringify({
      username: currentUser.phone,
      mission_type: type,
      token: reward,
      lat: currentLat,
      lng: currentLng,
      image: currentImageBase64,
      ai_approved: true,
      ai_confidence: aiScreeningResult.confidence,
      ai_description: aiScreeningResult.description,
      verified_count: 0,
      timestamp: new Date().toISOString()
    })
  });

  showToast(reward);
  resetImageUpload();
  
  // Reload stats after 1 second
  setTimeout(loadAllReportsAndStats, 1000);
}

/* =========================
   ✅ COMMUNITY VERIFICATION
========================= */
function openVerifyModal() {
  const verifyModal = document.getElementById("verifyModal");
  const listEl = document.getElementById("pendingReportsList");
  
  verifyModal.classList.add("active");
  listEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">🔄 กำลังโหลด...</div>';

  // โหลดรายงานที่รอการยืนยัน
  fetch(SHEET_URL)
    .then(res => res.json())
    .then(data => {
      // กรองเฉพาะรายงานที่:
      // 1. ผ่าน AI แล้ว
      // 2. ยังไม่ถึง 2 คนยืนยัน
      // 3. ไม่ใช่รายงานของตัวเอง
      const pending = data.filter(r => 
        r.ai_approved && 
        (!r.verified_count || r.verified_count < 2) &&
        r.username !== currentUser.phone
      );

      if (pending.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">✅</div>
            <div class="empty-state-text">ไม่มีรายงานที่รอการยืนยัน<br>กลับมาตรวจสอบใหม่ภายหลัง</div>
          </div>
        `;
        return;
      }

      // สร้าง cards
      listEl.innerHTML = pending.map(report => {
        const timeAgo = getTimeAgo(report.timestamp);
        return `
          <div class="pending-report-card" data-id="${report.id || report.timestamp}">
            <div class="report-header">
              <div class="report-type">
                ${getTypeIcon(report.mission_type)} ${report.mission_type}
              </div>
              <div class="report-time">${timeAgo}</div>
            </div>
            
            ${report.image ? `<img src="${report.image}" class="report-image" alt="รูปภาพรายงาน">` : ''}
            
            <div class="report-location">📍 ${report.lat?.toFixed(5)}, ${report.lng?.toFixed(5)}</div>
            
            <div class="ai-badge">
              🤖 AI ตรวจสอบแล้ว: ${report.ai_confidence}% - ${report.ai_description}
            </div>
            
            <div class="verify-actions">
              <button class="verify-btn confirm" onclick="verifyReport('${report.id || report.timestamp}', true)">
                ✅ ยืนยัน (+5 โทเค็น)
              </button>
              <button class="verify-btn reject" onclick="verifyReport('${report.id || report.timestamp}', false)">
                ❌ รายงานผิด
              </button>
            </div>
          </div>
        `;
      }).join('');
    })
    .catch(err => {
      console.error("Load pending reports error:", err);
      listEl.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">เกิดข้อผิดพลาด กรุณาลองใหม่</div>';
    });
}

function closeVerifyModal() {
  document.getElementById("verifyModal").classList.remove("active");
}

window.verifyReport = function(reportId, isValid) {
  if (isValid) {
    // ให้รางวัล 5 tokens
    currentUser.tokens += 5;
    saveUserData(currentUser);
    syncUI();

    // บันทึกการยืนยัน
    fetch(SHEET_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "verify_report",
        report_id: reportId,
        verifier: currentUser.phone,
        is_valid: true
      })
    });

    showToast(5);
    
    // ลบ card ออกจากรายการ
    const card = document.querySelector(`[data-id="${reportId}"]`);
    if (card) card.remove();
    
    // ตรวจสอบว่าเหลือรายงานไหม
    const remaining = document.querySelectorAll(".pending-report-card").length;
    if (remaining === 0) {
      closeVerifyModal();
    }
    
    setTimeout(loadAllReportsAndStats, 500);
  } else {
    // ถ้ารายงานผิด ให้บันทึกแต่ไม่ให้โทเค็น
    fetch(SHEET_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "verify_report",
        report_id: reportId,
        verifier: currentUser.phone,
        is_valid: false
      })
    });

    const card = document.querySelector(`[data-id="${reportId}"]`);
    if (card) card.remove();
    
    alert("ขอบคุณที่ช่วยตรวจสอบ");
  }
};

function getTimeAgo(timestamp) {
  if (!timestamp) return "เมื่อสักครู่";
  const now = new Date();
  const past = new Date(timestamp);
  const diff = Math.floor((now - past) / 1000 / 60); // minutes
  
  if (diff < 1) return "เมื่อสักครู่";
  if (diff < 60) return `${diff} นาทีที่แล้ว`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(diff / 1440)} วันที่แล้ว`;
}

function getTypeIcon(type) {
  const icons = {
    "เผาขยะ": "🔥",
    "ไฟป่า": "🌲",
    "ควันดำรถ": "🚌",
    "โรงงาน": "🏭"
  };
  return icons[type] || "🔥";
}

/* =========================
   STORE / REDEEM
========================= */
const storeModal = document.getElementById("storeModal");
const storeTokenBalance = document.getElementById("storeTokenBalance");

function openStoreModal() {
  storeTokenBalance.textContent = currentUser.tokens;
  storeModal.classList.add("active");
}

function closeStoreModal() {
  storeModal.classList.remove("active");
}

function redeemItem(cost, itemName) {
  if (currentUser.tokens >= cost) {
    if (confirm(`ยืนยันแลก "${itemName}" ด้วย ${cost} โทเค็น?`)) {
      currentUser.tokens -= cost;
      saveUserData(currentUser);
      syncUI();
      storeTokenBalance.textContent = currentUser.tokens;
      alert(`แลก "${itemName}" สำเร็จ!`);
    }
  } else {
    alert("โทเค็นของคุณไม่เพียงพอ");
  }
}

/* =========================
   TOAST
========================= */
function showToast(reward) {
  const toast = document.getElementById("successToast");
  const rewardSpan = document.getElementById("toastReward");
  rewardSpan.textContent = `+${reward}`;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}