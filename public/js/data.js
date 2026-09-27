/**
 * Sarkar Sahayak — data.js
 * Fetches and parses the live scheme sheet, then exposes a small
 * eligibility-matching engine used by the wizard in app.js.
 *
 * The published sheet has no separate age/state/income columns — it's
 * real-world scraped scheme data. So "state" and "who this is for" are
 * inferred by scanning the scheme's own text (eligibility, details,
 * name, tags) for recognizable keywords. This is a heuristic, not a
 * legal determination — the UI always says so and links to the
 * official application steps.
 */

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRNJtXcE5EnxpOMPcPp4lUzlSSe6DCGk1u-jZHbmfv92wb0y_-XAoZQPay0F9J8b67XHcQTOxz_2F1e/pub?gid=1167270920&single=true&output=csv";

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

// Alternate spellings/aliases seen in real scheme text, mapped to the
// canonical state name above.
const STATE_ALIASES = {
  Odisha: ["Orissa"],
  Puducherry: ["Pondicherry"],
  "Uttar Pradesh": ["U.P.", "UP"],
  "Madhya Pradesh": ["M.P.", "MP"],
  Delhi: ["NCT of Delhi", "National Capital Territory"],
  "Tamil Nadu": ["Tamilnadu"],
  "West Bengal": ["WB"],
};

// Demographic self-description groups shown in the wizard. Each maps to
// a regex tested against a scheme's combined searchable text.
const DEMOGRAPHIC_GROUPS = [
  { id: "woman", label: "Woman", emoji: "\u{1F469}", re: /\bwomen'?s?\b|\bwoman\b|\bwidow(ed)?\b|\bmahila\b|\bgirl child\b|\bmother\b/i },
  { id: "student", label: "Student", emoji: "\u{1F393}", re: /\bstudent(s)?\b|\bscholarship\b|\bschool\b|\bcollege\b|\beducation\b|\bpre-?matric\b|\bpost-?matric\b/i },
  { id: "farmer", label: "Farmer / fisherworker", emoji: "\u{1F33E}", re: /\bfarmer(s)?\b|\bagricultur|\bfisherm(a|e)n\b|\bfisherwoman\b|\bkisan\b|\ballied activities\b/i },
  { id: "worker", label: "Construction / unorganised worker", emoji: "\u{1F477}", re: /\bconstruction worker(s)?\b|\bunorgani[sz]ed worker\b|\blabou?r(er)?\b|\bshramik\b|\bbuilding worker\b/i },
  { id: "disability", label: "Person with disability", emoji: "\u2666", re: /\bdisabilit(y|ies)\b|\bdisabled\b|\bdivyang\b|\bpwd\b|\bspecially.?abled\b/i },
  { id: "senior", label: "Senior citizen", emoji: "\u{1F474}", re: /\bsenior citizen(s)?\b|\bold age\b|\belderly\b|\b60 years\b|\bpension\b/i },
  { id: "reserved", label: "SC / ST / OBC", emoji: "\u{1F91D}", re: /\bscheduled caste\b|\bscheduled tribe\b|\bsc\/st\b|\bobc\b|\bbackward class(es)?\b/i },
  { id: "entrepreneur", label: "Entrepreneur / business owner", emoji: "\u{1F4BC}", re: /\bentrepreneur(s)?\b|\bmsme\b|\bmicro,? small\b|\bbusiness\b|\bstart-?up\b|\bself-?employ/i },
  { id: "unemployed", label: "Unemployed / looking for work", emoji: "\u{1F50D}", re: /\bunemploy(ed|ment)\b|\byouth\b|\bjob seeker\b|\bskill development\b|\btraining\b/i },
  { id: "lowincome", label: "Low income / BPL family", emoji: "\u{1FA99}", re: /\bbpl\b|\bbelow poverty line\b|\blow.?income\b|\beconomically weaker\b|\bews\b|\bpoor\b/i },
];

let cachedSchemes = null;

function stripHtml(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function splitList(text) {
  return (text || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildStateMatchers() {
  return STATES.map((state) => {
    const names = [state, ...(STATE_ALIASES[state] || [])];
    const pattern = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    return { state, re: new RegExp(`\\b(${pattern})\\b`, "i") };
  });
}
const STATE_MATCHERS = buildStateMatchers();

function detectStates(text) {
  const found = [];
  for (const { state, re } of STATE_MATCHERS) {
    if (re.test(text)) found.push(state);
  }
  return found;
}

function normalizeRow(row, index) {
  const scheme_name = stripHtml(row.scheme_name);
  const details = stripHtml(row.details);
  const benefits = stripHtml(row.benefits);
  const eligibility = stripHtml(row.eligibility);
  const application = stripHtml(row.application);
  const documents = stripHtml(row.documents);
  const level = stripHtml(row.level) || "State";
  const categories = splitList(row.schemeCategory);
  const tags = splitList(row.tags);

  const searchText = [scheme_name, details, benefits, eligibility, categories.join(" "), tags.join(" ")]
    .join(" ")
    .toLowerCase();

  const demoMatches = DEMOGRAPHIC_GROUPS.filter((g) => g.re.test(searchText)).map((g) => g.id);
  const statesMentioned = level.toLowerCase() === "central" ? [] : detectStates([scheme_name, details, eligibility].join(" "));

  return {
    id: row.slug || `scheme-${index}`,
    scheme_name: scheme_name || "Untitled Scheme",
    slug: row.slug || `scheme-${index}`,
    details,
    benefits,
    eligibility,
    application,
    documents,
    level,
    categories,
    tags,
    searchText,
    demoMatches,
    statesMentioned,
  };
}

async function fetchSchemes({ force = false } = {}) {
  if (cachedSchemes && !force) return cachedSchemes;

  const res = await fetch(SHEET_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const csvText = await res.text();

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  cachedSchemes = parsed.data
    .filter((row) => row.scheme_name && row.scheme_name.trim())
    .map(normalizeRow);

  return cachedSchemes;
}

function schemeMatchesState(scheme, stateName) {
  if (!stateName || stateName === "any") return true;
  if (scheme.level.toLowerCase() === "central") return true;
  if (scheme.statesMentioned.length === 0) return true; // undetected -> don't hide it, just unranked
  return scheme.statesMentioned.includes(stateName);
}

function schemeMatchesCategory(scheme, selectedCategories) {
  if (!selectedCategories || selectedCategories.length === 0) return true;
  return scheme.categories.some((c) => selectedCategories.includes(c));
}

function schemeMatchesQuery(scheme, query) {
  if (!query) return true;
  return scheme.searchText.includes(query.trim().toLowerCase());
}

/**
 * Filters + ranks schemes for the given wizard answers.
 * Returns schemes sorted so the best demographic + state matches
 * float to the top, without hard-excluding under-tagged schemes
 * (real scheme text doesn't always name every eligible group).
 */
function filterSchemes(schemes, { state, categories = [], demographics = [], query = "" } = {}) {
  const stateFiltered = schemes.filter((s) => schemeMatchesState(s, state));
  const categoryFiltered = stateFiltered.filter((s) => schemeMatchesCategory(s, categories));
  const queried = categoryFiltered.filter((s) => schemeMatchesQuery(s, query));

  const scored = queried.map((s) => {
    let score = 0;
    if (demographics.length) {
      const hits = s.demoMatches.filter((m) => demographics.includes(m)).length;
      score += hits * 10;
    }
    if (state && state !== "any" && s.statesMentioned.includes(state)) score += 3;
    if (state && state !== "any" && s.level.toLowerCase() === "central") score += 1;
    return { scheme: s, score };
  });

  // If the user picked demographics, prioritise real matches but still
  // show the rest below so results never look empty.
  scored.sort((a, b) => b.score - a.score || a.scheme.scheme_name.localeCompare(b.scheme.scheme_name));

  return scored.map((x) => x.scheme);
}

function uniqueCategories(schemes) {
  const set = new Set();
  schemes.forEach((s) => s.categories.forEach((c) => set.add(c)));
  return Array.from(set).sort();
}

window.SarkarData = {
  STATES,
  DEMOGRAPHIC_GROUPS,
  fetchSchemes,
  filterSchemes,
  uniqueCategories,
};
