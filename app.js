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

// In-house Escrow Service functions
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

function openProfile() {
  if (!authUser) {
    notify("Please sign in to view your profile.");
    openSignIn();
    return;
  }
  $("modalTitle").textContent = "User Profile";
  $("modalBody").innerHTML = `
    <p class="sec-note">Your personal marketplace profile information.</p>
    <div class="summary" style="margin-bottom:12px;"><div><b>Email:</b> ${esc(authUser.email)}</div></div>
    <div class="summary"><div><b>User ID:</b> ${esc(authUser.id)}</div></div>
  `;
  $("modalFoot").innerHTML = `<button class="btn outline" onclick="document.getElementById('modal').classList.remove('show')">Close</button>`;
  $("modal").classList.add("show");
}

function openSecurity() {
  if (!authUser) {
    notify("Please sign in to view security settings.");
    openSignIn();
    return;
  }
  $("modalTitle").textContent = "Account Security";
  $("modalBody").innerHTML = `
    <p class="sec-note">Manage your credentials and password settings.</p>
    <div class="summary" style="margin-bottom:12px;"><div><b>Email:</b> ${esc(authUser.email)}</div></div>
    <label class="label" for="newPasswordInput">Change Password</label>
    <div class="entry"><input id="newPasswordInput" type="password" placeholder="Enter new password (min 6 chars)"></div>
  `;
  $("modalFoot").innerHTML = `
    <button class="btn primary" id="updatePasswordBtn" style="margin-bottom:8px;">Update Password</button>
    <button class="btn outline" id="signOutBtn">Sign Out</button>
  `;

  $("updatePasswordBtn").onclick = async () => {
    const password = $("newPasswordInput").value;
    if (!password || password.length < 6) {
      return notify("Password must be at least 6 characters.");
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) notify(error.message);
    else {
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
    <p class="sec-note">Sign in with your email address or magic link.</p>
    <label class="label" for="emailInput">Email address</label>
    <div class="entry"><input id="emailInput" type="email" placeholder="you@example.com"></div>
    <div style="margin-top:12px; text-align:right;">
      <a href="#" id="forgotPasswordLink" style="font-size:11px; color:var(--green); font-weight:700;">Forgot password?</a>
    </div>
  `;
  $("modalFoot").innerHTML = `<button class="btn primary" id="sendMagicLink">Send Sign-In Link</button>`;
  
  $("forgotPasswordLink").onclick = async (e) => {
    e.preventDefault();
    const email = $("emailInput").value.trim();
    if (!email) return notify("Please enter your email address above first.");
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
  const { data: profileRows } = await listProfiles(ids);
  const handles = new Map((profileRows || []).map((profile) => [profile.id, profile.public_handle]));
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
  supabase.auth.getSession().then(({ data: { session } }) => {
    updateAccount(session?.user || null);
    loadAds(false);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAccount(session?.user || null);
  });

  if ($("login")) $("login").onclick = () => (authUser ? openSecurity() : openSignIn());
  if ($("signup")) $("signup").onclick = () => (authUser ? openProfile() : openSignIn());
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
