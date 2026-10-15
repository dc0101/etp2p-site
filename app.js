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
  } else if (!signedIn) {
    myAds = [];
    orders = [];
    if ($("orderList")) $("orderList").innerHTML = "";
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
      currency: fiat?.value || "ETB",
      payment: $("payment")?.value || "",
      amount,
      amountUnit: $("amountUnit")?.value || "",
      offset: adOffset,
      limit: PAGE_SIZE,
    });
  } catch (error) {
    finishAdsLoad();
    setDatabaseStatus("Supabase connection unavailable", false);
    if ($("rows")) $("rows").innerHTML = '<tr><td colspan="6"><div class="empty"><strong>Could not connect to the shared marketplace</strong>' + esc(error.message) + '</div></td></tr>';
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
    if ($("rows")) $("rows").innerHTML = '<tr><td colspan="6"><div class="empty"><strong>Could not load the shared marketplace</strong>Run the SQL setup file in Supabase, then reload this page.<br><span class="hint">' + esc(error.message) + '</span></div></td></tr>';
    if ($("count")) $("count").textContent = "0";
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
  if ($("offerTotal")) $("offerTotal").textContent = totalOffers.toLocaleString();
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
  if ($("amountUnit")) {
    if ($("amountUnit").options[0]) $("amountUnit").options[0].text = fiat?.value || "ETB";
    if ($("amountUnit").options[1]) $("amountUnit").options[1].text = coin?.value || "USDT";
  }
  const shown = offers.filter((offer) => !offer.archived);
  shown.sort((a, b) => side === "buy" ? a.price - b.price : b.price - a.price);
  
  if ($("rows")) {
    $("rows").innerHTML = shown.map((offer) => {
      const index = offers.indexOf(offer);
      const buttonText = offer.isOwn ? "Manage" : (side === "buy" ? "Buy " : "Sell ") + (coin?.value || "USDT");
      const buttonClass = offer.isOwn ? "outline" : (side === "buy" ? "primary" : "dark");
      const history = offer.completion === null ? "New merchant" : offer.completion + "%";
      return '<tr data-row-offer="' + index + '" tabindex="0" aria-label="Open offer from ' + esc(offer.name) + '"><td><div class="merchant"><div class="micon">' + esc(offer.ini) + '</div><div><div class="mname">' + esc(offer.name) + '</div><div class="meta">Shared Etp2p listing</div></div></div></td><td><div class="price">' + money(offer.price, offer.currency) + ' <small>/ ' + esc(coin?.value || "USDT") + '</small></div></td><td><div class="limit">' + offer.stock.toLocaleString() + ' ' + esc(coin?.value || "USDT") + '<br><small>' + money(offer.min, offer.currency) + ' – ' + money(offer.max, offer.currency) + '</small></div></td><td><div class="pays">' + offer.pay.map((method) => '<span class="pay ' + (method === "Tele Birr" || method === "CBE Birr" ? "wallet" : "bank") + '">' + esc(method) + '</span>').join("") + '</div></td><td><div class="rate">' + history + '<small>Order history</small></div></td><td><button class="btn small ' + buttonClass + '" data-offer="' + index + '">' + buttonText + '</button></td></tr>';
    }).join("");
    if (!shown.length) {
      $("rows").innerHTML = '<tr><td colspan="6"><div class="empty"><strong>No matching offers</strong>Try changing the currency, amount, or payment method, or post an offer.</div></td></tr>';
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
  if (view !== "market") {
    const adsView = view === "ads";
    const orderCardTitle = $("orders")?.querySelector(".cardtitle h2");
    if (orderCardTitle) orderCardTitle.textContent = adsView ? "Your ads" : "My P2P orders";
    if ($("orderFilter")) $("orderFilter").parentElement.style.display = adsView ? "none" : "flex";
    const orderTabs = $("orders")?.querySelector(".tabs");
    if (orderTabs) orderTabs.style.display = adsView ? "none" : "flex";
    if (adsView && typeof loadMyAds === "function") loadMyAds(); 
    else if (!adsView && typeof loadOrders === "function") loadOrders();
  } else {
    render();
  }
}

function setView(nextView) {
  if (nextView === "market") return displayView("market");
  if (!authUser) {
    notify("Sign in to open private account data.");
    if (typeof openSignIn === "function") openSignIn();
    return;
  }
  if (nextView === "orders") return displayView(nextView);
  if (typeof requireAal2 === "function") {
    requireAal2(() => displayView(nextView));
  } else {
    displayView(nextView);
  }
}

function trade(offer) {
  if (!authUser) {
    notify("Please sign in to start a trade.");
    if (typeof openSignIn === "function") openSignIn();
    return;
  }

  const inputAmount = prompt(`Enter amount of ${coin?.value || "USDT"} you want to trade (Stock: ${offer.stock}):`);
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
    if (typeof openSignIn === "function") openSignIn();
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

// Initialize app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    updateAccount(session?.user || null);
    loadAds(false);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAccount(session?.user || null);
  });

  if ($("coin")) $("coin").onchange = () => scheduleAdsLoad();
  if ($("fiat")) $("fiat").onchange = () => scheduleAdsLoad();
  if ($("amount")) $("amount").oninput = () => scheduleAdsLoad();
  if ($("amountUnit")) $("amountUnit").onchange = () => scheduleAdsLoad();
  if ($("payment")) $("payment").onchange = () => scheduleAdsLoad();

  const loadMoreBtn = $("loadMore");
  if (loadMoreBtn) loadMoreBtn.onclick = () => loadAds(true);

  document.querySelectorAll("[data-side]").forEach((btn) => {
    btn.onclick = () => {
      side = btn.dataset.side;
      document.querySelectorAll("[data-side]").forEach((b) => b.classList.toggle("active", b === btn));
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
