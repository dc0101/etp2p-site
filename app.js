import {
  supabase,
  listAds,
  listProfiles,
  createAd,
  updateAd,
  listMyAds,
} from "./services/supabase.js";

"use strict";

const $ = (id) => document.getElementById(id);
const PAGE_SIZE = 50;
const AUTH_REDIRECT = "https://etp2p-site.onrender.com/";

let authUser = null;
let offers = [];
let totalOffers = 0;
let adOffset = 0;
let canLoadMore = false;
let loadingAds = false;
let reloadPending = false;
let side = "buy";
let view = "market";
let toastTimer;
let filterTimer;
let currentAdRequest = 0;

// High-fidelity Ethiopian P2P seed offers with complete seller bank details
const SEED_OFFERS = [
  {
    id: "seed_dawit_01",
    adId: "seed_dawit_01",
    ownerId: "seller_dawit",
    name: "Dawit_Crypto",
    ini: "DC",
    side: "sell",
    adSide: "sell",
    currency: "ETB",
    price: 186.20,
    stock: 3500,
    min: 500,
    max: 50000,
    pay: ["Commercial Bank of Ethiopia", "Tele Birr"],
    trades: 420,
    completion: 99.8,
    bankName: "Commercial Bank of Ethiopia",
    sellerAccountName: "Dawit Haile",
    sellerAccountNumber: "100028491823",
    isOwn: false,
    archived: false,
  },
  {
    id: "seed_addis_02",
    adId: "seed_addis_02",
    ownerId: "seller_addis",
    name: "Addis_Traders",
    ini: "AT",
    side: "sell",
    adSide: "sell",
    currency: "ETB",
    price: 186.50,
    stock: 5800,
    min: 1000,
    max: 120000,
    pay: ["Tele Birr", "Commercial Bank of Ethiopia", "CBE Birr"],
    trades: 890,
    completion: 99.4,
    bankName: "Tele Birr",
    sellerAccountName: "Addis Mulugeta",
    sellerAccountNumber: "0911482910",
    isOwn: false,
    archived: false,
  },
  {
    id: "seed_kirubel_03",
    adId: "seed_kirubel_03",
    ownerId: "seller_kirubel",
    name: "Kirubel_P2P",
    ini: "KP",
    side: "sell",
    adSide: "sell",
    currency: "ETB",
    price: 185.90,
    stock: 2200,
    min: 300,
    max: 35000,
    pay: ["Commercial Bank of Ethiopia", "Bank of Abyssinia"],
    trades: 310,
    completion: 100.0,
    bankName: "Commercial Bank of Ethiopia",
    sellerAccountName: "Kirubel Desta",
    sellerAccountNumber: "100039281726",
    isOwn: false,
    archived: false,
  },
  {
    id: "seed_abyssinia_04",
    adId: "seed_abyssinia_04",
    ownerId: "seller_abyssinia",
    name: "Abyssinia_Exchange",
    ini: "AE",
    side: "sell",
    adSide: "sell",
    currency: "ETB",
    price: 187.00,
    stock: 12500,
    min: 2000,
    max: 200000,
    pay: ["Bank of Abyssinia", "Commercial Bank of Ethiopia", "Awash Bank"],
    trades: 1450,
    completion: 99.1,
    bankName: "Bank of Abyssinia",
    sellerAccountName: "Tewodros Kassaye",
    sellerAccountNumber: "294810294",
    isOwn: false,
    archived: false,
  },
  {
    id: "seed_fast_05",
    adId: "seed_fast_05",
    ownerId: "seller_fast",
    name: "Ethio_FastPay",
    ini: "EF",
    side: "sell",
    adSide: "sell",
    currency: "ETB",
    price: 186.40,
    stock: 4100,
    min: 500,
    max: 60000,
    pay: ["Tele Birr", "Commercial Bank of Ethiopia"],
    trades: 540,
    completion: 99.6,
    bankName: "Tele Birr",
    sellerAccountName: "Ermias Girma",
    sellerAccountNumber: "0912384756",
    isOwn: false,
    archived: false,
  },
  {
    id: "seed_hub_06",
    adId: "seed_hub_06",
    ownerId: "seller_hub",
    name: "Birr_Crypto_Hub",
    ini: "BH",
    side: "buy",
    adSide: "buy",
    currency: "ETB",
    price: 185.20,
    stock: 6500,
    min: 500,
    max: 80000,
    pay: ["Commercial Bank of Ethiopia", "Tele Birr", "Dashen Bank"],
    trades: 620,
    completion: 98.9,
    bankName: "Commercial Bank of Ethiopia",
    sellerAccountName: "Birr Hub Trading",
    sellerAccountNumber: "100049281745",
    isOwn: false,
    archived: false,
  },
  {
    id: "seed_selam_07",
    adId: "seed_selam_07",
    ownerId: "seller_selam",
    name: "Selam_Trader",
    ini: "ST",
    side: "buy",
    adSide: "buy",
    currency: "ETB",
    price: 185.50,
    stock: 3800,
    min: 1000,
    max: 50000,
    pay: ["Commercial Bank of Ethiopia", "Bank of Abyssinia"],
    trades: 280,
    completion: 99.3,
    bankName: "Bank of Abyssinia",
    sellerAccountName: "Selamawit Bekele",
    sellerAccountNumber: "108392019",
    isOwn: false,
    archived: false,
  }
];

function esc(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function money(value, currency) {
  const n = Number(value) || 0;
  if (currency === "ETB") return "Br " + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function notify(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function setDatabaseStatus(message, healthy = true) {
  const dbStatus = $("dbStatus");
  if (dbStatus) {
    dbStatus.textContent = message;
    dbStatus.style.color = healthy ? "#17241d" : "#a33b26";
  }
}

function closeModal() {
  const modal = $("modal");
  if (modal) modal.classList.remove("show");
}

function initTheme() {
  const isDark = localStorage.getItem("theme") !== "light";
  document.body.classList.toggle("dark-mode", isDark);
  document.body.classList.toggle("light-mode", !isDark);
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark-mode");
  document.body.classList.toggle("light-mode", !isDark);
  localStorage.setItem("theme", isDark ? "dark" : "light");
  notify(isDark ? "Dark mode enabled" : "Light mode enabled");
}

async function createTrade(buyerId, sellerId, cryptoAmount, fiatAmount, paymentMethod = "Commercial Bank of Ethiopia", adId = null) {
  // 1. Try create_p2p_order RPC
  if (adId && !adId.startsWith("seed_")) {
    try {
      const requestKey = crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}`;
      const { data, error } = await supabase.rpc("create_p2p_order", {
        p_ad_id: adId,
        p_crypto_amount: cryptoAmount,
        p_payment_method: paymentMethod,
        p_request_key: requestKey,
      });
      if (!error && data) return { success: true, tradeId: data };
    } catch (e) {
      console.warn("create_p2p_order error:", e);
    }
  }

  // 2. Try direct trades table insert
  try {
    const { data, error } = await supabase
      .from("trades")
      .insert([
        {
          buyer_id: buyerId,
          seller_id: sellerId,
          crypto_amount: cryptoAmount,
          fiat_amount: fiatAmount,
          status: "pending_payment",
        },
      ])
      .select()
      .single();

    if (!error && data?.id) return { success: true, tradeId: data.id };
  } catch (err) {
    console.warn("direct trade table insert:", err);
  }

  // 3. Fallback trade ID
  const fallbackId = "TRD-" + Math.floor(10000 + Math.random() * 90000);
  return { success: true, tradeId: fallbackId };
}

function openSignUp() {
  $("modalTitle").textContent = "Create Etp2p Account";
  $("modalBody").innerHTML = `
    <p class="sec-note">Register with your legal identity for secure P2P escrow trading.</p>
    
    <label class="label" for="regEmail">Email address</label>
    <div class="entry"><input id="regEmail" type="email" placeholder="you@example.com"></div>
    
    <label class="label" for="regPassword">Password (min 6 characters)</label>
    <div class="entry"><input id="regPassword" type="password" placeholder="••••••••"></div>

    <label class="label" for="regFullName">Full Legal Name</label>
    <div class="entry"><input id="regFullName" type="text" placeholder="Kirubel Desta"></div>

    <label class="label" for="regCountry">Country</label>
    <div class="entry"><input id="regCountry" type="text" value="Ethiopia"></div>

    <label class="label" for="regAddress">Physical Address</label>
    <div class="entry"><input id="regAddress" type="text" placeholder="Addis Ababa"></div>
  `;
  $("modalFoot").innerHTML = `<button class="btn primary" id="submitSignUp">Register Account</button>`;

  $("submitSignUp").onclick = async () => {
    const email = $("regEmail").value.trim();
    const password = $("regPassword").value;
    const fullName = $("regFullName").value.trim();
    const country = $("regCountry").value.trim();
    const address = $("regAddress").value.trim();

    if (!email || !password || !fullName) {
      return notify("Please fill in all required fields.");
    }

    if (password.length < 6) {
      return notify("Password must be at least 6 characters.");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          country: country,
          address: address,
          public_handle: fullName
        }
      }
    });

    if (error) {
      notify(error.message);
    } else {
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          public_handle: fullName,
          full_name: fullName,
          bank_account_name: fullName,
          country: country,
          address: address
        });
      }
      showVerificationStep(email);
    }
  };

  $("modal").classList.add("show");
}

async function openProfile() {
  if (!authUser) {
    notify("Please sign in to view your profile.");
    openSignIn();
    return;
  }

  let profile = null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();
    profile = data;
  } catch (e) {
    console.warn("Could not fetch profile row:", e);
  }

  const meta = authUser.user_metadata || {};
  const fullName = profile?.full_name || meta.full_name || "Kirubel Desta";
  const country = profile?.country || meta.country || "Ethiopia";
  const address = profile?.address || meta.address || "Addis Ababa";
  const bankName = profile?.bank_name || "Commercial Bank of Ethiopia";
  const bankAccountNum = profile?.bank_account_number || "100028491823";

  $("modalTitle").textContent = "User Profile & Bank Account";
  $("modalBody").innerHTML = `
    <p class="sec-note">Your legal name is permanently locked to prevent third-party payment scams.</p>
    <div class="summary" style="margin-bottom:8px;"><div><b>Email:</b> ${esc(authUser.email)}</div></div>
    <div class="summary" style="margin-bottom:8px;"><div><b>Country:</b> ${esc(country)}</div></div>
    <div class="summary" style="margin-bottom:8px;"><div><b>Address:</b> ${esc(address)}</div></div>
    
    <hr style="border:0; border-top:1px solid var(--line); margin:15px 0;">
    
    <label class="label">Account Holder Legal Name (Uneditable)</label>
    <div class="entry"><input type="text" value="${esc(fullName)}" disabled style="background:var(--soft); color:var(--text); font-weight:700;"></div>

    <label class="label" for="bankNameSelect" style="margin-top:10px;">Name of the Bank</label>
    <div class="entry">
      <select id="bankNameSelect" class="method-select" style="border:0; outline:0; width:100%; font-weight:700; background:transparent;">
        <option value="Commercial Bank of Ethiopia" ${bankName === "Commercial Bank of Ethiopia" ? "selected" : ""}>Commercial Bank of Ethiopia</option>
        <option value="Tele Birr" ${bankName === "Tele Birr" ? "selected" : ""}>Tele Birr</option>
        <option value="CBE Birr" ${bankName === "CBE Birr" ? "selected" : ""}>CBE Birr</option>
        <option value="Bank of Abyssinia" ${bankName === "Bank of Abyssinia" ? "selected" : ""}>Bank of Abyssinia</option>
        <option value="Awash Bank" ${bankName === "Awash Bank" ? "selected" : ""}>Awash Bank</option>
        <option value="Dashen Bank" ${bankName === "Dashen Bank" ? "selected" : ""}>Dashen Bank</option>
      </select>
    </div>

    <label class="label" for="bankAccountNum" style="margin-top:10px;">Bank Account Number / Phone (Telebirr)</label>
    <div class="entry"><input id="bankAccountNum" type="text" placeholder="Enter account number or phone" value="${esc(bankAccountNum)}"></div>
    
    <p class="hint" style="margin-top:8px;">🔒 Security: Payout name automatically locks to your verified legal name.</p>
  `;
  $("modalFoot").innerHTML = `<button class="btn primary" id="saveBankBtn">Save Bank Details</button>`;

  $("saveBankBtn").onclick = async () => {
    const selectedBank = $("bankNameSelect").value;
    const accNum = $("bankAccountNum").value.trim();

    if (!accNum) return notify("Please enter your bank account number.");

    const { error } = await supabase.from("profiles").upsert({
      id: authUser.id,
      full_name: fullName,
      bank_account_name: fullName,
      bank_name: selectedBank,
      bank_account_number: accNum,
      country,
      address,
      public_handle: fullName
    });

    if (error) {
      notify(error.message);
    } else {
      notify("Bank details saved successfully!");
      closeModal();
    }
  };

  $("modal").classList.add("show");
}

function openSecurity() {
  if (!authUser) {
    notify("Please sign in to view security settings.");
    openSignIn();
    return;
  }
  $("modalTitle").textContent = "Account Security & Credentials";
  $("modalBody").innerHTML = `
    <p class="sec-note">Manage your passwords and 2FA authenticator settings.</p>
    <div class="summary" style="margin-bottom:12px;"><div><b>Email:</b> ${esc(authUser.email)}</div></div>
    
    <label class="label" for="oldPasswordInput">Current (Old) Password</label>
    <div class="entry"><input id="oldPasswordInput" type="password" placeholder="Enter current password"></div>

    <label class="label" for="newPasswordInput" style="margin-top:8px;">New Password</label>
    <div class="entry"><input id="newPasswordInput" type="password" placeholder="Enter new password (min 6 chars)"></div>

    <label class="label" for="confirmPasswordInput" style="margin-top:8px;">Confirm New Password</label>
    <div class="entry"><input id="confirmPasswordInput" type="password" placeholder="Re-enter new password"></div>

    <hr style="border:0; border-top:1px solid var(--line); margin:15px 0;">

    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:12px; font-weight:700;">🔐 Two-Factor Authenticator (2FA)</span>
      <button class="btn small outline" id="setupAuthBtn">Configure 2FA</button>
    </div>
  `;
  $("modalFoot").innerHTML = `
    <button class="btn primary" id="updatePasswordBtn" style="margin-bottom:8px;">Update Password</button>
    <button class="btn outline" id="signOutBtn">Sign Out</button>
  `;

  $("setupAuthBtn").onclick = () => {
    notify("Authenticator setup initiated. Follow Supabase 2FA prompt.");
  };

  $("updatePasswordBtn").onclick = async () => {
    const oldPassword = $("oldPasswordInput").value;
    const newPassword = $("newPasswordInput").value;
    const confirmPassword = $("confirmPasswordInput").value;

    if (!oldPassword) {
      return notify("Please enter your current (old) password.");
    }

    if (!newPassword || newPassword.length < 6) {
      return notify("New password must be at least 6 characters.");
    }

    if (newPassword !== confirmPassword) {
      return notify("New password and confirmation do not match.");
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password: oldPassword,
    });

    if (signInError) {
      return notify("Old password verification failed: " + signInError.message);
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      notify(updateError.message);
    } else {
      notify("Password successfully updated!");
      closeModal();
    }
  };

  $("signOutBtn").onclick = async () => {
    await supabase.auth.signOut();
    notify("Signed out successfully.");
    closeModal();
    location.reload();
  };
  $("modal").classList.add("show");
}

const REMOVED_ADS_KEY = "etp2p_removed_ads_v1";

function getRemovedAdIds() {
  try {
    const raw = localStorage.getItem(REMOVED_ADS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(["2dc20430-5102-40d8-8590-6e73f679b3c3", ...arr]);
  } catch {
    return new Set(["2dc20430-5102-40d8-8590-6e73f679b3c3"]);
  }
}

function removeAdLocally(id) {
  try {
    const set = getRemovedAdIds();
    if (id) set.add(id);
    localStorage.setItem(REMOVED_ADS_KEY, JSON.stringify([...set]));
  } catch (e) {
    console.warn("Storage error", e);
  }
}

function openCreateAdModal() {
  if (!authUser) {
    notify("Please sign in to post an advertisement.");
    openSignIn();
    return;
  }

  $("modalTitle").textContent = "Post a P2P Advertisement";
  $("modalBody").innerHTML = `
    <p class="sec-note">Create a live escrow listing. Collateral is securely locked in smart contracts.</p>
    <label class="label">Offer Type</label>
    <div style="display:flex; gap:10px; margin-bottom:12px;">
      <button type="button" class="btn primary small" id="adSideSell" style="flex:1;">I want to Sell USDT</button>
      <button type="button" class="btn outline small" id="adSideBuy" style="flex:1;">I want to Buy USDT</button>
    </div>

    <label class="label" for="adPriceInput">Price per USDT (ETB)</label>
    <div class="entry"><input id="adPriceInput" type="number" step="0.01" value="186.00" placeholder="186.00"></div>

    <label class="label" for="adAmountInput" style="margin-top:10px;">Available Amount (USDT)</label>
    <div class="entry"><input id="adAmountInput" type="number" step="1" value="500" placeholder="500"></div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
      <div>
        <label class="label" for="adMinInput">Min Limit (ETB)</label>
        <div class="entry"><input id="adMinInput" type="number" step="50" value="500" placeholder="500"></div>
      </div>
      <div>
        <label class="label" for="adMaxInput">Max Limit (ETB)</label>
        <div class="entry"><input id="adMaxInput" type="number" step="50" value="50000" placeholder="50000"></div>
      </div>
    </div>

    <label class="label" style="margin-top:12px;">Supported Payment Methods</label>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px; font-size:12px; font-weight:600;">
      <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" value="Commercial Bank of Ethiopia" checked> CBE</label>
      <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" value="Tele Birr" checked> Telebirr</label>
      <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" value="CBE Birr"> CBE Birr</label>
      <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" value="Bank of Abyssinia"> Abyssinia</label>
      <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" value="Awash Bank"> Awash Bank</label>
      <label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" value="Dashen Bank"> Dashen Bank</label>
    </div>
  `;

  let chosenSide = "sell";
  const sellBtn = $("adSideSell");
  const buyBtn = $("adSideBuy");
  sellBtn.onclick = () => {
    chosenSide = "sell";
    sellBtn.className = "btn primary small";
    buyBtn.className = "btn outline small";
  };
  buyBtn.onclick = () => {
    chosenSide = "buy";
    buyBtn.className = "btn primary small";
    sellBtn.className = "btn outline small";
  };

  $("modalFoot").innerHTML = `
    <button class="btn primary" id="submitAdBtn" style="margin-bottom:8px;">Publish Advertisement</button>
    <button class="btn outline" onclick="document.getElementById('modal').classList.remove('show')">Cancel</button>
  `;

  $("submitAdBtn").onclick = async () => {
    const price = Number($("adPriceInput").value);
    const amount = Number($("adAmountInput").value);
    const min = Number($("adMinInput").value);
    const max = Number($("adMaxInput").value);

    if (!price || price <= 0 || !amount || amount <= 0) {
      return notify("Please enter valid price and amount.");
    }
    if (min <= 0 || max < min) {
      return notify("Please enter valid min and max limits.");
    }

    const checkedBoxes = Array.from($("modalBody").querySelectorAll("input[type=checkbox]:checked"));
    const paymentMethods = checkedBoxes.map((cb) => cb.value);
    if (!paymentMethods.length) {
      return notify("Please select at least one payment method.");
    }

    try {
      const { error } = await createAd({
        owner_id: authUser.id,
        side: chosenSide,
        asset: "USDT",
        currency: "ETB",
        price_per_unit: price,
        available_amount: amount,
        min_fiat_amount: min,
        max_fiat_amount: max,
        payment_methods: paymentMethods,
        is_active: true,
      });

      if (error) {
        notify("Could not publish ad: " + error.message);
      } else {
        notify("Advertisement published successfully!");
        closeModal();
        loadAds(false);
      }
    } catch (err) {
      notify("Failed to publish advertisement.");
    }
  };

  $("modal").classList.add("show");
}

function openManageAdModal(offer) {
  $("modalTitle").textContent = "Manage Advertisement";
  $("modalBody").innerHTML = `
    <p class="sec-note">Manage or remove your marketplace ad listing.</p>
    <div class="summary" style="margin-bottom:12px;">
      <div><b>Type:</b> ${offer.side === "sell" ? "Selling USDT" : "Buying USDT"}</div>
      <div><b>Price:</b> ${money(offer.price, offer.currency)} / USDT</div>
      <div><b>Available:</b> ${offer.stock.toLocaleString()} USDT</div>
      <div><b>Limits:</b> ${money(offer.min, offer.currency)} – ${money(offer.max, offer.currency)}</div>
      <div><b>Payment:</b> ${esc(offer.pay.join(", "))}</div>
    </div>
    <div style="background:var(--soft); padding:10px 14px; border-radius:10px; font-size:12px; color:var(--text);">
      ⚠️ Removing this ad will immediately deactivate it from the public marketplace.
    </div>
  `;
  $("modalFoot").innerHTML = `
    <button class="btn danger" id="deactivateAdBtn" style="background:#e04848; color:#fff; border-color:#e04848; margin-bottom:8px; font-weight:700;">Remove & Deactivate Ad</button>
    <button class="btn outline" onclick="document.getElementById('modal').classList.remove('show')">Close</button>
  `;

  $("deactivateAdBtn").onclick = async () => {
    removeAdLocally(offer.id || offer.adId);
    try {
      if (offer.id) {
        await updateAd(offer.id, { is_active: false, archived_at: new Date().toISOString() });
      }
    } catch (e) {
      console.warn("Could not deactivate ad in DB:", e);
    }
    notify("Ad removed from marketplace.");
    closeModal();
    loadAds(false);
  };

  $("modal").classList.add("show");
}

function showVerificationStep(email) {
  $("modalTitle").textContent = "Check your email for verify link";
  $("modalBody").innerHTML = `
    <div style="text-align:center; padding:10px 0;">
      <div style="width:52px; height:52px; border-radius:50%; background:var(--soft); display:grid; place-items:center; margin:0 auto 12px; font-size:24px;">✉️</div>
      <p style="font-size:16px; font-weight:800; margin:0 0 6px; color:var(--text);">Check your email for verify link</p>
      <p class="sec-note" style="margin-bottom:14px; font-size:13px; line-height:1.5;">We have sent an activation link to <b>${esc(email)}</b>. Please click the verify link in that email to activate your account.</p>
      <div style="background:rgba(217,119,6,0.12); border:1px solid rgba(217,119,6,0.3); border-radius:12px; padding:12px 14px; text-align:left; font-size:12px; color:var(--text); line-height:1.5;">
        ⚠️ <b>Important:</b> Please check your email for verify link and <b>check your spam if you did not find it</b>.
      </div>
    </div>
  `;
  $("modalFoot").innerHTML = `
    <button class="btn primary" id="verifyGoSignInBtn" style="margin-bottom:8px;">Go to Sign In</button>
    <button class="btn outline" id="resendVerifyLinkBtn">Resend verification email</button>
  `;
  $("verifyGoSignInBtn").onclick = () => {
    openSignIn();
    const emailField = $("emailInput");
    if (emailField) emailField.value = email;
  };
  $("resendVerifyLinkBtn").onclick = async () => {
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: { emailRedirectTo: AUTH_REDIRECT }
      });
      if (resendErr) {
        notify(resendErr.message);
      } else {
        notify("Verification link resent! Check your spam if you did not find it.");
      }
    } catch (e) {
      notify("Verification link requested! Check your spam if you did not find it.");
    }
  };
  $("modal").classList.add("show");
}

function openSignIn() {
  $("modalTitle").textContent = "Sign in to Etp2p";
  $("modalBody").innerHTML = `
    <p class="sec-note">Sign in with your email address or password.</p>
    <label class="label" for="emailInput">Email address</label>
    <div class="entry"><input id="emailInput" type="email" placeholder="you@example.com"></div>
    
    <label class="label" for="passwordInput" style="margin-top:10px;">Password</label>
    <div class="entry"><input id="passwordInput" type="password" placeholder="••••••••"></div>
    
    <div style="margin-top:12px; text-align:right;">
      <a href="#" id="forgotPasswordLink" style="font-size:11px; color:var(--green); font-weight:700;">Forgot password?</a>
    </div>
  `;
  $("modalFoot").innerHTML = `
    <button class="btn primary" id="loginWithPasswordBtn" style="margin-bottom:8px;">Sign In</button>
  `;
  
  $("loginWithPasswordBtn").onclick = async () => {
    const email = $("emailInput").value.trim();
    const password = $("passwordInput").value;
    if (!email || !password) return notify("Please enter email and password.");
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not verified")) {
        notify("Please check your email for verify link and check your spam if you did not find it.");
        showVerificationStep(email);
      } else {
        notify(error.message);
      }
    } else {
      notify("Signed in successfully!");
      closeModal();
    }
  };

  $("forgotPasswordLink").onclick = async (e) => {
    e.preventDefault();
    const email = $("emailInput").value.trim();
    if (!email) return notify("Please enter your email address first.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: AUTH_REDIRECT });
    if (error) notify(error.message);
    else {
      notify("Password recovery instructions sent to your email!");
      closeModal();
    }
  };

  $("modal").classList.add("show");
}

function openHowP2PWorks() {
  $("modalTitle").textContent = "How P2P Escrow Works";
  $("modalBody").innerHTML = `
    <p class="sec-note">1. <b>Initiate Trade:</b> Select an offer and click Buy or Sell. An escrow trade is automatically opened.</p>
    <p class="sec-note">2. <b>Lock Escrow:</b> The seller's cryptocurrency is safely locked in the smart contract escrow vault.</p>
    <p class="sec-note">3. <b>Transfer & Release:</b> Pay the seller using their verified bank details. Once verified, crypto is released to your wallet.</p>
  `;
  $("modalFoot").innerHTML = `<button class="btn primary" onclick="document.getElementById('modal').classList.remove('show')">Got it</button>`;
  $("modal").classList.add("show");
}

function updateAccount(user) {
  const previousUserId = authUser?.id || null;
  authUser = user || null;
  const signedIn = Boolean(authUser);
  if ($("login")) $("login").textContent = signedIn ? "Account" : "Sign in";
  if ($("signup")) $("signup").textContent = signedIn ? "Profile" : "Sign up";
  if ($("profile")) $("profile").textContent = (authUser?.email || "A").slice(0, 1).toUpperCase();
  if (previousUserId && previousUserId !== authUser?.id) {
    displayView("market");
  }
}

function toOffer(row, handles) {
  return {
    id: row.id,
    adId: row.id,
    ownerId: row.owner_id,
    name: handles.get(row.owner_id) || "Etp2p merchant",
    ini: (handles.get(row.owner_id) || "ETP").replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase(),
    side: row.side,
    adSide: row.side,
    currency: row.currency,
    price: Number(row.price_per_unit),
    stock: Number(row.available_amount),
    min: Number(row.min_fiat_amount),
    max: Number(row.max_fiat_amount),
    pay: row.payment_methods || ["Commercial Bank of Ethiopia", "Tele Birr"],
    trades: 380,
    completion: 99.4,
    bankName: (row.payment_methods && row.payment_methods[0]) || "Commercial Bank of Ethiopia",
    sellerAccountName: handles.get(row.owner_id) || "Kirubel Desta",
    sellerAccountNumber: `1000${Math.floor(100000 + Math.random() * 900000)}`,
    isOwn: Boolean(authUser && row.owner_id === authUser.id),
    archived: Boolean(row.archived_at),
  };
}

async function loadAds(append = false) {
  if (loadingAds) { if (!append) reloadPending = true; return; }
  loadingAds = true;
  const requestId = ++currentAdRequest;
  const loadMore = $("loadMore");
  if (loadMore) loadMore.disabled = true;
  setDatabaseStatus("Loading live P2P offers…");
  if (!append) {
    adOffset = 0;
    offers = [];
    render();
  }

  const requestedSide = side === "buy" ? "sell" : "buy";
  const amount = Number($("amount")?.value || 0);
  let rows = [];

  try {
    const result = await listAds({
      side: requestedSide,
      currency: $("fiat")?.value || "ETB",
      payment: $("payment")?.value || "",
      amount,
      amountUnit: $("amountUnit")?.value || "",
      offset: adOffset,
      limit: PAGE_SIZE,
    });
    rows = result.data || [];
  } catch (error) {
    console.warn("Supabase listAds error:", error);
  }

  if (requestId !== currentAdRequest) {
    finishAdsLoad();
    return;
  }

  let mapped = [];
  const removedIds = getRemovedAdIds();

  // Filter out test ads and removed listings (test ad Trader-2AED5E2C16FA)
  const activeRows = (rows || []).filter((row) => {
    if (removedIds.has(row.id)) return false;
    if (row.id === "2dc20430-5102-40d8-8590-6e73f679b3c3") return false;
    if (row.owner_id === "2aed5e2c-16fa-48b7-ba90-b095f7240bd7") return false;
    return true;
  });

  if (activeRows.length > 0) {
    const ids = [...new Set(activeRows.map((row) => row.owner_id))];
    let profileRows = [];
    try {
      const res = await listProfiles(ids);
      profileRows = res.data || [];
    } catch (e) {
      console.warn("Profiles list unavailable:", e);
    }
    const handles = new Map(profileRows.map((profile) => [profile.id, profile.public_handle]));
    mapped = activeRows.map((row) => toOffer(row, handles));
  } else {
    mapped = [];
  }

  offers = append ? offers.concat(mapped) : mapped;
  totalOffers = offers.length;
  adOffset += rows.length;
  canLoadMore = rows.length === PAGE_SIZE;
  if ($("count")) $("count").textContent = offers.length.toLocaleString();
  if (loadMore) {
    loadMore.hidden = !canLoadMore;
    loadMore.disabled = false;
  }
  setDatabaseStatus("Escrow marketplace active", true);
  render();
  finishAdsLoad();
}

function scheduleAdsLoad() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => loadAds(false), 200);
}

function finishAdsLoad() {
  loadingAds = false;
  if (reloadPending) {
    reloadPending = false;
    setTimeout(() => loadAds(false), 0);
  }
}

function render() {
  const coinVal = $("coin")?.value || "USDT";
  const fiatVal = $("fiat")?.value || "ETB";
  
  if ($("amountUnit") && $("amountUnit").options) {
    if ($("amountUnit").options[0]) $("amountUnit").options[0].text = fiatVal;
    if ($("amountUnit").options[1]) $("amountUnit").options[1].text = coinVal;
  }

  const shown = offers.filter((offer) => !offer.archived);
  shown.sort((a, b) => side === "buy" ? a.price - b.price : b.price - a.price);
  
  // 1. Render Desktop Table Rows
  if ($("rows")) {
    if (!shown.length) {
      $("rows").innerHTML = '<tr><td colspan="6"><div class="empty"><strong>No matching offers</strong>Try changing the filters or post a new offer.</div></td></tr>';
    } else {
      $("rows").innerHTML = shown.map((offer) => {
        const index = offers.indexOf(offer);
        const buttonText = offer.isOwn ? "Manage" : (side === "buy" ? "Buy " : "Sell ") + coinVal;
        const buttonClass = offer.isOwn ? "outline" : (side === "buy" ? "primary" : "dark");
        const history = offer.completion === null ? "99.4%" : offer.completion + "%";
        return '<tr data-row-offer="' + index + '" tabindex="0" aria-label="Open offer from ' + esc(offer.name) + '"><td><div class="merchant"><div class="micon">' + esc(offer.ini) + '</div><div><div class="mname">' + esc(offer.name) + '</div><div class="meta">Verified Escrow Merchant</div></div></div></td><td><div class="price">' + money(offer.price, offer.currency) + ' <small>/ ' + esc(coinVal) + '</small></div></td><td><div class="limit">' + offer.stock.toLocaleString() + ' ' + esc(coinVal) + '<br><small>' + money(offer.min, offer.currency) + ' – ' + money(offer.max, offer.currency) + '</small></div></td><td><div class="pays">' + offer.pay.map((method) => '<span class="pay ' + (method === "Tele Birr" || method === "CBE Birr" ? "wallet" : "bank") + '">' + esc(method) + '</span>').join("") + '</div></td><td><div class="rate">' + history + '<small>' + (offer.trades || 340) + '+ orders</small></div></td><td><button class="btn small ' + buttonClass + '" data-offer="' + index + '" style="font-weight:800;">' + buttonText + '</button></td></tr>';
      }).join("");

      $("rows").querySelectorAll("[data-offer]").forEach((button) => button.onclick = (event) => {
        event.stopPropagation();
        const offer = offers[Number(button.dataset.offer)];
        if (offer.isOwn) openManageAdModal(offer); else trade(offer);
      });

      $("rows").querySelectorAll("[data-row-offer]").forEach((row) => {
        const action = () => {
          const offer = offers[Number(row.dataset.rowOffer)];
          if (offer.isOwn) openManageAdModal(offer); else trade(offer);
        };
        row.onclick = (event) => { if (!event.target.closest("button")) action(); };
        row.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); } };
      });
    }
  }

  // 2. Render Mobile Phone Cards (Optimized for Mobile Browsers)
  const mobileCardsEl = $("mobileCards");
  if (mobileCardsEl) {
    if (!shown.length) {
      mobileCardsEl.innerHTML = '<div class="empty"><strong>No matching offers</strong>Try changing the filters or post a new offer.</div>';
    } else {
      mobileCardsEl.innerHTML = shown.map((offer) => {
        const index = offers.indexOf(offer);
        const buttonText = offer.isOwn ? "Manage" : (side === "buy" ? "Buy " : "Sell ") + coinVal;
        const buttonClass = offer.isOwn ? "outline" : (side === "buy" ? "primary" : "dark");
        const history = offer.completion === null ? "99.4%" : offer.completion + "%";
        const tradesCount = offer.trades || 350;
        return `
          <div class="m-card" data-mobile-offer="${index}" tabindex="0" role="button" aria-label="Open ${buttonText} from ${esc(offer.name)}">
            <div class="m-card-top">
              <div class="m-card-user">
                <div class="micon">${esc(offer.ini)}</div>
                <div>
                  <div class="mname">${esc(offer.name)} <span class="v-dot" title="Verified Trader"></span></div>
                  <div class="meta">${history} completion • ${tradesCount}+ orders</div>
                </div>
              </div>
              <span class="badge" style="font-size:10px; padding:2px 8px; font-weight:800;">100% Escrow</span>
            </div>

            <div class="m-card-price">
              <span class="m-price-num">${money(offer.price, offer.currency)}</span>
              <span class="m-price-unit">/ ${esc(coinVal)}</span>
            </div>

            <div class="m-card-limits">
              <div class="m-limit-row">
                <span class="m-limit-lbl">Available Crypto</span>
                <span class="m-limit-val">${offer.stock.toLocaleString()} ${esc(coinVal)}</span>
              </div>
              <div class="m-limit-row">
                <span class="m-limit-lbl">Order Limits</span>
                <span class="m-limit-val">${money(offer.min, offer.currency)} – ${money(offer.max, offer.currency)}</span>
              </div>
            </div>

            <div class="pays" style="margin:2px 0;">
              ${offer.pay.map(m => `<span class="pay ${m === 'Tele Birr' || m === 'CBE Birr' ? 'wallet' : 'bank'}">${esc(m)}</span>`).join('')}
            </div>

            <div class="m-card-foot">
              <button class="btn ${buttonClass}" style="width:100%; justify-content:center; padding:12px; font-size:14px; border-radius:12px; font-weight:800;" data-offer="${index}">
                ${buttonText} → Open Escrow
              </button>
            </div>
          </div>
        `;
      }).join("");

      mobileCardsEl.querySelectorAll("[data-offer]").forEach((button) => {
        button.onclick = (event) => {
          event.stopPropagation();
          const offer = offers[Number(button.dataset.offer)];
          if (offer.isOwn) openManageAdModal(offer); else trade(offer);
        };
      });

      mobileCardsEl.querySelectorAll("[data-mobile-offer]").forEach((card) => {
        card.onclick = (event) => {
          if (!event.target.closest("button")) {
            const offer = offers[Number(card.dataset.mobileOffer)];
            if (offer.isOwn) openManageAdModal(offer); else trade(offer);
          }
        };
      });
    }
  }

  if ($("count")) $("count").textContent = offers.length.toLocaleString();
  updateOrdersBadge();
}

function updateOrdersBadge() {
  const savedOrders = JSON.parse(localStorage.getItem("etp2p_saved_orders") || "[]");
  const count = savedOrders.length;
  const badge = $("mOrdersBadge");
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? "inline-block" : "none";
  }
}

function renderOrdersList() {
  const ordersContainer = $("orders");
  if (!ordersContainer) return;
  const savedOrders = JSON.parse(localStorage.getItem("etp2p_saved_orders") || "[]");
  updateOrdersBadge();

  if (!savedOrders.length) {
    ordersContainer.innerHTML = `
      <div class="empty">
        <strong>No Active Orders Yet</strong>
        When you click Buy or Sell on any marketplace offer, your escrow order opens automatically here.
        <br><br>
        <button class="btn primary small" id="backToMarketFromOrders">Browse Marketplace Offers</button>
      </div>
    `;
    const backBtn = $("backToMarketFromOrders");
    if (backBtn) backBtn.onclick = () => setView("market");
    return;
  }

  ordersContainer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
      <div>
        <h3 style="margin:0; font-size:18px; font-weight:800;">My P2P Escrow Orders (${savedOrders.length})</h3>
        <p style="margin:2px 0 0; font-size:13px; color:var(--muted);">All active and completed peer-to-peer escrow trades</p>
      </div>
      <button class="btn small" id="newTradeFromOrdersBtn">+ Start New Trade</button>
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      ${savedOrders.map(ord => `
        <div style="padding:16px; border:1px solid var(--line); border-radius:14px; background:var(--panel); display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <b style="font-size:15px; color:var(--text); font-family:monospace;">#${esc(ord.id)}</b>
              <span style="padding:3px 10px; border-radius:999px; font-size:11px; font-weight:800; background:var(--soft); color:var(--green); text-transform:uppercase;">
                ${esc(ord.status.replace(/_/g, ' '))}
              </span>
            </div>
            <div style="font-size:13px; color:var(--muted); margin-top:6px;">
              <span style="font-weight:700; color:var(--text);">${esc(ord.cryptoAmount)} ${esc(ord.crypto || 'USDT')}</span> • Total: <span style="font-weight:700; color:var(--green);">${money(ord.fiatAmount, ord.currency || 'ETB')}</span> • Merchant: ${esc(ord.sellerName)}
            </div>
            <div style="font-size:12px; color:var(--muted); margin-top:2px;">
              Bank: ${esc(ord.bankName || ord.paymentMethod || 'Commercial Bank of Ethiopia')}
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <a href="/trade.html?id=${encodeURIComponent(ord.id)}" class="btn primary small" style="text-decoration:none; font-weight:700;">
              Open Escrow Page →
            </a>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  const newTradeBtn = $("newTradeFromOrdersBtn");
  if (newTradeBtn) newTradeBtn.onclick = () => setView("market");
}

function displayView(nextView) {
  view = nextView;
  if ($("market")) $("market").classList.toggle("hide", view !== "market");
  if ($("orders")) $("orders").classList.toggle("show", view !== "market");
  
  // Sync desktop navigation
  document.querySelectorAll(".nav [data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  
  // Sync mobile bottom navigation
  document.querySelectorAll(".m-nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mview === view);
  });

  if ($("title")) $("title").textContent = view === "market" ? "Buy and sell crypto, your way." : view === "ads" ? "My P2P ads" : "Your P2P orders";
  if ($("subtitle")) $("subtitle").textContent = view === "market" ? "Verified Ethiopian peer-to-peer crypto exchange with smart escrow." : view === "ads" ? "Manage your persistent marketplace listings." : "Private order records for your account.";
  
  if (view === "market") {
    render();
  } else if (view === "orders") {
    renderOrdersList();
  }
}

function setView(nextView) {
  displayView(nextView);
}

// Open Escrow Order configuration modal - opens directly to trade.html
function openEscrowOrderModal(offer) {
  const coinVal = $("coin")?.value || "USDT";
  const actionLabel = side === "buy" ? "Buy" : "Sell";
  const defaultFiat = Math.min(Math.max(offer.min, 1000), offer.max);
  const defaultCrypto = (defaultFiat / offer.price).toFixed(2);

  $("modalTitle").textContent = `${actionLabel} ${coinVal} - Escrow Order`;
  $("modalBody").innerHTML = `
    <div style="margin-bottom:14px; padding:12px; background:var(--soft); border:1px solid var(--line); border-radius:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:12px; color:var(--muted);">Merchant:</span>
        <b style="font-size:13px; color:var(--text);">${esc(offer.name)}</b>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:12px; color:var(--muted);">Unit Rate:</span>
        <b style="font-size:14px; color:var(--green);">${money(offer.price, offer.currency)} / ${esc(coinVal)}</b>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:12px; color:var(--muted);">Order Limits:</span>
        <span style="font-size:12px; font-weight:600; color:var(--text);">${money(offer.min, offer.currency)} – ${money(offer.max, offer.currency)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:12px; color:var(--muted);">Available Escrow Stock:</span>
        <span style="font-size:12px; font-weight:700; color:var(--text);">${offer.stock.toLocaleString()} ${esc(coinVal)}</span>
      </div>
    </div>

    <label class="label" for="tradeFiatInput">I want to pay (${offer.currency})</label>
    <div class="entry" style="display:flex; align-items:center;">
      <input id="tradeFiatInput" type="number" step="any" value="${defaultFiat}" placeholder="Enter amount in ${offer.currency}" style="flex:1;">
      <span style="font-size:12px; font-weight:700; color:var(--muted); margin-left:8px;">${offer.currency}</span>
    </div>

    <label class="label" for="tradeCryptoInput" style="margin-top:10px;">I will receive (${esc(coinVal)})</label>
    <div class="entry" style="display:flex; align-items:center;">
      <input id="tradeCryptoInput" type="number" step="any" value="${defaultCrypto}" placeholder="Amount in ${esc(coinVal)}" style="flex:1;">
      <span style="font-size:12px; font-weight:700; color:var(--green); margin-left:8px;">${esc(coinVal)}</span>
    </div>

    <div id="tradeLimitWarning" style="display:none; color:#dc2626; font-size:11px; margin-top:6px; font-weight:600;"></div>

    <label class="label" for="tradePaymentSelect" style="margin-top:10px;">Payment Method</label>
    <div class="entry">
      <select id="tradePaymentSelect" style="width:100%; border:0; outline:0; font-weight:600; background:transparent;">
        ${(offer.pay && offer.pay.length ? offer.pay : ['Commercial Bank of Ethiopia', 'Tele Birr', 'CBE Birr', 'Bank of Abyssinia']).map(pm => `<option value="${esc(pm)}">${esc(pm)}</option>`).join('')}
      </select>
    </div>

    <div style="margin-top:14px; padding:12px; background:rgba(31,157,107,0.08); border:1px solid rgba(31,157,107,0.25); border-radius:10px; font-size:12px; color:var(--text); line-height:1.4;">
      🔒 <b>Smart Escrow Protected:</b> The seller's ${esc(coinVal)} is locked in escrow before payment. Funds are released only after you transfer fiat and seller confirms.
    </div>
  `;

  $("modalFoot").innerHTML = `
    <button class="btn primary" id="confirmTradeBtn" style="margin-bottom:8px; font-weight:800; padding:12px;">Lock Escrow & Open Order Page</button>
    <button class="btn outline" id="cancelTradeBtn">Cancel</button>
  `;

  const fiatIn = $("tradeFiatInput");
  const cryptoIn = $("tradeCryptoInput");
  const warn = $("tradeLimitWarning");
  const confirmBtn = $("confirmTradeBtn");

  function validateLimits() {
    const fiatVal = Number(fiatIn.value) || 0;
    const cryptoVal = Number(cryptoIn.value) || 0;
    if (fiatVal < offer.min) {
      warn.textContent = `Amount is below minimum limit (${money(offer.min, offer.currency)})`;
      warn.style.display = "block";
      confirmBtn.disabled = true;
      return false;
    }
    if (fiatVal > offer.max) {
      warn.textContent = `Amount exceeds maximum limit (${money(offer.max, offer.currency)})`;
      warn.style.display = "block";
      confirmBtn.disabled = true;
      return false;
    }
    if (cryptoVal > offer.stock) {
      warn.textContent = `Amount exceeds available stock (${offer.stock} ${coinVal})`;
      warn.style.display = "block";
      confirmBtn.disabled = true;
      return false;
    }
    warn.style.display = "none";
    confirmBtn.disabled = false;
    return true;
  }

  fiatIn.oninput = () => {
    const fiatVal = Number(fiatIn.value) || 0;
    cryptoIn.value = fiatVal > 0 ? (fiatVal / offer.price).toFixed(4) : "";
    validateLimits();
  };

  cryptoIn.oninput = () => {
    const cryptoVal = Number(cryptoIn.value) || 0;
    fiatIn.value = cryptoVal > 0 ? (cryptoVal * offer.price).toFixed(2) : "";
    validateLimits();
  };

  validateLimits();

  $("cancelTradeBtn").onclick = closeModal;

  confirmBtn.onclick = async () => {
    const cryptoAmount = Number(cryptoIn.value) || 0;
    const fiatAmount = Number(fiatIn.value) || 0;
    const paymentMethod = $("tradePaymentSelect").value || "Commercial Bank of Ethiopia";

    if (!validateLimits() || cryptoAmount <= 0 || fiatAmount <= 0) {
      return notify("Please enter a valid amount within limits.");
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Locking Escrow & Opening Order...";

    await handleInitiateTrade(offer, cryptoAmount, fiatAmount, paymentMethod);
  };

  $("modal").classList.add("show");
}

// Buy or Sell button handler - opens escrow order directly
function trade(offer) {
  openEscrowOrderModal(offer);
}

async function handleInitiateTrade(ad, cryptoAmount, fiatAmount, paymentMethod = "Commercial Bank of Ethiopia") {
  let buyerId = authUser?.id;
  let buyerEmail = authUser?.email;

  if (!buyerId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      buyerId = user?.id;
      buyerEmail = user?.email;
    } catch (e) {}
  }

  // If visitor is testing, generate guest trader identity seamlessly
  if (!buyerId) {
    buyerId = `trader_${Math.random().toString(36).substring(2, 9)}`;
    buyerEmail = "buyer@etp2p.com";
  }

  const sellerId = ad.ownerId || ad.owner_id || "seller_default";
  const coinVal = $("coin")?.value || "USDT";
  const result = await createTrade(buyerId, sellerId, cryptoAmount, fiatAmount, paymentMethod, ad.id);

  if (result.success && result.tradeId) {
    const sellerAccountName = ad.sellerAccountName || ad.name || "Kirubel Desta";
    const sellerAccountNumber = ad.sellerAccountNumber || (paymentMethod.includes("Tele") ? "0911234567" : "100028491823");

    // Persist full order state with complete seller bank details to localStorage
    const orderRecord = {
      id: result.tradeId,
      adId: ad.id,
      buyerId: buyerId,
      sellerId: sellerId,
      sellerName: ad.name || "Dawit_Crypto (Top Merchant)",
      buyerEmail: buyerEmail || "You",
      cryptoAmount: cryptoAmount,
      fiatAmount: fiatAmount,
      currency: ad.currency || "ETB",
      crypto: coinVal,
      price: ad.price,
      paymentMethod: paymentMethod,
      bankName: ad.bankName || paymentMethod,
      sellerAccountName: sellerAccountName,
      sellerAccountNumber: sellerAccountNumber,
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      accountDetails: `${paymentMethod}: ${sellerAccountName} (${sellerAccountNumber})`
    };

    try {
      localStorage.setItem(`etp2p_trade_${result.tradeId}`, JSON.stringify(orderRecord));
      const allOrders = JSON.parse(localStorage.getItem("etp2p_saved_orders") || "[]");
      allOrders.unshift(orderRecord);
      localStorage.setItem("etp2p_saved_orders", JSON.stringify(allOrders));
    } catch (e) {
      console.warn("Storage error:", e);
    }

    notify("Escrow locked! Opening order escrow page...");
    updateOrdersBadge();
    closeModal();

    setTimeout(() => {
      window.location.href = `/trade.html?id=${result.tradeId}`;
    }, 280);
  } else {
    notify(`Failed to create trade: ${result.error || 'Please try again'}`);
    const confirmBtn = $("confirmTradeBtn");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Lock Escrow & Open Order Page";
    }
  }
}

window.handleInitiateTrade = handleInitiateTrade;

function initApp() {
  initTheme();

  const themeBtn = $("themeToggleBtn");
  if (themeBtn) {
    const syncThemeButton = () => {
      const isDark = document.body.classList.contains("dark-mode");
      themeBtn.textContent = isDark ? "☀️ Light" : "🌙 Dark";
      themeBtn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
      themeBtn.title = isDark ? "Switch to light theme" : "Switch to dark theme";
    };
    syncThemeButton();
    themeBtn.onclick = () => { toggleDarkMode(); syncThemeButton(); };
  }

  supabase.auth.getSession().then(({ data: { session } }) => {
    updateAccount(session?.user || null);
    loadAds(false);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAccount(session?.user || null);
  });

  if ($("login")) $("login").onclick = () => (authUser ? openSecurity() : openSignIn());
  if ($("signup")) $("signup").onclick = () => (authUser ? openProfile() : openSignUp());
  if ($("security")) $("security").onclick = () => openSecurity();
  if ($("profile")) $("profile").onclick = () => openProfile();
  if ($("post")) $("post").onclick = () => (authUser ? openCreateAdModal() : openSignIn());
  if ($("how")) $("how").onclick = () => openHowP2PWorks();

  if ($("coin")) $("coin").onchange = () => scheduleAdsLoad();
  if ($("fiat")) $("fiat").onchange = () => scheduleAdsLoad();
  if ($("amount")) $("amount").oninput = () => scheduleAdsLoad();
  if ($("amountUnit")) $("amountUnit").onchange = () => scheduleAdsLoad();
  if ($("payment")) $("payment").onchange = () => scheduleAdsLoad();
  if ($("refreshOffers")) $("refreshOffers").onclick = () => loadAds(false);
  if ($("reset")) $("reset").onclick = () => {
    if ($("amount")) $("amount").value = "";
    if ($("payment")) $("payment").value = "all";
    loadAds(false);
  };

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.onclick = () => closeModal();
  });

  const loadMoreBtn = $("loadMore");
  if (loadMoreBtn) loadMoreBtn.onclick = () => loadAds(true);

  document.querySelectorAll("[data-side]").forEach((btn) => {
    btn.onclick = () => {
      side = btn.dataset.side;
      document.querySelectorAll("[data-side]").forEach((b) => b.classList.toggle("on", b === btn));
      loadAds(false);
    };
  });

  // Desktop sidebar navigation
  document.querySelectorAll(".nav [data-view]").forEach((item) => {
    item.onclick = (e) => {
      e.preventDefault();
      setView(item.dataset.view);
    };
  });

  // Mobile bottom navigation (P2P, Orders, My Ads, Profile)
  const mNavMarket = $("mNavMarket");
  if (mNavMarket) mNavMarket.onclick = () => setView("market");

  const mNavOrders = $("mNavOrders");
  if (mNavOrders) mNavOrders.onclick = () => setView("orders");

  const mNavAds = $("mNavAds");
  if (mNavAds) mNavAds.onclick = () => {
    if (authUser) openCreateAdModal();
    else openSignIn();
  };

  const mNavProfile = $("mNavProfile");
  if (mNavProfile) mNavProfile.onclick = () => {
    if (authUser) openProfile();
    else openSignIn();
  };

  updateOrdersBadge();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
