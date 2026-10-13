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
const PAYMENT_METHODS = [
  "Commercial Bank of Ethiopia",
  "Tele Birr",
  "CBE Birr",
  "Bank of Abyssinia",
  "Awash Bank",
  "Dashen Bank",
];

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
let orderSide = "all";
let toastTimer;
let filterTimer;
let currentAdRequest = 0;
const coin = $("coin");
const fiat = $("fiat");

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

function money(value, currency) {
  const n = Number(value) || 0;
  if (currency === "ETB") return "Br " + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function notify(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3000);
}

function setDatabaseStatus(message, healthy = true) {
  $("dbStatus").textContent = message;
  $("dbStatus").style.color = healthy ? "#17241d" : "#a33b26";
}

function updateAccount(user) {
  const previousUserId = authUser?.id || null;
  authUser = user || null;
  const signedIn = Boolean(authUser);
  $("login").textContent = signedIn ? "Account" : "Sign in";
  $("signup").textContent = signedIn ? "Profile" : "Sign up";
  $("profile").textContent = (authUser?.email || "A").slice(0, 1).toUpperCase();
  if (previousUserId && previousUserId !== authUser?.id) {
    myAds = [];
    orders = [];
    $("orderList").innerHTML = "";
    displayView("market");
  } else if (!signedIn) {
    myAds = [];
    orders = [];
    $("orderList").innerHTML = "";
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
  const amount = Number($("amount").value || 0);
  let result;
  try {
    result = await listAds({
      side: requestedSide,
      currency: fiat.value,
      payment: $("payment").value,
      amount,
      amountUnit: $("amountUnit").value,
      offset: adOffset,
      limit: PAGE_SIZE,
    });
  } catch (error) {
    finishAdsLoad();
    setDatabaseStatus("Supabase connection unavailable", false);
    $("rows").innerHTML = '<tr><td colspan="6"><div class="empty"><strong>Could not connect to the shared marketplace</strong>' + esc(error.message) + '</div></td></tr>';
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
    $("rows").innerHTML = '<tr><td colspan="6"><div class="empty"><strong>Could not load the shared marketplace</strong>Run the SQL setup file in Supabase, then reload this page.<br><span class="hint">' + esc(error.message) + '</span></div></td></tr>';
    $("count").textContent = "0";
    if (loadMore) loadMore.hidden = true;
    finishAdsLoad();
    return;
  }

  const rows = data || [];
  const ids = [...new Set(rows.map((row) => row.owner_id))];
  const { data: profileRows, error: profileError } = await listProfiles(ids);
  if (profileError) {
    setDatabaseStatus("Offers loaded · merchant names unavailable", false);
  } else {
    setDatabaseStatus("Connected · shared Supabase data");
  }
  const handles = new Map((profileRows || []).map((profile) => [profile.id, profile.public_handle]));
  const mapped = rows.map((row) => toOffer(row, handles));
  offers = append ? offers.concat(mapped) : mapped;
  totalOffers = offers.length;
  adOffset += rows.length;
  canLoadMore = rows.length === PAGE_SIZE;
  $("offerTotal").textContent = totalOffers.toLocaleString();
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
  $("amountUnit").options[0].text = fiat.value;
  $("amountUnit").options[1].text = coin.value;
  const shown = offers.filter((offer) => !offer.archived);
  shown.sort((a, b) => side === "buy" ? a.price - b.price : b.price - a.price);
  $("rows").innerHTML = shown.map((offer) => {
    const index = offers.indexOf(offer);
    const buttonText = offer.isOwn ? "Manage" : (side === "buy" ? "Buy " : "Sell ") + coin.value;
    const buttonClass = offer.isOwn ? "outline" : (side === "buy" ? "primary" : "dark");
    const history = offer.completion === null ? "New merchant" : offer.completion + "%";
    return '<tr data-row-offer="' + index + '" tabindex="0" aria-label="Open offer from ' + esc(offer.name) + '"><td><div class="merchant"><div class="micon">' + esc(offer.ini) + '</div><div><div class="mname">' + esc(offer.name) + '</div><div class="meta">Shared Etp2p listing</div></div></div></td><td><div class="price">' + money(offer.price, offer.currency) + ' <small>/ ' + esc(coin.value) + '</small></div></td><td><div class="limit">' + offer.stock.toLocaleString() + ' ' + esc(coin.value) + '<br><small>' + money(offer.min, offer.currency) + ' – ' + money(offer.max, offer.currency) + '</small></div></td><td><div class="pays">' + offer.pay.map((method) => '<span class="pay ' + (method === "Tele Birr" || method === "CBE Birr" ? "wallet" : "bank") + '">' + esc(method) + '</span>').join("") + '</div></td><td><div class="rate">' + history + '<small>Order history</small></div></td><td><button class="btn small ' + buttonClass + '" data-offer="' + index + '">' + buttonText + '</button></td></tr>';
  }).join("");
  if (!shown.length) {
    $("rows").innerHTML = '<tr><td colspan="6"><div class="empty"><strong>No matching offers</strong>Try changing the currency, amount, or payment method, or post an offer.</div></td></tr>';
  }
  $("count").textContent = offers.length.toLocaleString();
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

function displayView(nextView) {
  view = nextView;
  $("market").classList.toggle("hide", view !== "market");
  $("orders").classList.toggle("show", view !== "market");
  document.querySelectorAll(".nav [data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  $("title").textContent = view === "market" ? "Buy and sell crypto, your way." : view === "ads" ? "My P2P ads" : "Your P2P orders";
  $("subtitle").textContent = view === "market" ? "Offers from Etp2p users, shared through Supabase." : view === "ads" ? "Manage your persistent marketplace listings." : "Private order records for your account.";
  if (view !== "market") {
    const adsView = view === "ads";
    $("orders").querySelector(".cardtitle h2").textContent = adsView ? "Your ads" : "My P2P orders";
    $("orderFilter").parentElement.style.display = adsView ? "none" : "flex";
    $("orders").querySelector(".tabs").style.display = adsView ? "none" : "flex";
    if (adsView) loadMyAds(); else loadOrders();
  } else {
    render();
  }
}

function setView(nextView) {
  if (nextView === "market") return displayView("market");
  if (!authUser) {
    notify("Sign in to open private account data.");
    openSignIn();
    return;
  }
  requireAal2(() => displayView(nextView));
}

function showMfaCodePrompt(client, factor, onVerified, title = "Verify authenticator") {
  client.auth.mfa.challenge({ factorId: factor.id }).then(({ data, error }) => {
    if (error) throw error;
    $("modalTitle").textContent = title;
    $("modalBody").innerHTML = '<p class="sec-note">Enter the current six-digit code from your authenticator app. Etp2p requires this check before orders or listing changes.</p><label class="label" for="mfaCode">Authenticator code</label><div class="entry"><input id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000"></div>';
    $("modalFoot").innerHTML = '<button class="btn primary" id="verifyMfa">Verify and continue</button>';
    $("verifyMfa").onclick = async () => {
      const code = $("mfaCode").value.trim();
      if (!/^\d{6}$/.test(code)) return notify("Enter the six-digit code.");
      const button = $("verifyMfa"); button.disabled = true; button.textContent = "Verifying…";
      try {
        const { error: verifyError } = await client.auth.mfa.verify({ factorId: factor.id, challengeId: data.id, code });
        if (verifyError) throw verifyError;
        closeModal();
        await onVerified();
      } catch (error) {
        notify(error.message || "Authenticator code was not accepted.");
        button.disabled = false; button.textContent = "Verify and continue";
      }
    };
    $("modal").classList.add("show");
    $("mfaCode").focus();
  }).catch((error) => notify(error.message || "Could not start MFA verification."));
}

async function startMfaEnrollment(onVerified) {
  try {
    const { data: existingFactors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    for (const factor of (existingFactors.totp || []).filter((item) => item.status !== "verified")) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Etp2p authenticator" });
    if (error) throw error;
    const qr = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(data.totp.qr_code);
    $("modalTitle").textContent = "Secure your Etp2p account";
    $("modalBody").innerHTML = '<p class="sec-note">Scan this QR code with an authenticator app, then enter its six-digit code. This extra step protects private order and listing changes.</p><div style="text-align:center"><img alt="Authenticator setup QR code" src="' + esc(qr) + '" style="width:190px;height:190px;max-width:100%;border:1px solid #e8eee9;border-radius:10px;padding:8px"><p class="hint">If you cannot scan it, enter this setup key manually:</p><code style="display:inline-block;word-break:break-all;padding:8px;background:#f6f8f6;border-radius:8px">' + esc(data.totp.secret) + '</code></div><label class="label" for="enrollCode">Authenticator code</label><div class="entry"><input id="enrollCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000"></div>';
    $("modalFoot").innerHTML = '<button class="btn primary" id="confirmMfa">Enable authenticator</button>';
    $("confirmMfa").onclick = async () => {
      const code = $("enrollCode").value.trim();
      if (!/^\d{6}$/.test(code)) return notify("Enter the six-digit code.");
      const button = $("confirmMfa"); button.disabled = true; button.textContent = "Checking code…";
      try {
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: data.id, code });
        if (verifyError) throw verifyError;
        closeModal();
        notify("Authenticator security is enabled.");
        await onVerified();
      } catch (verifyError) {
        notify(verifyError.message || "That code was not accepted. Try the next code.");
        button.disabled = false; button.textContent = "Enable authenticator";
      }
    };
    $("modal").classList.add("show");
    $("enrollCode").focus();
  } catch (error) {
    notify(error.message || "Could not start authenticator setup.");
  }
}

async function requireAal2(onVerified) {
  if (!authUser) {
    notify("Sign in before continuing.");
    openSignIn();
    return;
  }
  try {
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;
    if (assurance.currentLevel === "aal2") return await onVerified();
    const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) throw factorError;
    const factor = (factorData.totp || []).find((item) => item.status === "verified");
    if (factor) return showMfaCodePrompt(supabase, factor, onVerified);
    notify("Set up an authenticator to use private trading features.");
    await startMfaEnrollment(onVerified);
  } catch (error) {
    notify(error.message || "Could not verify account security.");
  }
}

function openSecurity() {
  if (!authUser) {
    notify("Sign in to set up account security.");
    openSignIn();
    return;
  }
  supabase.auth.mfa.listFactors().then(({ data, error }) => {
    if (error) throw error;
    const factor = (data.totp || []).find((item) => item.status === "verified");
    $("modalTitle").textContent = "Account security";
    if (!factor) {
      $("modalBody").innerHTML = '<p class="sec-note">Authenticator verification is required before posting ads, viewing order records, or changing order status. Your authenticator app generates the codes; Etp2p does not store them.</p>';
      $("modalFoot").innerHTML = '<button class="btn primary" id="setupMfa">Set up authenticator</button>';
      $("setupMfa").onclick = () => startMfaEnrollment(async () => notify("Your account is protected."));
    } else {
      $("modalBody").innerHTML = '<div class="summary"><div><b>Authenticator enabled</b><br><span>Orders and listing changes require a fresh verified session.</span></div></div>';
      $("modalFoot").innerHTML = '<button class="btn outline" id="verifySecurity">Verify authenticator</button><div class="fine">If you lose access to your authenticator, use Supabase account recovery.</div>';
      $("verifySecurity").onclick = () => requireAal2(async () => { closeModal(); notify("Authenticator verified for this session."); });
    }
    $("modal").classList.add("show");
  }).catch((error) => notify(error.message || "Could not load security settings."));
}

function authSetupMessage() {
  return '<p class="sec-note">Supabase authentication is not available. Check the network connection and the project URL/public key in services/supabase.js. Never place a service-role or secret key in browser code.</p>';
}

function openSignUp() {
  $("modalTitle").textContent = "Create your Etp2p account";
  $("modalBody").innerHTML = '<p class="sec-note">Create an email account. Your password is handled by Supabase Auth.</p><label class="label" for="signupEmail">Email</label><div class="entry"><input id="signupEmail" type="email" autocomplete="email" required placeholder="name@example.com"></div><label class="label" for="signupPass">Password</label><div class="entry"><input id="signupPass" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"></div><label class="label" for="signupConfirm">Confirm password</label><div class="entry"><input id="signupConfirm" type="password" autocomplete="new-password" minlength="8" required placeholder="Enter the password again"></div><div class="hint">You will need an authenticator app before posting ads or creating orders.</div>';
  $("modalFoot").innerHTML = '<button class="btn primary" id="createAccount">Create account</button><div class="fine">Already registered? <button class="tab" id="toSignIn" style="padding:0">Sign in</button></div>';
  $("toSignIn").onclick = openSignIn;
  $("createAccount").onclick = async () => {
    const email = $("signupEmail").value.trim();
    const password = $("signupPass").value;
    if (!email || !password || !$("signupConfirm").value) return notify("Complete all fields first.");
    if (password.length < 10) return notify("Use a password with at least 10 characters.");
    if (password !== $("signupConfirm").value) return notify("The passwords do not match.");
    const button = $("createAccount"); button.disabled = true; button.textContent = "Creating account…";
    try {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: AUTH_REDIRECT } });
      if (error) throw error;
      if (data.session) {
        updateAccount(data.user);
        closeModal();
        await loadAds(false);
        notify("Account created. Set up your authenticator to trade.");
      } else {
        $("modalBody").innerHTML = '<div class="summary"><div><b>Check your email</b><br><span>Use the confirmation link to activate your account.</span></div></div>';
        $("modalFoot").innerHTML = '<button class="btn primary" data-close>Done</button>';
        $("modalFoot").querySelector("[data-close]").onclick = closeModal;
      }
    } catch (error) {
      notify(error.message || "Sign-up failed. Try again.");
      button.disabled = false; button.textContent = "Create account";
    }
  };
  $("modal").classList.add("show");
}

function openSignIn() {
  $("modalTitle").textContent = "Sign in to Etp2p";
  $("modalBody").innerHTML = '<p class="sec-note">Sign in using your registered email. If you enabled authenticator security, Etp2p will ask for a code before private trading actions.</p><label class="label" for="loginName">Email</label><div class="entry"><input id="loginName" type="email" autocomplete="email" placeholder="name@example.com"></div><label class="label" for="loginPass">Password</label><div class="entry"><input id="loginPass" type="password" autocomplete="current-password" placeholder="Password"></div>';
  $("modalFoot").innerHTML = '<button class="btn primary" id="realSignIn">Sign in</button><div class="fine">New to Etp2p? <button class="tab" id="toSignUp" style="padding:0">Create an account</button></div>';
  $("toSignUp").onclick = openSignUp;
  $("realSignIn").onclick = async () => {
    const email = $("loginName").value.trim();
    const password = $("loginPass").value;
    if (!email || !password) return notify("Enter your email and password.");
    const button = $("realSignIn"); button.disabled = true; button.textContent = "Signing in…";
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      updateAccount(data.user);
      closeModal();
      await loadAds(false);
      notify("Signed in. Private data needs authenticator verification.");
    } catch (error) {
      notify(error.message || "Sign-in failed. Check your details.");
      button.disabled = false; button.textContent = "Sign in";
    }
  };
  $("modal").classList.add("show");
}

function openAccount() {
  if (!authUser) return openSignIn();
  $("modalTitle").textContent = "Your account";
  $("modalBody").innerHTML = '<div class="summary"><div><b>Signed in</b><br><span>' + esc(authUser.email || "") + '</span></div></div><p class="sec-note" style="margin-top:14px">Posting ads, reading private orders, and changing order status require authenticator verification.</p>';
  $("modalFoot").innerHTML = '<button class="btn outline" id="accountSecurity">Security options</button><button class="btn primary" id="signOut" style="margin-top:8px">Sign out</button>';
  $("accountSecurity").onclick = openSecurity;
  $("signOut").onclick = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      updateAccount(null);
      closeModal();
      render();
      notify("Signed out.");
    } catch (error) { notify(error.message || "Could not sign out."); }
  };
  $("modal").classList.add("show");
}

function openAdForm() {
  if (!authUser) return openSignIn();
  const methods = PAYMENT_METHODS.map((method, index) => '<label class="security-row" style="padding:8px"><span><b>' + esc(method) + '</b></span><input type="checkbox" name="adPayment" value="' + esc(method) + '" ' + (index === 0 ? "checked" : "") + '></label>').join("");
  $("modalTitle").textContent = "Post a shared ad";
  $("modalBody").innerHTML = '<p class="sec-note">This ad is saved in Supabase and visible to everyone. Etp2p does not hold crypto, send bank transfers, or verify payment.</p><label class="label" for="adSide">I want to</label><select id="adSide" class="method-select"><option value="sell">Sell USDT</option><option value="buy">Buy USDT</option></select><label class="label" for="adCurrency">Currency</label><select id="adCurrency" class="method-select"><option value="ETB">Birr (ETB)</option><option value="USD">USD</option></select><label class="label" for="adPrice">Rate per USDT</label><div class="entry"><input id="adPrice" type="number" min="0.01" step="0.01" value="185"><span id="adPriceUnit">Birr / USDT</span></div><label class="label" for="adStock">Available USDT</label><div class="entry"><input id="adStock" type="number" min="0.00000001" step="0.00000001" value="100"><span>USDT</span></div><label class="label" for="adMin">Minimum trade</label><div class="entry"><input id="adMin" type="number" min="500" step="1" value="500"><span id="adFiatUnit">Birr</span></div><label class="label" for="adMax">Maximum trade</label><div class="entry"><input id="adMax" type="number" min="500" step="1" value="5000"><span class="adFiatUnit">Birr</span></div><label class="label">Accepted payment methods</label><div class="security-list">' + methods + '</div>';
  $("adCurrency").onchange = () => {
    const isBirr = $("adCurrency").value === "ETB";
    $("adPriceUnit").textContent = (isBirr ? "Birr" : "USD") + " / USDT";
    document.querySelectorAll(".adFiatUnit").forEach((item) => item.textContent = isBirr ? "Birr" : "USD");
    $("adFiatUnit").textContent = isBirr ? "Birr" : "USD";
    $("adPrice").value = isBirr ? "185" : "1";
    $("adMin").min = isBirr ? "500" : "3";
    $("adMin").value = isBirr ? "500" : "3";
    $("adMax").min = isBirr ? "500" : "3";
    $("adMax").value = isBirr ? "5000" : "100";
  };
  $("modalFoot").innerHTML = '<button class="btn primary" id="publishAd">Save ad to Supabase</button><div class="fine">Archived listings and order records stay in the database.</div>';
  $("publishAd").onclick = async () => {
    const price = Number($("adPrice").value);
    const stock = Number($("adStock").value);
    const min = Number($("adMin").value);
    const max = Number($("adMax").value);
    const currency = $("adCurrency").value;
    const paymentMethods = [...document.querySelectorAll('input[name="adPayment"]:checked')].map((input) => input.value);
    const minimumAllowed = currency === "ETB" ? 500 : 3;
    if (!(price > 0 && stock > 0 && min >= minimumAllowed && max >= min) || paymentMethods.length === 0) {
      return notify("Check the rate, stock, limits, and payment methods.");
    }
    const button = $("publishAd"); button.disabled = true; button.textContent = "Saving…";
    try {
      const { error } = await createAd({
        owner_id: authUser.id,
        side: $("adSide").value,
        asset: "USDT",
        currency,
        price_per_unit: price,
        available_amount: stock,
        min_fiat_amount: min,
        max_fiat_amount: max,
        payment_methods: paymentMethods,
      });
      if (error) throw error;
      closeModal();
      await loadAds(false);
      if (view === "ads") await loadMyAds();
      notify("Ad saved and shared with all Etp2p visitors.");
    } catch (error) {
      notify(error.message || "Could not save this ad. Check the Supabase SQL setup and security status.");
      button.disabled = false; button.textContent = "Save ad to Supabase";
    }
  };
  $("modal").classList.add("show");
}

function trade(offer) {
  if (offer.isOwn) return setView("ads");
  if (!authUser) {
    notify("Sign in and enable authenticator security to create an order.");
    openSignIn();
    return;
  }
  requireAal2(() => openTradeForm(offer));
}

function openTradeForm(offer) {
  const isBuy = side === "buy";
  const currency = offer.currency;
  const minimumCrypto = offer.min / offer.price;
  const maximumCrypto = offer.max / offer.price;
  let requestKey = globalThis.crypto.randomUUID();
  $("modalTitle").textContent = (isBuy ? "Buy " : "Sell ") + coin.value;
  $("modalBody").innerHTML = '<div class="summary"><div><b>' + esc(offer.name) + '</b><br><span>Supabase marketplace offer</span></div><div style="text-align:right"><b>' + money(offer.price, currency) + '</b><br><span>per ' + esc(coin.value) + '</span></div></div><label class="label" for="tradeAmount">' + (isBuy ? "Amount to pay" : "USDT to sell") + '</label><div class="entry"><input id="tradeAmount" type="number" min="0" step="0.00000001" placeholder="Enter amount"><span>' + (isBuy ? (currency === "ETB" ? "Birr" : "USD") : coin.value) + '</span></div><div class="hint">Offer limits: ' + money(offer.min, currency) + ' – ' + money(offer.max, currency) + ' · Available: ' + offer.stock.toLocaleString() + ' USDT</div><label class="label" for="tradePayment">Payment method</label><select id="tradePayment" class="method-select">' + offer.pay.map((method) => '<option>' + esc(method) + '</option>').join("") + '</select><div class="lines"><div class="line"><span>You receive</span><b id="estimate">— USDT</b></div><div class="line"><span>Order storage</span><b style="color:#28774a">Supabase</b></div></div><p class="sec-note" style="margin-top:12px">This saves an order record and reserves the listed amount. It does not move crypto or verify a bank transfer. Arrange payment safely outside Etp2p.</p>';
  $("modalFoot").innerHTML = '<button class="btn primary" id="continue">Create order record</button><div class="fine">No crypto custody, bank integration, or escrow is connected.</div>';
  $("tradeAmount").oninput = () => {
    const amount = Number($("tradeAmount").value || 0);
    const cryptoAmount = isBuy ? amount / offer.price : amount;
    $("estimate").textContent = cryptoAmount > 0 ? cryptoAmount.toFixed(8) + " USDT" : "— USDT";
  };
  $("continue").onclick = async () => {
    const entered = Number($("tradeAmount").value || 0);
    const cryptoAmount = isBuy ? entered / offer.price : entered;
    const fiatAmount = cryptoAmount * offer.price;
    if (!(cryptoAmount > 0) || !Number.isFinite(cryptoAmount)) return notify("Enter a valid amount.");
    if (fiatAmount < offer.min || fiatAmount > offer.max) return notify("The order is outside this ad’s fiat limits.");
    if (cryptoAmount > offer.stock) return notify("The ad does not have enough USDT available.");
    const button = $("continue"); button.disabled = true; button.textContent = "Saving order…";
    try {
      const { data, error } = await createOrder({
        adId: offer.adId,
        cryptoAmount: Number(cryptoAmount.toFixed(8)),
        paymentMethod: $("tradePayment").value,
        requestKey,
      });
      if (error) throw error;
      const orderId = data;
      $("modalBody").innerHTML = '<div style="text-align:center;padding:10px"><div style="font-size:30px;color:#298150">✓</div><b>Order record saved</b><p class="sec-note">It is stored in Supabase and visible only to the two participants. No funds moved and no payment was checked.</p><div class="lines"><div class="line"><span>Order ID</span><b>' + esc(orderId) + '</b></div><div class="line"><span>Merchant</span><b>' + esc(offer.name) + '</b></div><div class="line"><span>Payment method</span><b>' + esc($("tradePayment").value) + '</b></div><div class="line"><span>Status</span><b>Waiting for payment</b></div></div></div>';
      $("modalFoot").innerHTML = '<button class="btn primary" id="viewOrders">View my orders</button>';
      $("viewOrders").onclick = () => { closeModal(); setView("orders"); };
      await Promise.all([loadOrders(), loadAds(false)]);
    } catch (error) {
      notify(error.message || "Could not create this order. The listing may have changed.");
      button.disabled = false; button.textContent = "Create order record";
    }
  };
  $("modal").classList.add("show");
}

async function loadOrders() {
  $("orderList").innerHTML = '<div class="empty">Loading private order records…</div>';
  const { data, error } = await listMyOrders();
  if (error) {
    $("orderList").innerHTML = '<div class="empty"><strong>Could not load private orders</strong>' + esc(error.message) + '</div>';
    return;
  }
  orders = data || [];
  renderOrders();
}

function renderOrders() {
  const filter = $("orderFilter").value || "all";
  const data = orders.filter((order) => {
    const userSide = order.buyer_id === authUser?.id ? "buy" : "sell";
    return (orderSide === "all" || userSide === orderSide) &&
      (filter === "all" || (filter === "progress" && ["pending", "payment_marked"].includes(order.status)) || order.status === filter);
  });
  if (!data.length) {
    $("orderList").innerHTML = '<div class="empty">▤<strong>No saved orders</strong>Your Supabase orders will appear here.<br><button class="btn quiet small" id="browse" style="margin-top:10px">Browse offers</button></div>';
    $("browse").onclick = () => displayView("market");
    return;
  }
  $("orderList").innerHTML = data.map((order) => {
    const statusText = { pending: "Waiting for payment", payment_marked: "Buyer marked paid", completed: "Marked complete", cancelled: "Cancelled" }[order.status] || order.status;
    const statusClass = order.status === "completed" ? "done" : order.status === "cancelled" ? "cancelled" : "";
    const isBuyer = order.buyer_id === authUser.id;
    const action = order.status === "pending"
      ? '<button class="btn quiet small" data-order-action="' + (isBuyer ? "mark_paid" : "cancel") + '" data-id="' + esc(order.id) + '">' + (isBuyer ? "I paid" : "Cancel") + '</button>'
      : order.status === "payment_marked" && !isBuyer
        ? '<button class="btn primary small" data-order-action="complete" data-id="' + esc(order.id) + '">Confirm received</button>'
        : "";
    const cancel = order.status === "pending" ? '<button class="btn outline small" data-order-action="cancel" data-id="' + esc(order.id) + '">Cancel</button>' : "";
    return '<div class="order"><div><small>Order ' + esc(order.id) + ' · ' + new Date(order.created_at).toLocaleString() + '</small><strong>' + (isBuyer ? "Buy " : "Sell ") + esc(order.asset) + ' · ' + esc(order.merchant_handle) + '</strong><small>' + esc(order.payment_method) + '</small></div><div><small>Crypto amount</small><strong>' + Number(order.crypto_amount).toFixed(8) + ' ' + esc(order.asset) + '</strong></div><div><small>Fiat total</small><strong>' + money(order.fiat_amount, order.currency) + '</strong></div><div><span class="status ' + statusClass + '">' + esc(statusText) + '</span><div class="order-buttons">' + action + cancel + '</div></div></div>';
  }).join("") + '<p class="sec-note" style="padding:0 22px">Order status is user-reported. Etp2p does not verify payments or release crypto.</p>';
  $("orderList").querySelectorAll("[data-order-action]").forEach((button) => button.onclick = () => requireAal2(() => updateOrder(button.dataset.id, button.dataset.orderAction)));
}

async function updateOrder(id, action) {
  const { error } = await transitionOrder(id, action);
  if (error) {
    notify(error.message || "Could not update this order.");
    return;
  }
  await Promise.all([loadOrders(), loadAds(false)]);
  notify(action === "mark_paid" ? "Payment status saved. The seller must confirm independently." : action === "complete" ? "Completion status saved." : "Order cancelled and availability restored.");
}

async function loadMyAds() {
  $("orderList").innerHTML = '<div class="empty">Loading your ads…</div>';
  const { data, error } = await listMyAds(authUser.id);
  if (error) {
    $("orderList").innerHTML = '<div class="empty"><strong>Could not load your ads</strong>' + esc(error.message) + '</div>';
    return;
  }
  myAds = data || [];
  renderMyAds();
}

function renderMyAds() {
  if (!myAds.length) {
    $("orderList").innerHTML = '<div class="empty">◇<strong>No ads saved</strong>Create an ad and it will be stored in Supabase for other visitors to see.<br><button class="btn quiet small" id="createAd" style="margin-top:10px">Post an ad</button></div>';
    $("createAd").onclick = () => requireAal2(openAdForm);
    return;
  }
  $("orderList").innerHTML = myAds.map((ad) => {
    const isArchived = Boolean(ad.archived_at);
    const state = isArchived ? "Archived" : ad.is_active ? "Active" : "Paused";
    const buttons = isArchived ? "" : '<div class="order-buttons"><button class="btn quiet small" data-ad-action="toggle" data-id="' + esc(ad.id) + '">' + (ad.is_active ? "Pause" : "Activate") + '</button><button class="btn outline small" data-ad-action="archive" data-id="' + esc(ad.id) + '">Archive</button></div>';
    return '<div class="order"><div><small>Ad ' + esc(ad.id) + ' · ' + (ad.side === "sell" ? "Selling" : "Buying") + ' USDT</small><strong>' + money(ad.price_per_unit, ad.currency) + ' / USDT</strong><small>' + ad.payment_methods.map(esc).join(", ") + '</small></div><div><small>Available</small><strong>' + Number(ad.available_amount).toLocaleString() + ' USDT</strong></div><div><small>Trade limits</small><strong>' + money(ad.min_fiat_amount, ad.currency) + ' – ' + money(ad.max_fiat_amount, ad.currency) + '</strong></div><div><span class="status ' + (ad.is_active ? "done" : "cancelled") + '">' + state + '</span>' + buttons + '</div></div>';
  }).join("") + '<div style="padding:12px 22px"><button class="btn primary small" id="createAd">＋ Post another ad</button></div><p class="sec-note" style="padding:0 22px">Archive hides an ad from the marketplace while preserving its database record.</p>';
  $("createAd").onclick = () => requireAal2(openAdForm);
  $("orderList").querySelectorAll("[data-ad-action]").forEach((button) => button.onclick = () => requireAal2(() => updateMyAd(button.dataset.id, button.dataset.adAction)));
}

async function updateMyAd(id, action) {
  const ad = myAds.find((item) => item.id === id);
  if (!ad || ad.archived_at) return;
  const changes = action === "archive"
    ? { is_active: false, archived_at: new Date().toISOString() }
    : { is_active: !ad.is_active };
  const { error } = await updateAd(id, changes);
  if (error) return notify(error.message || "Could not update this ad.");
  await Promise.all([loadMyAds(), loadAds(false)]);
  notify(action === "archive" ? "Ad archived. The record remains in Supabase." : changes.is_active ? "Ad activated." : "Ad paused.");
}

function closeModal() { $("modal").classList.remove("show"); }

function showInfo(title, html) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = html;
  $("modalFoot").innerHTML = '<button class="btn primary" data-close>Got it</button>';
  $("modalFoot").querySelector("[data-close]").onclick = closeModal;
  $("modal").classList.add("show");
}

document.querySelectorAll("[data-side]").forEach((button) => button.onclick = () => {
  side = button.dataset.side;
  document.querySelectorAll("[data-side]").forEach((item) => item.classList.toggle("on", item === button));
  loadAds(false);
});
document.querySelectorAll("[data-view]").forEach((item) => item.onclick = (event) => { event.preventDefault(); setView(item.dataset.view); });
document.querySelectorAll("[data-oside]").forEach((button) => button.onclick = () => {
  orderSide = button.dataset.oside;
  document.querySelectorAll("[data-oside]").forEach((item) => item.classList.toggle("on", item === button));
  renderOrders();
});
[coin, fiat, $("amount"), $("payment"), $("amountUnit")].forEach((input) => input.addEventListener("input", scheduleAdsLoad));
$("orderFilter").onchange = renderOrders;
$("reset").onclick = () => {
  $("amount").value = "";
  $("payment").value = "all";
  loadAds(false);
  notify("Filters cleared.");
};
$("loadMore").onclick = () => loadAds(true);
$("refreshOffers").onclick = () => loadAds(false);
$("post").onclick = () => authUser ? requireAal2(openAdForm) : openSignIn();
$("how").onclick = () => showInfo("How Etp2p works", '<p class="sec-note">Offers and order records are stored in Supabase. Listings are shared with visitors; order records are visible only to the participants.</p><div class="lines"><div class="line"><span>01 · Browse</span><b>Read shared ads</b></div><div class="line"><span>02 · Create</span><b>Save an order record</b></div><div class="line"><span>03 · Settle</span><b>Arrange payment independently</b></div></div><p class="sec-note" style="margin-top:12px">Etp2p does not hold crypto, verify bank transfers, or provide escrow.</p>');
$("signup").onclick = () => authUser ? openAccount() : openSignUp();
$("login").onclick = () => authUser ? openAccount() : openSignIn();
$("security").onclick = openSecurity;
$("profile").onclick = () => authUser ? openAccount() : openSignIn();
$("help").onclick = (event) => { event.preventDefault(); showInfo("Help center", "<p class=\"sec-note\">Support is not connected yet.</p>"); };
$("terms").onclick = (event) => { event.preventDefault(); showInfo("P2P terms", "<p class=\"sec-note\">Etp2p stores listings and order status. Payments and crypto are handled independently between users.</p>"); };
document.querySelectorAll("[data-close]").forEach((button) => button.onclick = closeModal);
$("modal").onclick = (event) => { if (event.target === $("modal")) closeModal(); };
document.onkeydown = (event) => { if (event.key === "Escape") closeModal(); };

supabase.auth.onAuthStateChange((_event, session) => {
  const nextUser = session?.user || null;
  const changed = nextUser?.id !== authUser?.id;
  updateAccount(nextUser);
  if (changed) setTimeout(() => { loadAds(false); if (view === "ads" && authUser) loadMyAds(); if (view === "orders" && authUser) loadOrders(); }, 0);
});

(async function init() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    updateAccount(data.session?.user || null);
    await loadAds(false);
  } catch (error) {
    setDatabaseStatus("Supabase connection unavailable", false);
    $("rows").innerHTML = '<tr><td colspan="6"><div class="empty"><strong>Could not connect to Supabase</strong>' + esc(error.message) + '</div></td></tr>';
  }
})();
