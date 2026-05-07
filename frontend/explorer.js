(() => {
  const API_BASE_URLS = window.__API_BASE_URLS__ || (
    window.location.protocol === "file:" || window.location.port === "5501"
      ? ["http://127.0.0.1:5001", "http://127.0.0.1:5000"]
      : [window.location.origin]
  );
  const API_URL = "/api/billionaires/details?limit=5000&sort=wealth&order=desc";

  const searchInput = document.getElementById("explorer-search");
  const industrySelect = document.getElementById("explorer-industry");
  const stateSelect = document.getElementById("explorer-state");
  const minWorthInput = document.getElementById("explorer-min-wealth");
  const maxWorthInput = document.getElementById("explorer-max-wealth");
  const sortSelect = document.getElementById("explorer-sort");
  const orderButton = document.getElementById("explorer-order");
  const clearButton = document.getElementById("explorer-clear");
  const countLabel = document.getElementById("explorer-count");
  const listRoot = document.getElementById("explorer-list");

  const factsImage = document.getElementById("facts-image");
  const factsName = document.getElementById("facts-name");
  const factsResidence = document.getElementById("facts-residence");
  const factsWealth = document.getElementById("facts-wealth");
  const factsIndustry = document.getElementById("facts-industry");
  const factsPhilanthropy = document.getElementById("facts-philanthropy");
  const factsSelfMade = document.getElementById("facts-self-made");
  const factsQuote = document.getElementById("facts-quote");
  const factsYears = document.getElementById("facts-years");

  if (
    !searchInput ||
    !industrySelect ||
    !stateSelect ||
    !minWorthInput ||
    !maxWorthInput ||
    !sortSelect ||
    !orderButton ||
    !clearButton ||
    !countLabel ||
    !listRoot ||
    !factsName ||
    !factsResidence ||
    !factsWealth ||
    !factsIndustry ||
    !factsPhilanthropy ||
    !factsSelfMade ||
    !factsQuote ||
    !factsYears
  ) {
    return;
  }

  const numberFormatter = new Intl.NumberFormat("en-US");
  const abbreviationFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });

  let allPeople = [];
  let selectedId = "";
  let filterOrder = "desc";
  let renderToken = 0;
  let searchTimer = null;

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function formatWealth(value) {
    if (value == null || Number.isNaN(value)) return "--";
    if (value >= 1000) {
      return `$${abbreviationFormatter.format(value / 1000)}T`;
    }
    return `$${abbreviationFormatter.format(value)}B`;
  }

  function formatScore(value) {
    return value == null || Number.isNaN(value) ? "--" : numberFormatter.format(value);
  }

  function formatYearsToEarn(wealthBillions) {
    if (wealthBillions == null || Number.isNaN(wealthBillions)) {
      return "-- years";
    }

    const annualIncome = 67000;
    const years = (Number(wealthBillions) * 1_000_000_000) / annualIncome;
    if (!Number.isFinite(years)) {
      return "-- years";
    }

    return `${numberFormatter.format(Math.round(years))} years`;
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  async function fetchJson(path) {
    let lastError = null;

    for (const baseUrl of API_BASE_URLS) {
      try {
        const response = await fetch(`${baseUrl}${path}`);
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Failed to fetch data");
  }

  function getSortValue(person, sortField) {
    switch (sortField) {
      case "name":
        return normalize(person.name);
      case "industry":
        return normalize(person.industry);
      case "state":
        return normalize(person.state);
      case "residence":
        return normalize(person.residence);
      case "philanthropy_score":
        return person.philanthropy_score ?? -1;
      case "self_made_score":
        return person.self_made_score ?? -1;
      case "wealth":
      default:
        return person.wealth ?? -1;
    }
  }

  function matchesFilters(person) {
    const query = normalize(searchInput.value);
    const industry = normalize(industrySelect.value);
    const state = normalize(stateSelect.value);
    const minWorth = minWorthInput.value === "" ? null : Number(minWorthInput.value);
    const maxWorth = maxWorthInput.value === "" ? null : Number(maxWorthInput.value);

    if (query) {
      const haystack = normalize([
        person.name,
        person.id,
        person.residence,
        person.state,
        person.industry,
        person.quote,
        ...(person.about || []),
      ].join(" "));

      if (!haystack.includes(query)) return false;
    }

    if (industry && !normalize(person.industry).includes(industry)) {
      return false;
    }

    if (state) {
      const personState = normalize(person.state);
      const personResidence = normalize(person.residence);
      if (!personState.includes(state) && !personResidence.includes(state)) {
        return false;
      }
    }

    if (minWorth != null && !Number.isNaN(minWorth)) {
      if (person.wealth == null || person.wealth < minWorth) return false;
    }

    if (maxWorth != null && !Number.isNaN(maxWorth)) {
      if (person.wealth == null || person.wealth > maxWorth) return false;
    }

    return true;
  }

  function updateOrderButton() {
    orderButton.textContent = filterOrder === "desc" ? "Highest first" : "Lowest first";
    orderButton.setAttribute("aria-pressed", String(filterOrder === "asc"));
  }

  function renderFilters() {
    const industries = uniqueSorted(allPeople.map(person => person.industry));
    const states = uniqueSorted(allPeople.map(person => person.state));
    const countries = uniqueSorted(allPeople.map(person => person.country).filter(value => value && value !== "United States"));

    industrySelect.innerHTML = '<option value="">All industries</option>';
    industries.forEach(industry => {
      const option = document.createElement("option");
      option.value = industry;
      option.textContent = industry;
      industrySelect.appendChild(option);
    });

    stateSelect.innerHTML = '<option value="">All states and countries</option>';
    states.forEach(state => {
      const option = document.createElement("option");
      option.value = state;
      option.textContent = state;
      stateSelect.appendChild(option);
    });

    countries.forEach(country => {
      const option = document.createElement("option");
      option.value = country;
      option.textContent = country;
      stateSelect.appendChild(option);
    });
  }

  function renderList(filteredPeople) {
    const fragment = document.createDocumentFragment();

    if (!filteredPeople.length) {
      const empty = document.createElement("div");
      empty.className = "explorer-empty";
      empty.textContent = "No billionaires match the current filters.";
      fragment.appendChild(empty);
      listRoot.innerHTML = "";
      listRoot.appendChild(fragment);
      return;
    }

    filteredPeople.forEach((person, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `explorer-item${person.id === selectedId ? " is-selected" : ""}`;
      item.dataset.id = person.id;
      item.innerHTML = `
        <div class="explorer-item-rank">#${index + 1}</div>
        <div class="explorer-item-body">
          <div class="explorer-item-topline">
            <strong>${person.name}</strong>
            <span>${formatWealth(person.wealth)}</span>
          </div>
          <div class="explorer-item-meta">
            <span>${person.industry || "Industry unknown"}</span>
            <span>${person.residence || person.state || "Residence unknown"}</span>
          </div>
        </div>
      `;
      fragment.appendChild(item);
    });

    listRoot.innerHTML = "";
    listRoot.appendChild(fragment);
  }

  function renderCard(person) {
    if (!person) {
      factsImage.removeAttribute("src");
      factsImage.alt = "";
      factsName.textContent = "Pick a billionaire";
      factsResidence.textContent = "Select someone from the list to inspect their profile.";
      factsWealth.textContent = "--";
      factsIndustry.textContent = "--";
      factsPhilanthropy.textContent = "--";
      factsSelfMade.textContent = "--";
      factsQuote.textContent = "A selected billionaire's quote will appear here.";
      factsYears.textContent = "-- years";
      return;
    }

    if (person.image) {
      factsImage.src = person.image;
      factsImage.alt = `${person.name} portrait`;
      factsImage.style.display = "block";
    } else {
      factsImage.removeAttribute("src");
      factsImage.alt = "";
      factsImage.style.display = "none";
    }

    factsName.textContent = person.name || "Unknown billionaire";
    factsResidence.textContent = person.residence || person.country || person.state || "Residence not listed";
    factsWealth.textContent = formatWealth(person.wealth);
    factsIndustry.textContent = person.industry || "Unknown";
    factsPhilanthropy.textContent = formatScore(person.philanthropy_score);
    factsSelfMade.textContent = formatScore(person.self_made_score);
    factsQuote.textContent = person.quote || "No quote available.";
    factsYears.textContent = formatYearsToEarn(person.wealth);
  }

  function applyFilters() {
    const filtered = allPeople
      .filter(matchesFilters)
      .sort((a, b) => {
        const sortField = sortSelect.value;
        const left = getSortValue(a, sortField);
        const right = getSortValue(b, sortField);

        if (left < right) return filterOrder === "asc" ? -1 : 1;
        if (left > right) return filterOrder === "asc" ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

    countLabel.textContent = `${numberFormatter.format(filtered.length)} billionaire${filtered.length === 1 ? "" : "s"} shown`;

    if (!filtered.some(person => person.id === selectedId)) {
      selectedId = filtered[0]?.id || "";
    }

    renderList(filtered);
    renderCard(filtered.find(person => person.id === selectedId) || filtered[0] || null);
  }

  function scheduleFilter() {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      applyFilters();
    }, 120);
  }

  listRoot.addEventListener("click", event => {
    const button = event.target.closest("[data-id]");
    if (!button) return;

    selectedId = button.dataset.id || "";
    applyFilters();
  });

  searchInput.addEventListener("input", scheduleFilter);
  industrySelect.addEventListener("change", applyFilters);
  stateSelect.addEventListener("change", applyFilters);
  minWorthInput.addEventListener("input", scheduleFilter);
  maxWorthInput.addEventListener("input", scheduleFilter);
  sortSelect.addEventListener("change", applyFilters);
  orderButton.addEventListener("click", () => {
    filterOrder = filterOrder === "desc" ? "asc" : "desc";
    updateOrderButton();
    applyFilters();
  });

  clearButton.addEventListener("click", () => {
    searchInput.value = "";
    industrySelect.value = "";
    stateSelect.value = "";
    minWorthInput.value = "";
    maxWorthInput.value = "";
    sortSelect.value = "wealth";
    filterOrder = "desc";
    updateOrderButton();
    applyFilters();
  });

  async function loadExplorerData() {
    countLabel.textContent = "Loading billionaire records...";

    try {
      const payload = await fetchJson(API_URL);
      allPeople = Array.isArray(payload.results) ? payload.results : (Array.isArray(payload) ? payload : []);
      renderFilters();
      updateOrderButton();
      selectedId = allPeople[0]?.id || "";
      applyFilters();
    } catch (error) {
      console.error("Failed to load billionaire explorer data:", error);
      countLabel.textContent = "Unable to load billionaire records.";
      listRoot.innerHTML = '<div class="explorer-empty">The explorer could not load data right now.</div>';
      renderCard(null);
    }
  }

  loadExplorerData();
})();
