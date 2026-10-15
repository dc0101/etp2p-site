import {
  supabase,
  listAds,
  listProfiles,
  listMyAds,
  createAd,
  updateAd,
  listMyOrders,
  createOrder,
  transitionOrder,
} from "./services/supabase.js";

"use strict";

const $ = (id) => document.getElementById(id);
const PAGE_SIZE = 50;
const AUTH_REDIRECT = "https://etp2p-site.onrender.com/";

let authUser = null;
let offers = [];
let myAds = [];
let orders = [];
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

async function createTrade(buyerId, sellerId, cryptoAmount, fiatAmount) {
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

    if (error) throw error;
    return { success: true, tradeId: data.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
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
      notify("Account created successfully! Please sign in.");
      closeModal();
      openSignIn();
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
    if (error) notify(error.message);
    else {
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
    myAds = [];
    orders = [];
    if ($("orderList")) $("orderList").innerHTML = "";
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

function displayView(nextView) {
  view = nextView;
  if ($("market")) $("market").classList.toggle("hide", view !== "market");
  if ($("orders")) $("orders").classList.toggle("show", view !== "market");
  document.querySelectorAll(".nav [data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  if ($("title")) $("title").textContent = view === "market" ? "Buy and sell crypto, your way." : view === "ads" ? "My P2P ads" : "Your P2P orders";
  if ($("subtitle")) $("subtitle").textContent = view === "market" ? "Offers from Etp2p users, shared through Supabase." : view === "ads" ? "Manage your persistent marketplace listings." : "Private order records for your account.";
  if (view === "market") {
    render();
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

function trade(offer) {
  if (!authUser) {
    notify("Please sign in to start a trade.");
    openSignIn();
    return;
  }

  const coinVal = $("coin")?.value || "USDT";
  const inputAmount = prompt(`Enter amount of ${coinVal} you want to trade (Stock: ${offer.stock}):`);
  const cryptoAmount = Number(inputAmount);

  if (!cryptoAmount || cryptoAmount <= 0) {
    notify("Invalid amount entered.");
    return;
  }

  if (cryptoAmount > offer.stock) {
    notify("Amount exceeds available stock for this offer.");
    return;
  }

  const fiatAmount = cryptoAmount * offer.price;
  handleInitiateTrade(offer, cryptoAmount, fiatAmount);
}

async function handleInitiateTrade(ad, cryptoAmount, fiatAmount) {
  const { data: { user } } = await supabase.auth.getUser();
  const buyerId = user?.id; 
  const sellerId = ad.owner_id || ad.user_id;

  if (!buyerId) {
    notify("Please sign in to initiate a trade.");
    openSignIn();
    return;
  }

  const result = await createTrade(buyerId, sellerId, cryptoAmount, fiatAmount);

  if (result.success) {
    window.location.href = `/trade.html?id=${result.tradeId}`;
  } else {
    notify(`Failed to create trade: ${result.error}`);
  }
}

async function handleReleaseTrade(tradeId) {
  const { data: { user } } = await supabase.auth.getUser();
  const sellerId = user?.id;

  if (!confirm("Are you sure you want to release the escrowed funds to the buyer?")) {
    return;
  }

  const result = await releaseTrade(tradeId, sellerId);

  if (result.success) {
    notify("Trade successfully completed and funds released!");
    location.reload();
  } else {
    notify(`Error releasing trade: ${result.error}`);
  }
}

window.handleReleaseTrade = handleReleaseTrade;
window.handleInitiateTrade = handleInitiateTrade;

document.addEventListener("DOMContentLoaded", () => {
  initTheme();

  // Dynamically inject theme toggle button beside profile/account button in header if present
  const profileBtn = $("profile") || $("signup") \vert{}\vert{} $("login");
  if (profileBtn && profileBtn.parentNode && !$("headerThemeBtn")) {
    const themeBtn = document.createElement("button");
    themeBtn.id = "headerThemeBtn";
    themeBtn.className = "btn small outline";
    themeBtn.style.marginRight = "8px";
    themeBtn.textContent = document.body.classList.contains("dark-mode") ? "☀️ Light" : "🌙 Dark";
    themeBtn.onclick = () => {
      toggleDarkMode();
      themeBtn.textContent = document.body.classList.contains("dark-mode") ? "☀️ Light" : "🌙 Dark";
    };
    profileBtn.parentNode.insertBefore(themeBtn, profileBtn);
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
