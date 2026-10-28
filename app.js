import {
  supabase,
  listAds,
  listProfiles,
  createAd,
  updateAd,
  listMyAds,
  listMyOrders,
  createOrder,
} from "./services/supabase.js";
import {
  clearSessionTracking,
  consumeReauthenticationRequired,
  REAUTH_REQUIRED_KEY,
} from "./services/session.js";

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

// Creates a real order through the create_p2p_order database function.
// There is no fallback: if the server does not confirm, no order exists.
async function createTrade(cryptoAmount, paymentMethod, adId, requestKey) {
  if (!adId) return { success: false, error: "This offer is no longer available." };
  try {
    const { data, error } = await createOrder({ adId, cryptoAmount, paymentMethod, requestKey });
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "The server did not return an order." };
    return { success: true, tradeId: data };
  } catch (err) {
    return { success: false, error: err?.message || "Could not reach the server." };
  }
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

  `;
  $("modalFoot").innerHTML = `<button class="btn primary" id="submitSignUp">Register Account</button>`;

  $("submitSignUp").onclick = async () => {
    const email = $("regEmail").value.trim();
    const password = $("regPassword").value;
    const fullName = $("regFullName").value.trim();
    const country = $("regCountry").value.trim();
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
          country: country
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
  const fullName = profile?.full_name || meta.full_name || "Not set";
  const country = profile?.country || meta.country || "Ethiopia";
  const address = profile?.address || meta.address || "";
  const bankName = profile?.bank_name || "Commercial Bank of Ethiopia";
  const bankAccountNum = profile?.bank_account_number || "";

  $("modalTitle").textContent = "User Profile & Bank Account";
  $("modalBody").innerHTML = `
    <p class="sec-note">Your legal name is permanently locked to prevent third-party payment scams.</p>
    <div class="summary" style="margin-bottom:8px;"><div><b>Email:</b> ${esc(authUser.email)}</div></div>
    <div class="summary" style="margin-bottom:8px;"><div><b>Country:</b> ${esc(country)}</div></div>
    <div class="summary" style="margin-bottom:8px;"><div><b>Address:</b> ${address ? esc(address) : "Not provided"}</div></div>
    
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
    if (fullName === "Not set") return notify("Add your legal name to your account before saving bank details.");

    const { error } = await supabase.from("profiles").upsert({
      id: authUser.id,
      full_name: fullName,
      bank_account_name: fullName,
      bank_name: selectedBank,
      bank_account_number: accNum,
      country,
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
    clearSessionTracking();
    localStorage.removeItem(REAUTH_REQUIRED_KEY);
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
    <p class="sec-note">Create a live listing. Orders opened against it reserve part of the amount you list.</p>
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
    const btn = $("deactivateAdBtn");
    btn.disabled = true;
    const { error } = await updateAd(offer.id, { is_active: false, archived_at: new Date().toISOString() });
    if (error) {
      notify("Could not remove the ad: " + error.message);
      btn.disabled = false;
      return;
    }
    notify("Ad removed from the marketplace.");
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
    <p class="sec-note">1. <b>Choose an offer:</b> Pick an offer and enter how much USDT you want. The server creates an order and reserves that amount on the ad.</p>
    <p class="sec-note">2. <b>Pay:</b> The buyer pays the seller outside Etp2p, then marks the order as paid.</p>
    <p class="sec-note">3. <b>Confirm:</b> The seller checks the money arrived, then completes the order. Etp2p does not hold or move money or USDT.</p>
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

// Only real database fields; nothing is invented.
function toOffer(row, handles) {
  const handle = handles.get(row.owner_id) || "Etp2p merchant";
  return {
    id: row.id,
    adId: row.id,
    ownerId: row.owner_id,
    name: handle,
    ini: handle.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "ET",
    side: row.side,
    adSide: row.side,
    currency: row.currency,
    price: Number(row.price_per_unit),
    stock: Number(row.available_amount),
    min: Number(row.min_fiat_amount),
    max: Number(row.max_fiat_amount),
    pay: row.payment_methods || [],
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
  let loadError = null;

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
    if (result.error) loadError = result.error;
  } catch (error) {
    loadError = error;
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
  setDatabaseStatus(loadError ? "Could not load offers" : "Escrow marketplace active", !loadError);
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

  const openOffer = (offer) => { if (offer.isOwn) openManageAdModal(offer); else trade(offer); };
  const labelFor = (offer) => offer.isOwn ? "Manage" : (side === "buy" ? "Buy " : "Sell ") + coinVal;
  const classFor = (offer) => offer.isOwn ? "outline" : (side === "buy" ? "primary" : "dark");
  const payTags = (offer) => offer.pay.map((method) => '<span class="pay ' + (method === "Tele Birr" || method === "CBE Birr" ? "wallet" : "bank") + '">' + esc(method) + "</span>").join("");
  const emptyHtml = '<div class="empty"><strong>No matching offers</strong>Try changing the filters or post a new offer.</div>';

  if ($("rows")) {
    if (!shown.length) {
      $("rows").innerHTML = '<tr><td colspan="6">' + emptyHtml + "</td></tr>";
    } else {
      $("rows").innerHTML =
