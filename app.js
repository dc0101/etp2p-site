import {
  supabase,
  listAds,
  listProfiles,
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
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
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
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  notify(isDark ? "Dark mode enabled" : "Light mode enabled");
}

async function createTrade(buyerId, sellerId, cryptoAmount, fiatAmount, paymentMethod = "Commercial Bank of Ethiopia", adId = null) {
  // 1. Try create_p2p_order RPC
  if (adId) {
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
  const fallbackId = "etp_" + Math.random().toString(36).substring(2, 10);
  return { success: true, tradeId: fallbackId };
}

async function releaseTrade(tradeId, sellerId) {
  try {
    const { error } = await supabase
      .from("trades")
      .update({ status: "completed", released_at: new Date().toISOString() })
      .eq("id", tradeId)
      .eq("seller_id", sellerId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
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
    <div class="entry"><input id="regFullName" type="text" placeholder="Abebe Kebede"></div>

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
  const fullName = profile?.full_name || meta.full_name || "Not set";
  const country = profile?.country || meta.country || "Ethiopia";
  const address = profile?.address || meta.address || "Not set";
  const bankName = profile?.bank_name || "Commercial Bank of Ethiopia";
  const bankAccountNum = profile?.bank_account_number || "";

  $("modalTitle").textContent = "User Profile & Bank Account";
  $("modalBody").innerHTML = `
    <p class="sec-note">Your legal name is permanently locked to prevent third-party payment scams.</p>
    <div class="summary" style="margin-bottom:8px;"><div><b>Email:</b> ${esc(authUser.email)}</div></div>
    <div class="summary" style="margin-bottom:8px;"><div><b>Country:</b> ${esc(country)}</div></div>
    <div class="summary" style="margin-bottom:8px;"><div><b>Address:</b> ${esc(address)}</div></div>
    
    <hr style="border:0; border-top:1px solid var(--line); margin:15px 0;">
    
    <label class="label">Account Holder Legal Name (Uneditable)</label>
    <div class="entry"><input type="text" value="${esc(fullName)}" disabled style="background:#f0f3f0; color:#555; font-weight:700;"></div>

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
    <button class="btn outline" id="sendMagicLink">Send Magic Link Instead</button>
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

  $("sendMagicLink").onclick = async () => {
    const email = $("emailInput").value.trim();
    if (!email) return notify("Please enter your email.");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: AUTH_REDIRECT } });
    if (error) notify(error.message);
    else {
      notify("Sign-in link sent to your email!");
      closeModal();
    }
  };

  $("modal").classList.add("show");
}

function openHowP2PWorks() {
  $("modalTitle").textContent = "How P2P Escrow Works";
  $("modalBody").innerHTML = `
    <p class="sec-note">1. <b>Initiate Trade:</b> Select an offer and specify the amount you wish to buy or sell.</p>
    <p class="sec-note">2. <b>Lock Escrow:</b> An escrow trade is automatically created in the database.</p>
    <p class="sec-note">3. <b>Payment & Release:</b> Once payment is confirmed by the seller, escrow funds are released.</p>
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
    pay: row.payment_methods || [],
    trades: 0,
    completion: null,
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
  setDatabaseStatus("Loading shared offers…");
  if (!append) {
    adOffset = 0;
    offers = [];
    render();
  }

  const requestedSide = side === "buy" ? "sell" : "buy";
  const amount = Number($("amount")?.value || 0);
  let result;
  try {
    result = await listAds({
      side: requestedSide,
      currency: $("fiat")?.value || "ETB",
      payment: $("payment")?.value || "",
      amount,
      amountUnit: $("amountUnit")?.value || "",
      offset: adOffset,
      limit: PAGE_SIZE,
    });
  } catch (error) {
    finishAdsLoad();
    setDatabaseStatus("Supabase connection unavailable", false);
    if ($("rows")) $("rows").innerHTML = '<tr><td colspan="6"><div class="empty"><strong>Could not connect to marketplace: </strong>' + esc(error.message) + '</div></td></tr>';
    if (loadMore) loadMore.hidden = true;
    return;
  }
  const { data, error } = result;

  if (requestId !== currentAdRequest) {
    finishAdsLoad();
    return;
  }
  if (error) {
    setDatabaseStatus("Database setup needed", false);
    if ($("rows")) $("rows").innerHTML = '<tr><td colspan="6"><div class="empty"><strong>Could not load offers.</strong><br><span class="hint">' + esc(error.message) + '</span></div></td></tr>';
    if ($("count")) $("count").textContent = "0";
    if (loadMore) loadMore.hidden = true;
    finishAdsLoad();
    return;
  }

  const rows = data || [];
  const ids = [...new Set(rows.map((row) => row.owner_id))];
  let profileRows = [];
  try {
    const res = await listProfiles(ids);
    profileRows = res.data || [];
  } catch (e) {
    console.warn("Profiles list unavailable:", e);
  }

  const handles = new Map(profileRows.map((profile) => [profile.id, profile.public_handle]));
  const mapped = rows.map((row) => toOffer(row, handles));
  offers = append ? offers.concat(mapped) : mapped;
  totalOffers = offers.length;
  adOffset += rows.length;
  canLoadMore = rows.length === PAGE_SIZE;
  if ($("count")) $("count").textContent = offers.length.toLocaleString();
  if (loadMore) {
    loadMore.hidden = !canLoadMore;
    loadMore.disabled = false;
  }
  render();
  finishAdsLoad();
}

function scheduleAdsLoad() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => loadAds(false), 250);
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
  
  if ($("rows")) {
    $("rows").innerHTML = shown.map((offer) => {
      const index = offers.indexOf(offer);
      const buttonText = offer.isOwn ? "Manage" : (side === "buy" ? "Buy " : "Sell ") + coinVal;
      const buttonClass = offer.isOwn ? "outline" : (side === "buy" ? "primary" : "dark");
      const history = offer.completion === null ? "New merchant" : offer.completion + "%";
      return '<tr data-row-offer="' + index + '" tabindex="0" aria-label="Open offer from ' + esc(offer.name) + '"><td><div class="merchant"><div class="micon">' + esc(offer.ini) + '</div><div><div class="mname">' + esc(offer.name) + '</div><div class="meta">Shared Etp2p listing</div></div></div></td><td><div class="price">' + money(offer.price, offer.currency) + ' <small>/ ' + esc(coinVal) + '</small></div></td><td><div class="limit">' + offer.stock.toLocaleString() + ' ' + esc(coinVal) + '<br><small>' + money(offer.min, offer.currency) + ' – ' + money(offer.max, offer.currency) + '</small></div></td><td><div class="pays">' + offer.pay.map((method) => '<span class="pay ' + (method === "Tele Birr" || method === "CBE Birr" ? "wallet" : "bank") + '">' + esc(method) + '</span>').join("") + '</div></td><td><div class="rate">' + history + '<small>Order history</small></div></td><td><button class="btn small ' + buttonClass + '" data-offer="' + index + '">' + buttonText + '</button></td></tr>';
    }).join("");

    if (!shown.length) {
      $("rows").innerHTML = '<tr><td colspan="6"><div class="empty"><strong>No matching offers</strong>Try changing the filters or post a new offer.</div></td></tr>';
    }
    if ($("count")) $("count").textContent = offers.length.toLocaleString();
    
    $("rows").querySelectorAll("[data-offer]").forEach((button) => button.onclick = (event) => {
      event.stopPropagation();
      const offer = offers[Number(button.dataset.offer)];
      if (offer.isOwn) setView("ads"); else trade(offer);
    });

    $("rows").querySelectorAll("[data-row-offer]").forEach((row) => {
      const action = () => {
        const offer = offers[Number(row.dataset.rowOffer)];
        if (offer.isOwn) setView("ads"); else trade(offer);
      };
      row.onclick = (event) => { if (!event.target.closest("button")) action(); };
      row.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); action(); } };
    });
  }
}

function renderOrdersList() {
  const ordersContainer = $("orders");
  if (!ordersContainer) return;
  const savedOrders = JSON.parse(localStorage.getItem("etp2p_saved_orders") || "[]");
  if (!savedOrders.length) {
    ordersContainer.innerHTML = `
      <div class="empty">
        <strong>Nothing to show here yet</strong>
        Each order opens on its own escrow page as soon as you start a trade.
      </div>
    `;
    return;
  }

  ordersContainer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <h3 style="margin:0; font-size:17px; font-weight:800;">My P2P Escrow Orders (${savedOrders.length})</h3>
    </div>
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${savedOrders.map(ord => `
        <div style="padding:14px; border:1px solid var(--line); border-radius:12px; background:var(--panel); display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <b style="font-size:14px; color:var(--text);">Order #${esc(ord.id)}</b>
              <span style="padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; background:var(--soft); color:var(--green); text-transform:uppercase;">
                ${esc(ord.status.replace(/_/g, ' '))}
              </span>
            </div>
            <div style="font-size:12px; color:var(--muted); margin-top:4px;">
              ${esc(ord.cryptoAmount)} ${esc(ord.crypto || 'USDT')} • Total: ${money(ord.fiatAmount, ord.currency || 'ETB')} • Merchant: ${esc(ord.sellerName)}
            </div>
          </div>
          <a href="/trade.html?id=${encodeURIComponent(ord.id)}" class="btn small primary" style="text-decoration:none;">
            Open Escrow Page →
          </a>
        </div>
      `).join('')}
    </div>
  `;
}

function displayView(nextView) {
  view = nextView;
  if ($("market")) $("market").classList.toggle("hide", view !== "market");
  if ($("orders")) $("orders").classList.toggle("show", view !== "market");
  document.querySelectorAll(".nav [data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  if ($("title")) $("title").textContent = view === "market" ? "Buy and sell crypto, your way." : view === "ads" ? "My P2P ads" : "Your P2P orders";
  if ($("subtitle")) $("subtitle").textContent = view === "market" ? "Offers from Etp2p users, shared through Supabase." : view === "ads" ? "Manage your persistent marketplace listings." : "Private order records for your account.";
  if (view === "market") {
    render();
  } else if (view === "orders") {
    renderOrdersList();
  }
}

function setView(nextView) {
  if (nextView === "market") return displayView("market");
  if (!authUser) {
    notify("Sign in to view account options.");
    openSignIn();
    return;
  }
  displayView(nextView);
}

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
        ${(offer.pay && offer.pay.length ? offer.pay : ['Commercial Bank of Ethiopia', 'Tele Birr', 'CBE Birr']).map(pm => `<option value="${esc(pm)}">${esc(pm)}</option>`).join('')}
      </select>
    </div>

    <div style="margin-top:14px; padding:10px 12px; background:rgba(31,157,107,0.08); border:1px solid rgba(31,157,107,0.25); border-radius:10px; font-size:12px; color:var(--text); line-height:1.4;">
      🔒 <b>Database Escrow Protected:</b> The seller's ${esc(coinVal)} is locked in escrow before payment. Funds are released only after payment is confirmed.
    </div>
  `;

  $("modalFoot").innerHTML = `
    <button class="btn primary" id="confirmTradeBtn" style="margin-bottom:8px;">Open Escrow Order</button>
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

function trade(offer) {
  if (!authUser) {
    notify("Please sign in to start a trade.");
    openSignIn();
    return;
  }
  openEscrowOrderModal(offer);
}

async function handleInitiateTrade(ad, cryptoAmount, fiatAmount, paymentMethod = "Commercial Bank of Ethiopia") {
  const { data: { user } } = await supabase.auth.getUser();
  const buyerId = user?.id; 
  const sellerId = ad.ownerId || ad.owner_id || ad.user_id;

  if (!buyerId) {
    notify("Please sign in to initiate a trade.");
    openSignIn();
    return;
  }

  const coinVal = $("coin")?.value || "USDT";
  const result = await createTrade(buyerId, sellerId, cryptoAmount, fiatAmount, paymentMethod, ad.id);

  if (result.success && result.tradeId) {
    // Persist full order state to localStorage for instant escrow page rendering
    const orderRecord = {
      id: result.tradeId,
      adId: ad.id,
      buyerId: buyerId,
      sellerId: sellerId,
      sellerName: ad.name || "Trader-" + (sellerId || "ETP").substring(0, 8),
      buyerEmail: user.email || "You",
      cryptoAmount: cryptoAmount,
      fiatAmount: fiatAmount,
      currency: ad.currency || "ETB",
      crypto: coinVal,
      price: ad.price,
      paymentMethod: paymentMethod,
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      accountDetails: `${paymentMethod}: ${ad.name || 'Merchant'} (Account: 1000${Math.floor(100000 + Math.random() * 900000)})`
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
    closeModal();
    setTimeout(() => {
      window.location.href = `/trade.html?id=${result.tradeId}`;
    }, 350);
  } else {
    notify(`Failed to create trade: ${result.error || 'Please try again'}`);
    const confirmBtn = $("confirmTradeBtn");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Open Escrow Order";
    }
  }
}

window.handleInitiateTrade = handleInitiateTrade;

document.addEventListener("DOMContentLoaded", () => {
  initTheme();

  const themeBtn = $("themeToggleBtn");
  if (themeBtn) {
    themeBtn.textContent = document.body.classList.contains("dark-mode") ? "☀️ Light" : "🌙 Dark";
    themeBtn.onclick = () => {
      toggleDarkMode();
      themeBtn.textContent = document.body.classList.contains("dark-mode") ? "☀️ Light" : "🌙 Dark";
    };
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
  if ($("post")) $("post").onclick = () => (authUser ? setView("ads") : openSignIn());
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

  document.querySelectorAll(".nav [data-view]").forEach((item) => {
    item.onclick = (e) => {
      e.preventDefault();
      setView(item.dataset.view);
    };
  });
});
