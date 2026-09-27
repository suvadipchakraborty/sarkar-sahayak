/**
 * Sarkar Sahayak — app.js
 * Wires up the tab bar, the step-by-step eligibility wizard, and the
 * live results list. Vanilla JS, no framework/build step by design so
 * the whole app stays a handful of static files.
 */

(function () {
  "use strict";

  const { STATES, DEMOGRAPHIC_GROUPS, fetchSchemes, filterSchemes, uniqueCategories } = window.SarkarData;

  const STORAGE_KEY = "sarkarSahayak.answers.v1";
  const FEEDBACK_EMAIL = "suvadipchakraborty@gmail.com";
  const APP_URL = "https://sarkar-sahayak.suvadipchakraborty.workers.dev/";

  const state = {
    schemes: [],
    loading: true,
    error: null,
    step: 0, // 0 = state, 1 = category, 2 = demographics
    wizardDone: false,
    answers: { state: "any", categories: [], demographics: [], query: "" },
    openCardId: null,
  };

  restoreAnswers();

  /* ---------------------------------------------------------------- */
  /* Tabs                                                              */
  /* ---------------------------------------------------------------- */

  function initTabs() {
    const buttons = document.querySelectorAll(".tab-bar__btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        buttons.forEach((b) => b.classList.toggle("is-active", b === btn));
        document.querySelectorAll(".tab-panel").forEach((panel) => {
          panel.classList.toggle("is-active", panel.id === `tab-${tab}`);
        });
        window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /* Persistence                                                       */
  /* ---------------------------------------------------------------- */

  function restoreAnswers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        state.answers = Object.assign(state.answers, saved.answers || {});
        state.wizardDone = !!saved.wizardDone;
      }
    } catch (e) { /* ignore corrupt storage */ }
  }

  function persistAnswers() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: state.answers, wizardDone: state.wizardDone }));
    } catch (e) { /* storage may be unavailable (private mode) */ }
  }

  /* ---------------------------------------------------------------- */
  /* Data loading                                                       */
  /* ---------------------------------------------------------------- */

  async function loadData() {
    try {
      state.schemes = await fetchSchemes();
      state.loading = false;
    } catch (err) {
      state.loading = false;
      state.error = "We couldn't load the latest scheme list. Check your connection and try again.";
    }
    renderCategoryStep();
    renderResults();
  }

  /* ---------------------------------------------------------------- */
  /* Wizard: step definitions                                          */
  /* ---------------------------------------------------------------- */

  const track = document.getElementById("wizardTrack");
  const dotsEl = document.getElementById("wizardDots");
  const wizardEl = document.getElementById("wizard");
  const summaryEl = document.getElementById("filterSummary");

  const TOTAL_STEPS = 3;

  function updateTrackPosition() {
    // The track is 3x the viewport width (three flex children each at
    // 100% basis), so one "page" is 100/TOTAL_STEPS % of the track's
    // own width — translateX% is relative to the element itself.
    track.style.transform = `translateX(-${state.step * (100 / TOTAL_STEPS)}%)`;
    const dots = dotsEl.querySelectorAll(".wizard__dot");
    dots.forEach((dot, i) => {
      dot.classList.toggle("is-active", i === state.step);
      dot.classList.toggle("is-done", i < state.step);
    });
  }

  function goToStep(i) {
    state.step = Math.max(0, Math.min(2, i));
    updateTrackPosition();
  }

  function renderStateStep() {
    const select = document.getElementById("stateSelect");
    select.innerHTML =
      `<option value="any">All India / not sure</option>` +
      STATES.map((s) => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join("");
    select.value = state.answers.state || "any";
    select.addEventListener("change", () => {
      state.answers.state = select.value;
      renderResults();
      persistAnswers();
    });
  }

  function renderCategoryStep() {
    const wrap = document.getElementById("categoryChips");
    if (state.loading) {
      wrap.innerHTML = `<div class="skeleton-line w-60"></div><div class="skeleton-line w-40"></div>`;
      return;
    }
    const cats = uniqueCategories(state.schemes);
    wrap.innerHTML = cats
      .map((c) => {
        const selected = state.answers.categories.includes(c);
        return `<button type="button" class="chip${selected ? " is-selected" : ""}" data-cat="${escapeAttr(c)}">
          <span>${escapeHtml(c)}</span>
          <svg class="chip__check" width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>`;
      })
      .join("");
    wrap.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const cat = chip.dataset.cat;
        const idx = state.answers.categories.indexOf(cat);
        if (idx === -1) state.answers.categories.push(cat);
        else state.answers.categories.splice(idx, 1);
        chip.classList.toggle("is-selected");
        renderResults();
        persistAnswers();
      });
    });
  }

  function renderDemographicsStep() {
    const wrap = document.getElementById("demoList");
    wrap.innerHTML = DEMOGRAPHIC_GROUPS.map((g) => {
      const selected = state.answers.demographics.includes(g.id);
      return `<div class="check-row${selected ? " is-selected" : ""}" data-demo="${g.id}">
        <span class="check-row__emoji">${g.emoji}</span>
        <span class="check-row__label">${escapeHtml(g.label)}</span>
        <span class="check-row__box">
          <svg viewBox="0 0 20 20" fill="none"><path d="M4 10.5l4 4 8-9" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </div>`;
    }).join("");
    wrap.querySelectorAll(".check-row").forEach((row) => {
      row.addEventListener("click", () => {
        const id = row.dataset.demo;
        const idx = state.answers.demographics.indexOf(id);
        if (idx === -1) state.answers.demographics.push(id);
        else state.answers.demographics.splice(idx, 1);
        row.classList.toggle("is-selected");
        renderResults();
        persistAnswers();
      });
    });
  }

  function initWizardNav() {
    document.getElementById("step1Next").addEventListener("click", () => goToStep(1));
    document.getElementById("step2Back").addEventListener("click", () => goToStep(0));
    document.getElementById("step2Next").addEventListener("click", () => goToStep(2));
    document.getElementById("step3Back").addEventListener("click", () => goToStep(1));
    document.getElementById("step3Done").addEventListener("click", finishWizard);
    document.getElementById("browseAllLink").addEventListener("click", (e) => {
      e.preventDefault();
      finishWizard();
    });
    document.getElementById("editFiltersBtn").addEventListener("click", () => {
      state.wizardDone = false;
      goToStep(0);
      updateWizardVisibility();
      persistAnswers();
    });
  }

  function finishWizard() {
    state.wizardDone = true;
    updateWizardVisibility();
    renderResults();
    persistAnswers();
    document.getElementById("resultsAnchor").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateWizardVisibility() {
    wizardEl.style.display = state.wizardDone ? "none" : "block";
    summaryEl.style.display = state.wizardDone ? "flex" : "none";
    renderSummaryPills();
  }

  function renderSummaryPills() {
    if (!state.wizardDone) return;
    const pills = [];
    if (state.answers.state !== "any") pills.push(state.answers.state);
    state.answers.categories.forEach((c) => pills.push(c));
    state.answers.demographics.forEach((id) => {
      const g = DEMOGRAPHIC_GROUPS.find((d) => d.id === id);
      if (g) pills.push(g.label);
    });
    const pillsEl = document.getElementById("summaryPills");
    pillsEl.textContent = pills.length ? pills.join(" · ") : "Showing every scheme";
  }

  /* ---------------------------------------------------------------- */
  /* Results                                                            */
  /* ---------------------------------------------------------------- */

  const resultsListEl = document.getElementById("resultsList");
  const resultsCountEl = document.getElementById("resultsCount");
  const searchInput = document.getElementById("searchInput");

  function initSearch() {
    let t;
    searchInput.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.answers.query = searchInput.value;
        renderResults();
      }, 180);
    });
  }

  function renderResults() {
    if (state.loading) {
      resultsListEl.innerHTML = skeletonCards(3);
      resultsCountEl.textContent = "Loading\u2026";
      return;
    }
    if (state.error) {
      resultsListEl.innerHTML = `<div class="empty-state"><h3>Couldn't load schemes</h3><p>${escapeHtml(state.error)}</p>
        <button class="btn btn-outline btn-sm" id="retryBtn" type="button">Try again</button></div>`;
      resultsCountEl.textContent = "";
      const retry = document.getElementById("retryBtn");
      if (retry) retry.addEventListener("click", () => { state.loading = true; state.error = null; renderResults(); loadData(); });
      return;
    }

    const results = filterSchemes(state.schemes, state.answers);
    resultsCountEl.textContent = `${results.length} scheme${results.length === 1 ? "" : "s"}`;

    if (results.length === 0) {
      resultsListEl.innerHTML = `<div class="empty-state">
        <h3>No matches yet</h3>
        <p>Try clearing a filter or two \u2014 schemes are added and updated often.</p>
        <button class="btn btn-outline btn-sm" id="clearFiltersBtn" type="button">Clear filters</button>
      </div>`;
      const clearBtn = document.getElementById("clearFiltersBtn");
      if (clearBtn) clearBtn.addEventListener("click", clearAllFilters);
      return;
    }

    resultsListEl.innerHTML = results.map((s) => renderCard(s)).join("");
    resultsListEl.querySelectorAll(".results-card__head").forEach((head) => {
      head.addEventListener("click", () => {
        const card = head.closest(".results-card");
        const id = card.dataset.id;
        state.openCardId = state.openCardId === id ? null : id;
        resultsListEl.querySelectorAll(".results-card").forEach((c) => {
          c.classList.toggle("is-open", c.dataset.id === state.openCardId);
        });
      });
    });
    resultsListEl.querySelectorAll("[data-share-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        shareScheme(btn.dataset.shareId);
      });
    });
  }

  function clearAllFilters() {
    state.answers = { state: "any", categories: [], demographics: [], query: "" };
    searchInput.value = "";
    document.getElementById("stateSelect").value = "any";
    renderCategoryStep();
    renderDemographicsStep();
    renderResults();
    persistAnswers();
  }

  function skeletonCards(n) {
    return Array.from({ length: n })
      .map(
        () => `<div class="skeleton-card">
          <div class="skeleton-line w-40"></div>
          <div class="skeleton-line w-90"></div>
          <div class="skeleton-line w-60"></div>
        </div>`
      )
      .join("");
  }

  function listToHtml(text) {
    // Turn "Step 1: ... Step 2: ..." / sentence-per-fact strings into a
    // readable bullet list by splitting on sentence boundaries.
    const parts = (text || "")
      .split(/(?<=[.;])\s+(?=[A-Z0-9])/)
      .map((p) => p.trim())
      .filter((p) => p.length > 2);
    if (parts.length <= 1) return `<p>${escapeHtml(text || "Not specified.")}</p>`;
    return `<ul>${parts.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`;
  }

  function renderCard(s) {
    const isOpen = state.openCardId === s.id;
    const levelBadge =
      s.level.toLowerCase() === "central"
        ? `<span class="badge badge-level-central">Central</span>`
        : `<span class="badge badge-level-state">State</span>`;
    const catBadges = s.categories
      .slice(0, 2)
      .map((c) => `<span class="badge badge-category">${escapeHtml(c)}</span>`)
      .join("");
    const matchedDemo = s.demoMatches.filter((id) => state.answers.demographics.includes(id));
    const matchBadge = matchedDemo.length
      ? `<span class="badge badge-match">Matches you</span>`
      : "";

    return `<div class="results-card${isOpen ? " is-open" : ""}" data-id="${escapeAttr(s.id)}">
      <button type="button" class="results-card__head">
        <div style="flex:1; min-width:0;">
          <div class="results-card__badges">${levelBadge}${catBadges}${matchBadge}</div>
          <div class="results-card__title">${escapeHtml(s.scheme_name)}</div>
          <div class="results-card__benefit">${escapeHtml(s.benefits || s.details)}</div>
        </div>
        <svg class="results-card__chevron" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="results-card__body">
        <div class="results-card__body-inner">
          <div class="detail-block">
            <h4>About</h4>
            <p>${escapeHtml(s.details)}</p>
          </div>
          <div class="detail-block">
            <h4>What you get</h4>
            <p>${escapeHtml(s.benefits)}</p>
          </div>
          <div class="detail-block">
            <h4>Who can apply</h4>
            ${listToHtml(s.eligibility)}
          </div>
          <div class="detail-block">
            <h4>How to apply</h4>
            ${listToHtml(s.application)}
          </div>
          ${s.documents ? `<div class="detail-block"><h4>Documents needed</h4>${listToHtml(s.documents)}</div>` : ""}
          <div class="results-card__footer">
            <button type="button" class="icon-btn" data-share-id="${escapeAttr(s.id)}">
              <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-3-3-3 3M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Share
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Sharing                                                            */
  /* ---------------------------------------------------------------- */

  function shareScheme(id) {
    const scheme = state.schemes.find((s) => s.id === id);
    if (!scheme) return;
    const text = `${scheme.scheme_name}\n${truncate(scheme.benefits || scheme.details, 180)}\n\nFind more schemes like this on Sarkar Sahayak:`;
    doShare({ title: scheme.scheme_name, text, url: APP_URL });
  }

  function shareApp() {
    doShare({
      title: "Sarkar Sahayak",
      text: "Sarkar Sahayak helps you find the government schemes and subsidies you actually qualify for. Try it:",
      url: APP_URL,
    });
  }

  async function doShare(payload) {
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
      showToast("Link copied to clipboard");
    } catch (e) {
      showToast("Couldn't share automatically \u2014 copy the link manually");
    }
  }

  /* ---------------------------------------------------------------- */
  /* Toast                                                              */
  /* ---------------------------------------------------------------- */

  let toastTimer;
  function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  /* ---------------------------------------------------------------- */
  /* Utilities                                                          */
  /* ---------------------------------------------------------------- */

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }
  function truncate(str, n) {
    if (!str) return "";
    return str.length > n ? str.slice(0, n - 1).trim() + "\u2026" : str;
  }

  /* ---------------------------------------------------------------- */
  /* Feedback + share buttons in footer / about                        */
  /* ---------------------------------------------------------------- */

  function initFooterAndAbout() {
    document.querySelectorAll("[data-feedback-link]").forEach((a) => {
      const subject = encodeURIComponent("Sarkar Sahayak Feedback");
      const body = encodeURIComponent("Hi Suva,\n\nHere's my feedback on Sarkar Sahayak:\n\n");
      a.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
    });
    document.querySelectorAll("[data-share-app]").forEach((btn) => {
      btn.addEventListener("click", shareApp);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Init                                                               */
  /* ---------------------------------------------------------------- */

  function init() {
    initTabs();
    initWizardNav();
    initSearch();
    initFooterAndAbout();
    renderStateStep();
    renderDemographicsStep();
    renderCategoryStep();
    updateTrackPosition();
    updateWizardVisibility();
    renderResults();
    loadData();

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
