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

import { createTrade, releaseTrade } from "./services/escrowService.js";

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
  if (nextView === "orders") return displayView(nextView);
  requireAal2(() => displayView(nextView));
}

function showMfaCodePrompt(client, factor, onVerified, title = "Verify authenticator") {
  client.auth.mfa.challenge({ factorId: factor.id }).then(({ data, error }) => {
    if (error) throw error;
    $("modalTitle").textContent = title;
    $("modalBody").innerHTML = '<p class="sec-note">Enter the current six-digit code from your authenticator app. This extra check is required before posting ads or changing order status.</p><label class="label" for="mfaCode">Authenticator code</label><div class="entry"><input id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000"></div>';
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
    $("modalBody").innerHTML = '<p class="sec-note">Scan this QR code with an authenticator app, then enter its six-digit code. This extra step protects ad posting and order status changes. Creating an order only requires signing in.</p><div style="text-align:center"><img alt="Authenticator setup QR code" src="' + esc(qr) + '" style="width:190px;height:190px;max-width:100%;border:1px solid #e8eee9;border-radius:10px;padding:8px"><p class="hint">If you cannot scan it, enter this setup key manually:</p><code style="display:inline-block;word-break:break-all;padding:8px;background:#f6f8f6;border-radius:8px">' + esc(data.totp.secret) + '</code></div><label class="label" for="enrollCode">Authenticator code</label><div class="entry"><input id="enrollCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000"></div>';
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
      $("modalBody").innerHTML = '<p class="sec-note">You can create and view orders after signing in. Authenticator verification is required before posting ads or changing order status. Your authenticator app generates the codes; Etp2p does not store them.</p>';
      $("modalFoot").innerHTML = '<button class="btn primary" id="setupMfa">Set up authenticator</button>';
      $("setupMfa").onclick = () => startMfaEnrollment(async () => notify("Your account is protected."));
    } else {
      $("modalBody").innerHTML = '<div class="summary"><div><b>Authenticator enabled</b><br><span>Required for posting ads and changing order status. Creating and viewing orders only requires sign-in.</span></div></div>';
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
  $("modalBody").innerHTML = '<p class="sec-note">Sign up to create your account.</p>';
}

function trade(offer) {
  if (!authUser) {
    notify("Please sign in to start a trade.");
    openSignIn();
    return;
  }

  const inputAmount = prompt(`Enter amount of ${coin.value} you want to trade (Stock: ${offer.stock}):`);
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
    console.log("Trade created successfully:", result.tradeId);
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

// Expose globally for HTML event handlers
window.handleReleaseTrade = handleReleaseTrade;
window.handleInitiateTrade = handleInitiateTrade;
