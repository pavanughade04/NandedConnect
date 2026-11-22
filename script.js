"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const businesses = window.NandedConnect.data.businesses;
const categories = window.NandedConnect.data.categories;
const routeView = $("#routeView");
const homeSections = [...document.querySelectorAll("main > section")];
const heroSearchForm = $("#heroSearchForm");
const heroSearch = $("#heroSearch");
const directorySearch = $("#directorySearch");
const categoryFilter = $("#categoryFilter");
const areaFilter = $("#areaFilter");
const businessGrid = $("#businessGrid");
const resultCount = $("#resultCount");
const themeToggle = $("#themeToggle");
const form = $("#businessForm");
const formMessage = $("#formMessage");
const categoryGrid = $("#categoryGrid");
const navLinks = $("#navLinks");
const mobileMenu = $("#mobileMenu");
const THEME_KEY = "nandedseva_theme";
const SUBMISSIONS_KEY = "nandedseva_draft_submissions";
const FAVORITES_KEY = "nandedconnect_favorites";
const EXPLORE_STATE_KEY = "nandedconnect_explore_state";
const PROFILE_KEY = "nandedconnect_demo_profile";
const RECENT_KEY = "nandedconnect_recently_viewed";
const DASHBOARD_PREFS_KEY = "nandedconnect_dashboard_preferences";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function norm(value) { return String(value ?? "").trim().toLocaleLowerCase("en-IN"); }
function slugify(value) { return norm(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function businessId(business) { return slugify(business.name); }
function getBusiness(id) { return businesses.find((business) => businessId(business) === id); }
function readJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key) || "null"); return value ?? fallback; } catch (_) { return fallback; } }
function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
function readRecent() { const value = readJson(RECENT_KEY, []); return Array.isArray(value) ? value : []; }
function rememberBusiness(id) { writeJson(RECENT_KEY, [id, ...readRecent().filter((item) => item !== id)].slice(0, 6)); }
function mapUrl(business) {
  return "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(business.mapQuery || `${business.name}, ${business.address || business.area || "Nanded"}`);
}
function readFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (_) { return []; }
}
function isFavorite(business) { return readFavorites().includes(businessId(business)); }
function toggleFavorite(id) {
  const favorites = readFavorites();
  const next = favorites.includes(id) ? favorites.filter((favorite) => favorite !== id) : [...favorites, id];
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch (_) {}
  renderHomeDirectory();
  if (["business", "dashboard"].includes(getRoute().name)) renderRoute();
  else if (getRoute().name === "explore") renderExploreResults(readExploreState());
}

function getFilteredValues({ search = "", category = "", area = "", sort = "relevance" } = {}) {
  const query = norm(search);
  const filtered = businesses.filter((business) => {
    const text = norm([business.name, business.category, business.area, business.address, business.description].join(" "));
    return (!query || text.includes(query)) && (!category || business.category === category) && (!area || norm(business.area) === norm(area));
  });
  return filtered.sort((a, b) => {
    if (sort === "az") return a.name.localeCompare(b.name, "en-IN");
    if (sort === "za") return b.name.localeCompare(a.name, "en-IN");
    if (query) return (norm(a.name).startsWith(query) ? -1 : 0) - (norm(b.name).startsWith(query) ? -1 : 0) || a.name.localeCompare(b.name, "en-IN");
    return 0;
  });
}

function buildCard(business, index) {
  const id = businessId(business);
  const phone = String(business.phone || "").replace(/[^\d+]/g, "");
  const call = phone ? `<a class="call-link" href="tel:${esc(phone)}">☎ Call</a>` : "";
  const map = (business.mapQuery || business.address || business.area) ? `<a href="${mapUrl(business)}" target="_blank" rel="noopener noreferrer">Map ↗</a>` : "";
  const rating = Number.isFinite(business.rating) && business.reviews
    ? `<div class="business-rating" aria-label="Listed rating ${business.rating} from ${business.reviews} reviews">★ ${business.rating.toFixed(1)} <span>(${business.reviews.toLocaleString("en-IN")} public reviews shown in listing)</span></div>`
    : "";
  const favorite = isFavorite(business);
  return `<article class="business-card" data-business-id="${esc(id)}" style="animation-delay:${Math.min(index, 7) * 35}ms">
    <div class="business-card-head"><div class="business-top"><div class="business-icon" aria-hidden="true">${esc(business.icon || "📍")}</div><div><h3><a href="#/business/${esc(id)}">${esc(business.name)}</a></h3><span class="business-category">${esc(business.category)}</span></div></div><button class="favorite-button${favorite ? " is-favorite" : ""}" type="button" data-favorite-id="${esc(id)}" aria-label="${favorite ? "Remove" : "Add"} ${esc(business.name)} ${favorite ? "from" : "to"} favorites" aria-pressed="${String(favorite)}">${favorite ? "♥" : "♡"}</button></div>
    ${rating}
    <p class="business-desc">${esc(business.description)}</p>
    <div class="business-meta"><span>📍 ${esc(business.area)}, Nanded</span><span>${esc(business.address)}</span></div>
    <div class="business-actions"><a class="details-link" href="#/business/${esc(id)}">View details <span aria-hidden="true">→</span></a>${call}${map}</div>
  </article>`;
}
function emptyState(copy = "Try a different search or remove one of the filters.") {
  return `<div class="empty-state"><div class="empty-icon">⌕</div><h3>No matching businesses</h3><p>${esc(copy)}</p><button class="btn btn-outline" type="button" data-route-reset>Clear filters</button></div>`;
}

// Existing homepage directory behavior remains available alongside routed views.
function updateAreas(select = areaFilter, selected = select.value) {
  if (!select) return;
  const areas = [...new Set(businesses.map((business) => business.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en-IN"));
  select.replaceChildren(new Option("All localities", ""));
  areas.forEach((area) => select.add(new Option(area, area)));
  if (areas.includes(selected)) select.value = selected;
}
function syncHomeCategory() {
  categoryGrid.querySelectorAll(".category").forEach((button) => {
    const active = button.dataset.category === categoryFilter.value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
function renderHomeDirectory() {
  if (!businessGrid || !directorySearch || !categoryFilter || !areaFilter) return;
  const filtered = getFilteredValues({ search: directorySearch.value, category: categoryFilter.value, area: areaFilter.value });
  resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "business" : "businesses"} found`;
  businessGrid.innerHTML = filtered.length ? filtered.map(buildCard).join("") : emptyState("Try a different search or remove one of the filters. You can also suggest a business below.");
}
function resetHomeFilters() {
  heroSearch.value = ""; directorySearch.value = ""; categoryFilter.value = ""; areaFilter.value = ""; syncHomeCategory(); renderHomeDirectory();
}
function setHomeCategory(category) {
  categoryFilter.value = categoryFilter.value === category ? "" : category;
  syncHomeCategory(); renderHomeDirectory();
  $("#directory").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function getRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, queryString = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "explore") return { name: "explore", query: new URLSearchParams(queryString) };
  if (parts[0] === "categories") return { name: "categories" };
  if (parts[0] === "business") return { name: "business", id: parts[1] || "" };
  if (parts[0] === "about") return { name: "about" };
  if (parts[0] === "contact") return { name: "contact" };
  if (parts[0] === "list-business") return { name: "list-business" };
  if (parts[0] === "login") return { name: "login" };
  if (parts[0] === "signup") return { name: "signup" };
  if (parts[0] === "dashboard") return { name: "dashboard" };
  if (parts[0] === "business-dashboard") return { name: "business-dashboard" };
  return { name: "home" };
}
function setRouteVisibility(isRouted) {
  homeSections.forEach((section) => { section.hidden = isRouted; });
  routeView.hidden = !isRouted;
}
function updateNav(routeName) {
  navLinks.querySelectorAll(".nav-link").forEach((link) => link.classList.remove("active"));
  const target = routeName === "explore" ? "#/explore" : routeName === "categories" ? "#/categories" : routeName === "about" ? "#/about" : routeName === "contact" ? "#/contact" : "#home";
  const active = [...navLinks.querySelectorAll(".nav-link")].find((link) => link.getAttribute("href") === target);
  if (active) active.classList.add("active");
}
function readExploreState() {
  const route = getRoute();
  const hasUrlState = Boolean(route.query?.toString());
  if (!hasUrlState) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(EXPLORE_STATE_KEY) || "null");
      if (saved && typeof saved === "object") return { search: saved.search || "", category: saved.category || "", area: saved.area || "", sort: saved.sort || "relevance" };
    } catch (_) {}
  }
  return { search: route.query?.get("search") || "", category: route.query?.get("category") || "", area: route.query?.get("area") || "", sort: route.query?.get("sort") || "relevance" };
}
function updateExploreUrl(state) {
  const params = new URLSearchParams();
  if (state.search) params.set("search", state.search);
  if (state.category) params.set("category", state.category);
  if (state.area) params.set("area", state.area);
  if (state.sort && state.sort !== "relevance") params.set("sort", state.sort);
  const next = `#/explore${params.toString() ? `?${params.toString()}` : ""}`;
  try { sessionStorage.setItem(EXPLORE_STATE_KEY, JSON.stringify(state)); } catch (_) {}
  window.history.replaceState(null, "", next);
}
function categoryOptions(selected = "") {
  return `<option value="">All categories</option>${categories.map((category) => `<option value="${esc(category.name)}"${category.name === selected ? " selected" : ""}>${esc(category.name)}</option>`).join("")}`;
}
function areaOptions(selected = "") {
  const areas = [...new Set(businesses.map((business) => business.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en-IN"));
  return `<option value="">All localities</option>${areas.map((area) => `<option value="${esc(area)}"${area === selected ? " selected" : ""}>${esc(area)}</option>`).join("")}`;
}
function renderExploreResults(state) {
  const grid = $("#exploreBusinessGrid");
  const count = $("#exploreResultCount");
  if (!grid || !count) return;
  const filtered = getFilteredValues(state);
  count.textContent = `${filtered.length} ${filtered.length === 1 ? "business" : "businesses"} found`;
  grid.innerHTML = filtered.length ? filtered.map(buildCard).join("") : emptyState("No businesses match those filters. Try clearing one or more selections.");
}
function renderExploreRoute() {
  const state = readExploreState();
  updateExploreUrl(state);
  routeView.innerHTML = `<section class="route-page explore-page"><div class="container"><div class="route-heading"><div><span class="kicker">EXPLORE SERVICES</span><h1>Find trusted help <span class="text-gradient">nearby.</span></h1><p>Search Nanded businesses by name, category, locality, address, or service description.</p></div><span class="route-location">⌖ Nanded, Maharashtra</span></div><div class="explore-toolbar"><form class="route-search" id="exploreSearchForm" role="search"><span class="search-icon" aria-hidden="true">⌕</span><label class="visually-hidden" for="exploreSearch">Search businesses, services or localities</label><input id="exploreSearch" type="search" value="${esc(state.search)}" placeholder="Search businesses, services or localities" autocomplete="off"><button class="btn btn-primary" type="submit">Search</button></form><button class="btn btn-outline filter-toggle" id="filterToggle" type="button" aria-expanded="false">☷ Filters</button><div class="route-filters" id="routeFilters"><label class="filter"><span>Category</span><select id="exploreCategory">${categoryOptions(state.category)}</select></label><label class="filter"><span>Locality</span><select id="exploreArea">${areaOptions(state.area)}</select></label><label class="filter"><span>Sort</span><select id="exploreSort"><option value="relevance"${state.sort === "relevance" ? " selected" : ""}>Relevance</option><option value="az"${state.sort === "az" ? " selected" : ""}>Name A–Z</option><option value="za"${state.sort === "za" ? " selected" : ""}>Name Z–A</option></select></label><button class="btn btn-outline" id="exploreClear" type="button">Clear all</button></div></div><div class="route-results-head"><div><span class="kicker">LOCAL DIRECTORY</span><h2>Available businesses</h2></div><p id="exploreResultCount" aria-live="polite"></p></div><div class="business-grid" id="exploreBusinessGrid"></div><div class="route-note">Information is shown from existing public listings. Confirm details directly before visiting.</div></div></section>`;
  bindExploreRoute(state);
  renderExploreResults(state);
}
function bindExploreRoute(initialState) {
  const searchForm = $("#exploreSearchForm");
  const search = $("#exploreSearch");
  const category = $("#exploreCategory");
  const area = $("#exploreArea");
  const sort = $("#exploreSort");
  const state = { ...initialState };
  const sync = () => { state.search = search.value; state.category = category.value; state.area = area.value; state.sort = sort.value; updateExploreUrl(state); renderExploreResults(state); };
  search.addEventListener("input", sync); category.addEventListener("change", sync); area.addEventListener("change", sync); sort.addEventListener("change", sync);
  searchForm.addEventListener("submit", (event) => { event.preventDefault(); sync(); });
  $("#exploreClear").addEventListener("click", () => { updateExploreUrl({ search: "", category: "", area: "", sort: "relevance" }); renderExploreRoute(); });
  $("#filterToggle").addEventListener("click", (event) => { const open = $("#routeFilters").classList.toggle("open"); event.currentTarget.setAttribute("aria-expanded", String(open)); });
}
function renderCategoriesRoute() {
  routeView.innerHTML = `<section class="route-page categories-page"><div class="container"><div class="route-heading"><div><span class="kicker">BROWSE CATEGORIES</span><h1>Start with what <span class="text-gradient">you need.</span></h1><p>Choose a category to explore relevant local businesses across Nanded.</p></div><span class="route-location">${categories.length} service areas</span></div><div class="route-category-grid">${categories.map((category) => `<article class="route-category-card"><div class="category-emoji">${esc(category.icon)}</div><h2>${esc(category.name)}</h2><p>${esc(category.description)}</p><a class="btn btn-outline" href="#/explore?category=${encodeURIComponent(category.name)}">Browse category <span aria-hidden="true">→</span></a></article>`).join("")}</div></div></section>`;
}
function renderDetailRoute(id) {
  const business = getBusiness(id);
  if (!business) {
    routeView.innerHTML = `<section class="route-page"><div class="container detail-not-found"><div class="empty-icon">⌕</div><span class="kicker">BUSINESS NOT FOUND</span><h1>We couldn't find that listing.</h1><p>The business may have moved or the link may be incomplete.</p><a class="btn btn-primary" href="#/explore">Back to Explore</a></div></section>`;
    return;
  }
  rememberBusiness(businessId(business));
  const favorite = isFavorite(business);
  const phone = String(business.phone || "").replace(/[^\d+]/g, "");
  const related = businesses.filter((candidate) => candidate !== business && (candidate.category === business.category || candidate.area === business.area)).slice(0, 3);
  const rating = Number.isFinite(business.rating) && business.reviews ? `<div class="detail-rating">★ ${business.rating.toFixed(1)} <span>(${business.reviews.toLocaleString("en-IN")} public reviews shown in listing)</span></div>` : "";
  const call = phone ? `<a class="btn btn-primary" href="tel:${esc(phone)}">☎ Call business</a>` : "";
  const map = (business.mapQuery || business.address || business.area) ? `<a class="btn btn-outline" href="${mapUrl(business)}" target="_blank" rel="noopener noreferrer">⌖ Get directions</a>` : "";
  routeView.innerHTML = `<section class="route-page detail-page"><div class="container"><div class="detail-back"><a class="text-link" href="#/explore">← Back to Explore</a></div><div class="detail-layout"><article class="detail-main"><div class="detail-visual"><span>${esc(business.icon || "⌖")}</span><small>PUBLIC LISTING</small></div><div class="detail-content"><div class="detail-title-row"><div><span class="business-category">${esc(business.category)}</span><h1>${esc(business.name)}</h1></div><button class="favorite-button detail-favorite${favorite ? " is-favorite" : ""}" type="button" data-favorite-id="${esc(businessId(business))}" aria-label="${favorite ? "Remove" : "Add"} ${esc(business.name)} ${favorite ? "from" : "to"} favorites" aria-pressed="${String(favorite)}">${favorite ? "♥" : "♡"}<span>${favorite ? "Saved" : "Save"}</span></button></div>${rating}<p class="detail-description">${esc(business.description)}</p><div class="detail-actions">${call}${map}</div><div class="detail-facts"><div><span>LOCALITY</span><b>${esc(business.area)}, Nanded</b></div><div><span>ADDRESS</span><b>${esc(business.address)}</b></div>${phone ? `<div><span>PHONE</span><b>${esc(business.phone)}</b></div>` : ""}</div><div class="listing-note"><b>Listing information</b><p>This detail view uses information from an existing public listing. Availability, pricing, contact details, and services may change; confirm directly.</p></div></div></article><aside class="detail-side"><div class="side-card"><span class="kicker">SERVICES INFORMATION</span><h2>What this listing says</h2><p>${esc(business.description || "No additional service description is available for this listing.")}</p></div><div class="side-card"><span class="kicker">DISCOVER MORE</span><h2>Related businesses</h2><div class="related-list">${related.length ? related.map((item) => `<a href="#/business/${esc(businessId(item))}"><span>${esc(item.icon || "⌖")}</span><span><b>${esc(item.name)}</b><small>${esc(item.category)} · ${esc(item.area)}</small></span><strong>→</strong></a>`).join("") : `<p class="muted-copy">No related listings are available yet.</p>`}</div></div></aside></div></div></section>`;
}
function fieldError(input, message) {
  const error = input.closest(".form-field")?.querySelector(".field-error");
  input.classList.toggle("has-error", Boolean(message)); input.setAttribute("aria-invalid", String(Boolean(message)));
  if (error) error.textContent = message || "";
  return !message;
}
function validateEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function renderAboutRoute() {
  routeView.innerHTML = `<section class="route-page info-page about-page"><div class="container"><div class="route-hero"><span class="kicker">ABOUT NANDEDCONNECT</span><h1>Discover local. <span class="text-gradient">Connect better.</span></h1><p>NandedConnect is a frontend directory concept for finding useful local businesses, services, and places across Nanded, Maharashtra.</p><div class="route-hero-actions"><a class="btn btn-primary" href="#/explore">Explore Services <span aria-hidden="true">→</span></a><a class="btn btn-outline" href="#/list-business">List Your Business <span aria-hidden="true">↗</span></a></div></div><section class="content-section"><div class="section-copy"><span class="kicker">THE FOUNDATION</span><h2>A clearer way to find local help.</h2><p>Local discovery works best when information is easy to browse, simple to compare, and transparent about what is known.</p></div><div class="mission-grid"><article class="info-card"><span class="info-icon">⌖</span><h3>Our mission</h3><p>Make it easier for Nanded residents to discover local services while giving businesses a clear way to prepare their public listing information.</p></article><article class="info-card"><span class="info-icon">✦</span><h3>Our vision</h3><p>A useful, community-minded local discovery experience that can grow responsibly as verified platform services are added in the future.</p></article></div></section><section class="content-section alt"><div class="section-copy"><span class="kicker">WHY LOCAL MATTERS</span><h2>Useful for residents and business owners.</h2></div><div class="benefit-grid"><article class="info-card"><h3>For residents</h3><p>Search by service, category, locality, or business name, then review available public-listing details before making contact.</p></article><article class="info-card"><h3>For local businesses</h3><p>Prepare consistent business information, describe services clearly, and make it easier for nearby customers to discover your offering.</p></article><article class="info-card"><h3>For the community</h3><p>Support local discovery without presenting incomplete information as official, guaranteed, or independently verified.</p></article></div></section><section class="content-section"><div class="section-copy"><span class="kicker">HOW IT WORKS</span><h2>Three simple steps.</h2></div><div class="process-grid"><article class="process-step"><span class="process-number">01</span><h3>Search</h3><p>Start with a service, category, locality, address, or business name.</p></article><article class="process-step"><span class="process-number">02</span><h3>Review</h3><p>Open a listing to see the public information currently available in the directory.</p></article><article class="process-step"><span class="process-number">03</span><h3>Connect carefully</h3><p>Confirm details directly before visiting, calling, or relying on a listing.</p></article></div></section><section class="limitation-panel"><span class="kicker">IMPORTANT LIMITATIONS</span><h2>Transparent by design.</h2><p>NandedConnect is currently a static frontend demonstration. It has no backend, live database, account system, message delivery, approval workflow, or official verification process. Existing listings come from public directory information and may change. Inclusion is not an endorsement.</p><div class="route-hero-actions"><a class="btn btn-primary" href="#/explore">Explore Services</a><a class="btn btn-outline" href="#/list-business">Prepare a Business Listing</a></div></section></div></section>`;
}
function renderContactRoute() {
  routeView.innerHTML = `<section class="route-page info-page contact-page"><div class="container"><div class="route-hero"><span class="kicker">CONTACT NANDEDCONNECT</span><h1>Let’s make local discovery <span class="text-gradient">more useful.</span></h1><p>Share a question, suggestion, or local discovery idea. This form is a frontend demonstration and does not send messages to a server.</p></div><div class="route-form-layout"><form class="form-panel" id="contactRouteForm" novalidate><div class="form-panel-heading"><span class="kicker">SEND A MESSAGE</span><h2>How can we help?</h2><p>Fields marked * are required.</p></div><div class="form-grid"><div class="form-field"><label for="contactName">Name *</label><input id="contactName" name="name" maxlength="80" autocomplete="name"><small class="field-error" id="contactNameError"></small></div><div class="form-field"><label for="contactEmail">Email *</label><input id="contactEmail" name="email" type="email" maxlength="160" autocomplete="email"><small class="field-error" id="contactEmailError"></small></div><div class="form-field full"><label for="contactSubject">Subject *</label><input id="contactSubject" name="subject" maxlength="120"><small class="field-error" id="contactSubjectError"></small></div><div class="form-field full"><label for="contactMessage">Message *</label><textarea id="contactMessage" name="message" rows="6" maxlength="1000"></textarea><small class="field-error" id="contactMessageError"></small></div></div><button class="btn btn-primary" type="submit">Submit demo message <span aria-hidden="true">→</span></button><p class="demo-notice">Frontend demo only: this message is not sent or stored on a server.</p><p class="form-status" id="contactFormStatus" role="status" aria-live="polite"></p></form><aside class="contact-details"><div class="side-card"><span class="kicker">CONTACT DETAILS</span><h2>Not connected yet</h2><p>There is no public email address, phone number, or office address configured for this frontend demo.</p><div class="contact-detail"><b>Email</b><span>Not provided</span></div><div class="contact-detail"><b>Phone</b><span>Not provided</span></div><div class="contact-detail"><b>Location</b><span>Nanded, Maharashtra</span></div></div><div class="side-card"><span class="kicker">BEFORE YOU SEND</span><p>For a business listing, use the dedicated listing form so your information is saved as a local draft in this browser.</p><a class="text-link" href="#/list-business">List a business →</a></div></aside></div><section class="content-section faq-section"><div class="section-copy"><span class="kicker">FAQ</span><h2>Common questions.</h2></div><div class="faq-list"><details class="faq-item"><summary>Is NandedConnect a live marketplace?</summary><p>Not yet. This version is a frontend demonstration with local mock data and browser-only interactions.</p></details><details class="faq-item"><summary>Are business listings officially verified?</summary><p>No. Public listing information can change and should be confirmed directly. Inclusion does not mean endorsement.</p></details><details class="faq-item"><summary>Can I submit a business?</summary><p>Yes, you can prepare and save a listing draft locally. It is not sent for approval in this version.</p></details></div></section></div></section>`;
  const contactForm = $("#contactRouteForm");
  const status = $("#contactFormStatus");
  contactForm.addEventListener("submit", (event) => { event.preventDefault(); status.className = "form-status"; status.textContent = ""; const fields = [contactForm.querySelector("[name=name]"), contactForm.querySelector("[name=email]"), contactForm.querySelector("[name=subject]"), contactForm.querySelector("[name=message]")]; const messages = [fields[0].value.trim() ? "" : "Please enter your name.", fields[1].value.trim() && validateEmail(fields[1].value.trim()) ? "" : "Please enter a valid email address.", fields[2].value.trim() ? "" : "Please enter a subject.", fields[3].value.trim() ? "" : "Please enter a message."]; fields.forEach((input, index) => fieldError(input, messages[index])); const firstError = fields.find((input, index) => messages[index]); if (firstError) { firstError.focus(); status.className = "form-status error"; status.textContent = "Please correct the highlighted fields."; return; } contactForm.reset(); status.className = "form-status success"; status.textContent = "Thanks — your demo message was prepared locally, but it was not sent to a server."; });
}
const LISTING_DRAFT_KEY = "nandedconnect_listing_draft_v1";
function renderListBusinessRoute() {
  const draft = (() => { try { return JSON.parse(localStorage.getItem(LISTING_DRAFT_KEY) || "null") || {}; } catch (_) { return {}; } })();
  const categoryMarkup = `<option value="">Select a category</option>${categories.map((item) => `<option value="${esc(item.name)}"${draft.businessCategory === item.name ? " selected" : ""}>${esc(item.name)}</option>`).join("")}`;
  const input = (id, name, label, type = "text", max = 100, extra = "") => `<div class="form-field"><label for="${id}">${label} *</label><input id="${id}" name="${name}" type="${type}" maxlength="${max}" value="${esc(draft[name] || "")}" ${extra}><small class="field-error"></small></div>`;
  routeView.innerHTML = `<section class="route-page info-page listing-page"><div class="container"><div class="route-hero"><span class="kicker">FOR LOCAL BUSINESS OWNERS</span><h1>Grow your local business with <span class="text-gradient">NandedConnect.</span></h1><p>Prepare clear, useful business information for future local discovery. Your details remain in this browser in the current frontend-only demo.</p><div class="route-hero-actions"><a class="btn btn-primary" href="#listingRouteForm">Start a draft</a><a class="btn btn-outline" href="#/explore">Explore the directory</a></div></div><section class="content-section"><div class="section-copy"><span class="kicker">WHY LIST</span><h2>Make your local presence easier to understand.</h2></div><div class="benefit-grid"><article class="info-card"><span class="info-icon">⌕</span><h3>Be discoverable</h3><p>Organize your business name, category, locality, and services in one clear place.</p></article><article class="info-card"><span class="info-icon">✦</span><h3>Share context</h3><p>Give potential customers useful description and address information to review.</p></article><article class="info-card"><span class="info-icon">↗</span><h3>Prepare ahead</h3><p>Save a complete draft today for a future listing workflow when platform services are connected.</p></article></div></section><section class="content-section alt"><div class="section-copy"><span class="kicker">THE PROCESS</span><h2>Simple, transparent, local.</h2></div><div class="process-grid"><article class="process-step"><span class="process-number">01</span><h3>Enter details</h3><p>Tell us what your business offers and where customers can find you.</p></article><article class="process-step"><span class="process-number">02</span><h3>Save locally</h3><p>Incomplete drafts are saved in this browser so you can return to them.</p></article><article class="process-step"><span class="process-number">03</span><h3>Future connection</h3><p>A future backend could support review, approval, and publishing workflows.</p></article></div></section><div class="route-form-layout"><form class="form-panel" id="listingRouteForm" novalidate><div class="form-panel-heading"><span class="kicker">BUSINESS DETAILS</span><h2>Prepare your listing</h2><p>Fields marked * are required. Character limits keep information readable.</p></div><div class="form-grid">${input("listingBusinessName", "businessName", "Business name", "text", 100)}${input("listingOwnerName", "ownerName", "Owner name", "text", 80)}<div class="form-field"><label for="listingCategory">Business category *</label><select id="listingCategory" name="businessCategory">${categoryMarkup}</select><small class="field-error"></small></div>${input("listingPhone", "businessPhone", "Phone number", "tel", 18, "inputmode=\"tel\"")}${input("listingEmail", "businessEmail", "Email", "email", 160)}${input("listingLocality", "businessLocality", "Locality", "text", 100)}<div class="form-field full">${input("listingAddress", "businessAddress", "Full address", "text", 220).replace('<div class="form-field">','').replace('</div>','')}</div><div class="form-field full"><label for="listingDescription">Business description *</label><textarea id="listingDescription" name="businessDescription" maxlength="600" rows="5">${esc(draft.businessDescription || "")}</textarea><small class="field-error"></small></div><div class="form-field full"><label for="listingServices">Services offered *</label><textarea id="listingServices" name="servicesOffered" maxlength="600" rows="5">${esc(draft.servicesOffered || "")}</textarea><small class="field-error"></small></div></div><div class="form-actions"><button class="btn btn-primary" type="submit">Save draft locally <span aria-hidden="true">→</span></button><button class="btn btn-outline" id="clearListingDraft" type="button">Clear saved draft</button></div><p class="demo-notice">This is a frontend demo. Business submissions are not sent for approval yet.</p><p class="form-status" id="listingFormStatus" role="status" aria-live="polite"></p><p class="draft-meta" id="listingDraftMeta">${Object.keys(draft).length ? "A saved draft was restored from this browser." : "Drafts are saved only in this browser."}</p></form><aside class="contact-details"><div class="side-card"><span class="kicker">LISTING NOTE</span><h2>No approval workflow yet</h2><p>Saving this form does not publish a listing, contact a business owner, or send information anywhere.</p></div></aside></div><section class="content-section faq-section"><div class="section-copy"><span class="kicker">FAQ</span><h2>Before you list.</h2></div><div class="faq-list"><details class="faq-item"><summary>Will my business appear publicly?</summary><p>No. This form only saves a frontend draft in your browser.</p></details><details class="faq-item"><summary>Can I edit an incomplete draft?</summary><p>Yes. Keep typing and the latest values are saved automatically. Use Clear saved draft to remove them.</p></details><details class="faq-item"><summary>What happens after the demo?</summary><p>A future backend could add review, verification, and publishing. Those services are not implemented here.</p></details></div></section></div></section>`;
  bindListingForm();
}
function bindListingForm() {
  const listingForm = $("#listingRouteForm"); if (!listingForm) return;
  const status = $("#listingFormStatus"); const meta = $("#listingDraftMeta");
  const save = () => { const values = Object.fromEntries(new FormData(listingForm).entries()); try { localStorage.setItem(LISTING_DRAFT_KEY, JSON.stringify(values)); meta.textContent = "Draft saved locally in this browser."; } catch (_) { meta.textContent = "Browser storage is unavailable."; } };
  listingForm.addEventListener("input", save); listingForm.addEventListener("change", save);
  $("#clearListingDraft").addEventListener("click", () => { try { localStorage.removeItem(LISTING_DRAFT_KEY); } catch (_) {} listingForm.reset(); listingForm.querySelectorAll("input, select, textarea").forEach((field) => { field.value = ""; }); listingForm.querySelectorAll(".field-error").forEach((error) => { error.textContent = ""; }); listingForm.querySelectorAll(".has-error").forEach((field) => fieldError(field, "")); status.className = "form-status success"; status.textContent = "Saved draft cleared from this browser."; meta.textContent = "Drafts are saved only in this browser."; });
  listingForm.addEventListener("submit", (event) => { event.preventDefault(); const required = ["businessName", "ownerName", "businessCategory", "businessPhone", "businessEmail", "businessLocality", "businessAddress", "businessDescription", "servicesOffered"].map((name) => listingForm.elements[name]); const messages = required.map((field) => { const value = field.value.trim(); if (!value) return "This field is required."; if (field.name === "businessEmail" && !validateEmail(value)) return "Enter a valid email address."; if (field.name === "businessPhone" && !/^[+]?\d[\d\s().-]{6,17}$/.test(value)) return "Enter a valid phone number."; return ""; }); required.forEach((field, index) => fieldError(field, messages[index])); const firstError = required.find((field, index) => messages[index]); status.className = "form-status"; if (firstError) { firstError.focus(); status.className = "form-status error"; status.textContent = "Please correct the highlighted fields."; return; } save(); status.className = "form-status success"; status.textContent = "Your listing draft was saved locally. It was not submitted for approval."; });
}
function authFieldError(input, message) { const error = input.closest(".form-field")?.querySelector(".field-error"); input.classList.toggle("has-error", Boolean(message)); input.setAttribute("aria-invalid", String(Boolean(message))); if (error) error.textContent = message || ""; }
function authShell(title, intro, formMarkup, footerMarkup, kind) { routeView.innerHTML = `<section class="route-page auth-page"><div class="auth-shell"><div class="auth-brand"><span class="brand-mark"><span class="brand-pin">N</span><span class="brand-dot"></span></span><span><b>NandedConnect</b><small>Discover Local. Connect Better.</small></span></div><div class="auth-panel"><span class="kicker">${kind}</span><h1>${title}</h1><p class="auth-intro">${intro}</p>${formMarkup}<p class="auth-footer">${footerMarkup}</p></div><p class="demo-notice auth-notice">Authentication is not implemented yet. This screen is a frontend demo and does not create or access real accounts.</p></div></section>`; }
function renderLoginRoute() {
  authShell("Welcome back.", "Use the demo form to explore the sign-in experience. No credentials are checked or stored.", `<form class="form-panel auth-form" id="loginForm" novalidate><div class="form-field"><label for="loginEmail">Email *</label><input id="loginEmail" name="email" type="email" autocomplete="email" maxlength="160"><small class="field-error"></small></div><div class="form-field"><label for="loginPassword">Password *</label><div class="password-wrap"><input id="loginPassword" name="password" type="password" autocomplete="current-password" maxlength="80"><button class="password-toggle" type="button" data-password-target="loginPassword" aria-label="Show password">Show</button></div><small class="field-error"></small></div><div class="auth-options"><label class="check-label"><input type="checkbox" name="remember"> <span>Remember me</span></label><button class="text-button" type="button" id="forgotPassword">Forgot password?</button></div><button class="btn btn-primary" type="submit">Continue with demo login <span aria-hidden="true">→</span></button><p class="form-status" id="loginStatus" role="status" aria-live="polite"></p></form>`, `New to NandedConnect? <a href="#/signup">Create a demo account</a>`, "DEMO SIGN IN");
  const form = $("#loginForm"); const status = $("#loginStatus");
  $("#forgotPassword").addEventListener("click", () => { status.className = "form-status error"; status.textContent = "Password recovery is not available in this frontend demo."; });
  form.addEventListener("submit", (event) => { event.preventDefault(); const email = form.elements.email; const password = form.elements.password; const emailError = !email.value.trim() ? "Email is required." : !validateEmail(email.value.trim()) ? "Enter a valid email address." : ""; const passwordError = password.value.trim().length < 6 ? "Enter at least 6 characters for the demo password." : ""; authFieldError(email, emailError); authFieldError(password, passwordError); if (emailError || passwordError) { status.className = "form-status error"; status.textContent = "Please correct the highlighted fields."; return; } status.className = "form-status success"; status.textContent = "Demo login only — no account was authenticated."; });
  bindPasswordToggles();
}
function renderSignupRoute() {
  authShell("Create your demo profile.", "Set up the UI flow for a future account. This form validates locally and never creates a real account.", `<form class="form-panel auth-form" id="signupForm" novalidate><div class="form-field"><label for="signupName">Full name *</label><input id="signupName" name="fullName" maxlength="80" autocomplete="name"><small class="field-error"></small></div><div class="form-field"><label for="signupEmail">Email *</label><input id="signupEmail" name="email" type="email" maxlength="160" autocomplete="email"><small class="field-error"></small></div><div class="form-field"><label for="signupPhone">Phone number <span>(optional)</span></label><input id="signupPhone" name="phone" type="tel" inputmode="tel" maxlength="18" autocomplete="tel"><small class="field-error"></small></div><div class="form-field"><label for="signupPassword">Password *</label><div class="password-wrap"><input id="signupPassword" name="password" type="password" maxlength="80" autocomplete="new-password"><button class="password-toggle" type="button" data-password-target="signupPassword" aria-label="Show password">Show</button></div><small class="field-error"></small></div><div class="form-field"><label for="signupConfirm">Confirm password *</label><div class="password-wrap"><input id="signupConfirm" name="confirmPassword" type="password" maxlength="80" autocomplete="new-password"><button class="password-toggle" type="button" data-password-target="signupConfirm" aria-label="Show password">Show</button></div><small class="field-error"></small></div><label class="check-label terms-check"><input id="signupTerms" name="terms" type="checkbox"> <span>I understand this is a frontend demo and accept the demo terms. *</span></label><p class="field-error terms-error"></p><button class="btn btn-primary" type="submit">Create demo profile <span aria-hidden="true">→</span></button><p class="form-status" id="signupStatus" role="status" aria-live="polite"></p></form>`, `Already have a demo profile? <a href="#/login">Return to login</a>`, "DEMO SIGN UP");
  const form = $("#signupForm"); const status = $("#signupStatus"); const terms = $("#signupTerms");
  form.addEventListener("submit", (event) => { event.preventDefault(); const fields = [form.elements.fullName, form.elements.email, form.elements.phone, form.elements.password, form.elements.confirmPassword]; const messages = [fields[0].value.trim() ? "" : "Full name is required.", fields[1].value.trim() && validateEmail(fields[1].value.trim()) ? "" : "Enter a valid email address.", fields[2].value.trim() && !/^[+]?\d[\d\s().-]{6,17}$/.test(fields[2].value.trim()) ? "Enter a valid phone number." : "", fields[3].value.length >= 8 ? "" : "Use at least 8 characters.", fields[4].value === fields[3].value && fields[4].value ? "" : "Passwords must match."]; fields.forEach((field, index) => authFieldError(field, messages[index])); const termsError = $(".terms-error"); termsError.textContent = terms.checked ? "" : "Please accept the demo terms to continue."; const firstError = fields.find((field, index) => messages[index]); if (firstError || !terms.checked) { (firstError || terms).focus(); status.className = "form-status error"; status.textContent = "Please correct the highlighted fields."; return; } status.className = "form-status success"; status.textContent = "Demo profile form complete — no account was created."; }); bindPasswordToggles();
}
function bindPasswordToggles() { document.querySelectorAll(".password-toggle").forEach((button) => button.addEventListener("click", () => { const input = document.getElementById(button.dataset.passwordTarget); const visible = input.type === "text"; input.type = visible ? "password" : "text"; button.textContent = visible ? "Show" : "Hide"; button.setAttribute("aria-label", visible ? "Show password" : "Hide password"); })); }
function profileData() { return { fullName: "Demo User", email: "Demo profile · not a real account", phone: "", ...readJson(PROFILE_KEY, {}) }; }
function renderDashboardNav(active, business = false) { const items = business ? [["overview","Overview"],["profile","Profile"],["business-listing","Business Listing"],["services","Services"],["inquiries","Inquiries"],["settings","Settings"]] : [["overview","Overview"],["profile","Profile"],["saved","Saved Businesses"],["recent","Recently Viewed"],["settings","Settings"]]; return `<nav class="dashboard-nav" aria-label="Dashboard navigation">${items.map(([id, label]) => `<a class="${active === id ? "active" : ""}" href="#${business ? "/business-dashboard" : "/dashboard"}?section=${id}">${label}</a>`).join("")}<a class="dashboard-exit" href="#/explore">Exit dashboard</a></nav>`; }
function dashboardSection(query, key) { return query.get("section") || key; }
function renderUserDashboard() {
  const profile = profileData(); const section = dashboardSection(new URLSearchParams(window.location.hash.split("?")[1] || ""), "overview"); const favorites = readFavorites().map(getBusiness).filter(Boolean); const recent = readRecent().map(getBusiness).filter(Boolean); const isSettings = section === "settings";
  const content = section === "saved" ? `<div class="dashboard-heading"><span class="kicker">SAVED BUSINESSES</span><h2>Places you want to revisit.</h2><p>Your favorites are stored only in this browser.</p></div><div class="business-grid dashboard-grid">${favorites.length ? favorites.map(buildCard).join("") : emptyState("You have not saved any businesses yet. Use the heart on a business card to save one here.")}</div>` : section === "recent" ? `<div class="dashboard-heading"><span class="kicker">RECENTLY VIEWED</span><h2>Your latest discoveries.</h2><p>Recent business IDs are stored locally for this demo.</p></div><div class="business-grid dashboard-grid">${recent.length ? recent.map(buildCard).join("") : emptyState("Recently viewed businesses will appear here after you open a listing.")}</div>` : isSettings ? `<div class="dashboard-heading"><span class="kicker">SETTINGS</span><h2>Personalize your demo experience.</h2></div><form class="form-panel preference-panel" id="dashboardSettings"><label class="check-label"><input type="checkbox" name="compact"${readJson(DASHBOARD_PREFS_KEY, {}).compact ? " checked" : ""}> <span>Use compact dashboard cards</span></label><label class="check-label"><input type="checkbox" name="notifications"${readJson(DASHBOARD_PREFS_KEY, {}).notifications ? " checked" : ""}> <span>Show demo notification prompts</span></label><button class="btn btn-primary" type="submit">Save preferences</button><p class="form-status" id="settingsStatus" role="status"></p></form>` : section === "profile" ? `<div class="dashboard-heading"><span class="kicker">PROFILE</span><h2>Keep your demo profile current.</h2></div><form class="form-panel preference-panel" id="profileForm"><div class="form-field"><label for="profileName">Full name</label><input id="profileName" name="fullName" maxlength="80" value="${esc(profile.fullName)}"><small class="field-error"></small></div><div class="form-field"><label for="profileEmail">Email</label><input id="profileEmail" name="email" type="email" maxlength="160" value="${esc(profile.email)}"><small class="field-error"></small></div><div class="form-field"><label for="profilePhone">Phone</label><input id="profilePhone" name="phone" maxlength="18" value="${esc(profile.phone)}"><small class="field-error"></small></div><button class="btn btn-primary" type="submit">Save demo profile</button><p class="form-status" id="profileStatus" role="status"></p></form>` : `<div class="dashboard-heading"><span class="kicker">USER DASHBOARD</span><h2>Welcome, ${esc(profile.fullName)}.</h2><p>This is a sample account space. No real account or achievements are connected.</p></div><div class="dashboard-cards"><article class="dashboard-card"><span class="kicker">PROFILE OVERVIEW</span><h3>${esc(profile.fullName)}</h3><p>${esc(profile.email)}</p><a class="text-link" href="#/dashboard?section=profile">Edit profile →</a></article><article class="dashboard-card"><span class="kicker">SAVED BUSINESSES</span><strong>${favorites.length}</strong><p>Favorites from this browser</p><a class="text-link" href="#/dashboard?section=saved">View saved businesses →</a></article><article class="dashboard-card"><span class="kicker">RECENTLY VIEWED</span><strong>${recent.length}</strong><p>Local browsing history</p><a class="text-link" href="#/dashboard?section=recent">View recent listings →</a></article></div><div class="dashboard-callout"><h3>Ready to discover something nearby?</h3><p>Search the existing Nanded directory and save listings for later.</p><a class="btn btn-primary" href="#/explore">Explore Services</a></div>`;
  routeView.innerHTML = `<section class="route-page dashboard-page"><div class="container"><div class="dashboard-layout">${renderDashboardNav(section)}<main class="dashboard-main">${content}</main></div></div></section>`; bindDashboardForms();
}
function bindDashboardForms() { const profileForm = $("#profileForm"); if (profileForm) profileForm.addEventListener("submit", (event) => { event.preventDefault(); const name = profileForm.elements.fullName; const email = profileForm.elements.email; const errors = [name.value.trim() ? "" : "Name is required.", email.value.trim() && validateEmail(email.value.trim()) ? "" : "Enter a valid email."]; authFieldError(name, errors[0]); authFieldError(email, errors[1]); if (errors.some(Boolean)) return; writeJson(PROFILE_KEY, Object.fromEntries(new FormData(profileForm).entries())); $("#profileStatus").className = "form-status success"; $("#profileStatus").textContent = "Demo profile preference saved locally."; }); const settings = $("#dashboardSettings"); if (settings) settings.addEventListener("submit", (event) => { event.preventDefault(); writeJson(DASHBOARD_PREFS_KEY, { compact: settings.elements.compact.checked, notifications: settings.elements.notifications.checked }); $("#settingsStatus").className = "form-status success"; $("#settingsStatus").textContent = "Dashboard preferences saved locally."; }); }
function renderBusinessDashboard() { const section = dashboardSection(new URLSearchParams(window.location.hash.split("?")[1] || ""), "overview"); const listingDraft = readJson("nandedconnect_listing_draft_v1", {}); const content = section === "profile" || section === "business-listing" ? `<div class="dashboard-heading"><span class="kicker">BUSINESS PROFILE</span><h2>${listingDraft.businessName ? esc(listingDraft.businessName) : "Your business profile"}</h2><p>${listingDraft.businessName ? "Draft information from this browser is shown below." : "Create a frontend draft to preview your future business listing."}</p></div><form class="form-panel preference-panel" id="businessProfilePreview"><div class="form-field"><label for="bdName">Business name</label><input id="bdName" value="${esc(listingDraft.businessName || "")}" placeholder="No demo listing saved"><small class="field-error"></small></div><div class="form-field"><label for="bdCategory">Category</label><input id="bdCategory" value="${esc(listingDraft.businessCategory || "")}" placeholder="Not available"></div><div class="form-field full"><label for="bdDescription">Description</label><textarea id="bdDescription" rows="4" placeholder="No description available">${esc(listingDraft.businessDescription || "")}</textarea></div><p class="demo-notice">Sample preview only. Editing here does not publish or submit a listing.</p></form>` : section === "services" ? `<div class="dashboard-heading"><span class="kicker">SERVICES</span><h2>Manage what you offer.</h2></div><div class="empty-state dashboard-empty"><div class="empty-icon">✦</div><h3>No service catalogue connected</h3><p>Service management will be available after a business backend is added.</p><a class="btn btn-outline" href="#/list-business">Prepare a listing draft</a></div>` : section === "inquiries" ? `<div class="dashboard-heading"><span class="kicker">INQUIRIES</span><h2>Customer conversations.</h2></div><div class="empty-state dashboard-empty"><div class="empty-icon">⌁</div><h3>No inquiries available</h3><p>This demo does not collect or store customer inquiries.</p></div>` : section === "settings" ? `<div class="dashboard-heading"><span class="kicker">SETTINGS</span><h2>Business dashboard preferences.</h2></div><form class="form-panel preference-panel" id="businessSettings"><label class="check-label"><input type="checkbox" name="compact"> <span>Use compact business cards</span></label><button class="btn btn-primary" type="submit">Save preferences</button><p class="form-status" id="businessSettingsStatus" role="status"></p></form>` : `<div class="dashboard-heading"><span class="kicker">BUSINESS DASHBOARD</span><h2>Manage your local presence.</h2><p>Sample owner workspace — no real business account, analytics, reviews, or inquiries are connected.</p></div><div class="dashboard-cards"><article class="dashboard-card"><span class="kicker">LISTING STATUS</span><strong>${listingDraft.businessName ? "Draft saved" : "Not started"}</strong><p>${listingDraft.businessName ? "Stored locally only" : "No listing draft available"}</p><a class="text-link" href="#/business-dashboard?section=business-listing">View profile →</a></article><article class="dashboard-card"><span class="kicker">REVIEWS</span><strong>—</strong><p>No review data available</p></article><article class="dashboard-card"><span class="kicker">ANALYTICS</span><strong>—</strong><p>Demo analytics are not populated</p></article></div><div class="dashboard-callout"><h3>Start with a business draft.</h3><p>Prepare your information before a future approval and publishing workflow exists.</p><a class="btn btn-primary" href="#/list-business">Create a listing draft</a></div>`; routeView.innerHTML = `<section class="route-page dashboard-page"><div class="container"><div class="dashboard-layout">${renderDashboardNav(section, true)}<main class="dashboard-main">${content}</main></div></div></section>`; const settings = $("#businessSettings"); if (settings) settings.addEventListener("submit", (event) => { event.preventDefault(); writeJson(DASHBOARD_PREFS_KEY, { businessCompact: settings.elements.compact.checked }); $("#businessSettingsStatus").className = "form-status success"; $("#businessSettingsStatus").textContent = "Business dashboard preference saved locally."; }); }
function renderRoute() {
  const route = getRoute();
  const routed = route.name !== "home";
  setRouteVisibility(routed); updateNav(route.name); window.scrollTo({ top: 0, behavior: "auto" });
  if (!routed) return;
  if (route.name === "explore") renderExploreRoute();
  if (route.name === "categories") renderCategoriesRoute();
  if (route.name === "business") renderDetailRoute(route.id);
  if (route.name === "about") renderAboutRoute();
  if (route.name === "contact") renderContactRoute();
  if (route.name === "list-business") renderListBusinessRoute();
  if (route.name === "login") renderLoginRoute();
  if (route.name === "signup") renderSignupRoute();
  if (route.name === "dashboard") renderUserDashboard();
  if (route.name === "business-dashboard") renderBusinessDashboard();
}

function applyTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeToggle.innerHTML = `<span aria-hidden="true">${dark ? "☀" : "☾"}</span>`;
  themeToggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode"); themeToggle.title = dark ? "Switch to light mode" : "Switch to dark mode";
  const meta = $('meta[name="theme-color"]'); if (meta) meta.content = dark ? "#101914" : "#f4f5ef";
}
function preferredTheme() { try { const saved = localStorage.getItem(THEME_KEY); if (saved === "light" || saved === "dark") return saved; } catch (_) {} return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }

heroSearchForm.addEventListener("submit", (event) => { event.preventDefault(); window.location.hash = `#/explore${heroSearch.value.trim() ? `?search=${encodeURIComponent(heroSearch.value.trim())}` : ""}`; });
heroSearch.addEventListener("input", () => { if (directorySearch) directorySearch.value = heroSearch.value; });
directorySearch.addEventListener("input", () => { heroSearch.value = directorySearch.value; renderHomeDirectory(); });
categoryFilter.addEventListener("change", () => { syncHomeCategory(); renderHomeDirectory(); });
areaFilter.addEventListener("change", renderHomeDirectory);
$("#resetFilters").addEventListener("click", resetHomeFilters);
$("#clearCategory").addEventListener("click", resetHomeFilters);
categoryGrid.querySelectorAll(".category").forEach((button) => { button.setAttribute("aria-pressed", "false"); button.addEventListener("click", () => setHomeCategory(button.dataset.category)); });
themeToggle.addEventListener("click", () => { const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; applyTheme(next); try { localStorage.setItem(THEME_KEY, next); } catch (_) {} });
mobileMenu.addEventListener("click", () => { const open = navLinks.classList.toggle("open"); mobileMenu.setAttribute("aria-expanded", String(open)); mobileMenu.setAttribute("aria-label", open ? "Close menu" : "Open menu"); });
navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => { navLinks.classList.remove("open"); mobileMenu.setAttribute("aria-expanded", "false"); mobileMenu.setAttribute("aria-label", "Open menu"); }));
document.addEventListener("click", (event) => { const favorite = event.target.closest("[data-favorite-id]"); if (favorite) { event.preventDefault(); toggleFavorite(favorite.dataset.favoriteId); } const reset = event.target.closest("[data-route-reset]"); if (reset && getRoute().name === "explore") { event.preventDefault(); updateExploreUrl({ search: "", category: "", area: "", sort: "relevance" }); renderExploreRoute(); } });

function readDrafts() { try { const value = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch (_) { return []; } }
form.addEventListener("submit", (event) => { event.preventDefault(); formMessage.textContent = ""; if (!form.reportValidity()) return; const data = new FormData(form); const draft = { name: String(data.get("name") || "").trim(), contact: String(data.get("contact") || "").trim(), category: String(data.get("category") || "").trim(), area: String(data.get("area") || "").trim(), phone: String(data.get("phone") || "").trim(), description: String(data.get("description") || "").trim(), whatsapp: String(data.get("whatsapp") || "").trim(), status: "draft-not-submitted", savedAt: new Date().toISOString() }; if (!draft.name || !draft.contact || !draft.category || !draft.area || !draft.phone || !draft.description) { formMessage.textContent = "Please complete all required fields."; return; } try { const drafts = readDrafts(); drafts.push(draft); localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(drafts)); form.reset(); formMessage.textContent = "Draft saved in this browser only. It has not been sent to NandedConnect or published."; } catch (_) { formMessage.textContent = "Browser storage is unavailable. Please try again or copy your details before leaving."; } });

$("#year").textContent = new Date().getFullYear();
updateAreas(); syncHomeCategory(); applyTheme(preferredTheme()); renderHomeDirectory();
window.addEventListener("hashchange", renderRoute);
renderRoute();
