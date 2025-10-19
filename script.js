/* The Isle (Evrima) — Table logic
   - Loads YAML from data/dinosaurs.yaml
   - Formats growth thresholds given as 0..100 (may include one decimal) and allows null
   - Popover for mutation tips uses a single fixed overlay outside the table (#mut-overlay)
   - Header tooltips use a single fixed overlay (#th-tip)
   - Click-to-sort headers with 3-state cycle: asc -> desc -> default (original YAML order)
*/

(function () {
  const tbody = document.querySelector("#dino-table tbody");
  let allData = [];                    // Keeps original YAML order
  let sortState = { key: null, dir: null }; // dir: "asc" | "desc" | null

  /* ---------- Formatting helpers ---------- */
  function fmtType(t) {
    const map = { "Carnivore": "🍖", "Herbivore": "🌿", "Omnivore": "🥚", "AI": "🤖"};
    return map[t] || "—";
  }
  function fmtPct(x) {
    if (x === null || x === undefined || x === "") return "—";
    const str = String(x).trim();
    const n = Number(str);
    if (!Number.isFinite(n)) return "—";
    // Preserve a decimal if provided in YAML (up to 1 place)
    if (str.includes(".")) return n.toFixed(1).replace(/\.0$/, "") + "%";
    return n.toFixed(0) + "%";
  }
  function fmtNum(x) {
    if (x === null || x === undefined || x === "") return "—";
    return String(x);
  }
  function fmtPack(base, social) {
    const b = normNum(base);
    const s = normNum(social);
    if (b === null && s === null) return "—";
    const left = (b === null ? "—" : String(b));
    const right = (s === null ? "—" : String(s));
    return left + " / " + right;
  }
  function normNum(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /* ---------- Row rendering ---------- */
  function rowHtml(d) {
    const gt = d.growth_thresholds || {};
    const st = d.stats || {};
    const pk = d.pack_size || {};
    const rec = d.mutation_recs || {};
    const topX = Array.isArray(rec) ? rec : [];

    const tipsHtml = `
      <div class="info-wrap">
        <span class="info-icon" tabindex="0" aria-label="Show mutation tips"></span>
      </div>
      <div class="mut-pop" role="dialog" aria-label="Mutation recommendations" hidden>
        <ul>${topX.map(x => `<li>${x}</li>`).join("")}</ul>
      </div>`;
    const ai_toggle = d.type == "AI" ? `class="no-print"` : ""
    return `<tr ${ai_toggle}>
      <td>${d.name || "—"}</td>
      <td class="type-cell">${fmtType(d.type)}</td>
      <td class="mono">${fmtPct(gt.first_mutation)}</td>
      <td class="mono">${fmtPct(gt.second_mutation)}</td>
      <td class="mono">${fmtPct(gt.third_mutation)}</td>
      <td class="mono">${fmtPct(gt.sanctuary_mushroom)}</td>
      <td class="mono">${fmtPct(gt.sanctuary_lockout)}</td>
      <td class="mono">${fmtNum(st.weight_kg)}</td>
      <td class="mono">${fmtNum(st.bite_force_N)}</td>
      <td class="mono">${fmtNum(st.speed_kmh)}</td>
      <td class="mono">${fmtPct(st.carry_weight_perc)}</td>
      <td class="mono">${fmtPack(pk.base, pk.with_social)}</td>
      <td class="info-cell no-print" data-tip="Click or tap for details.">${tipsHtml}</td>
    </tr>`;
  }

  /* ---------- Sorting ---------- */
  function getVal(d, key) {
    const gt = d.growth_thresholds || {};
    const st = d.stats || {};
    const pk = d.pack_size || {};
    switch (key) {
      case "name": return (d.name || "").toLowerCase();
      case "type": return (d.type || "").toLowerCase();
      case "gt1": return normNum(gt.first_mutation);
      case "gt2": return normNum(gt.second_mutation);
      case "gt3": return normNum(gt.third_mutation);
      case "sancm": return normNum(gt.sanctuary_mushroom);
      case "sanc": return normNum(gt.sanctuary_lockout);
      case "weight": return normNum(st.weight_kg);
      case "bite": return normNum(st.bite_force_N);
      case "speed": return normNum(st.speed_kmh);
      case "carry": return normNum(st.carry_weight_perc);
      case "pack": return [normNum(pk.base), normNum(pk.with_social)];
      default: return null;
    }
  }

  function cmpVal(a, b) {
    const na = (a === null || a === undefined || a !== a);
    const nb = (b === null || b === undefined || b !== b);
    if (na && nb) return 0;
    if (na) return 1;   // nulls last
    if (nb) return -1;

    if (Array.isArray(a) || Array.isArray(b)) {
      const A = Array.isArray(a) ? a : [a];
      const B = Array.isArray(b) ? b : [b];
      const len = Math.max(A.length, B.length);
      for (let i = 0; i < len; i++) {
        const r = cmpVal(A[i], B[i]);
        if (r !== 0) return r;
      }
      return 0;
    }

    if (typeof a === "string" || typeof b === "string") {
      return String(a).localeCompare(String(b));
    }
    const an = Number(a), bn = Number(b);
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  }
  function sortData() {
    if (!sortState.key || !sortState.dir) {
      return [...allData].sort((a, b) => a._idx - b._idx); // default YAML order
    }
    const { key, dir } = sortState;
    const sign = dir === "asc" ? 1 : -1;
    return [...allData].sort((a, b) => sign * cmpVal(getVal(a, key), getVal(b, key)));
  }
  function updateHeaderIndicators() {
    document.querySelectorAll("thead th.sortable").forEach(th => {
      const k = th.dataset.sortKey;
      th.setAttribute("data-sort", (sortState.key === k ? (sortState.dir || "none") : "none"));
    });
  }
  function attachSortHandlers() {
    document.querySelectorAll("thead th.sortable").forEach(th => {
      th.setAttribute("data-sort", "none");
      th.addEventListener("click", () => {
        const k = th.dataset.sortKey;
        // cycle: none -> asc -> desc -> none
        if (sortState.key !== k) { sortState = { key: k, dir: "asc" }; }
        else if (sortState.dir === "asc") { sortState = { key: k, dir: "desc" }; }
        else if (sortState.dir === "desc") { sortState = { key: null, dir: null }; }
        else { sortState = { key: k, dir: "asc" }; }
        renderTable();
      });
    });
  }

  /* ---------- Mutation tips overlay ---------- */
  let mutOverlay = null;
  let currentCell = null;
  function ensureMutOverlay() {
    if (!mutOverlay) {
      mutOverlay = document.getElementById("mut-overlay");
      if (!mutOverlay) {
        mutOverlay = document.createElement("div");
        mutOverlay.id = "mut-overlay";
        document.body.appendChild(mutOverlay);
      }
    }
  }
  function hideMutOverlay() {
    if (!mutOverlay) return;
    mutOverlay.classList.remove("show");
    mutOverlay.style.left = "";
    mutOverlay.style.top = "";
    mutOverlay.style.visibility = "";
    currentCell = null;
  }
  function populateMutOverlayFromCell(cell) {
    const topX = [...cell.querySelectorAll(".mut-pop li")].map(li => li.textContent);
    mutOverlay.innerHTML = `
      <ul>${topX.map(x => `<li>${x}</li>`).join("")}</ul>
    `;
  }
  function positionOverlayNear(targetEl, overlayEl) {
    overlayEl.style.visibility = "hidden";
    overlayEl.classList.add("show");

    const rect = targetEl.getBoundingClientRect();
    const ow = overlayEl.offsetWidth;
    const oh = overlayEl.offsetHeight;
    const margin = 8;

    let left = Math.min(rect.left, window.innerWidth - ow - margin);
    let top = rect.bottom + margin;

    if (top + oh > window.innerHeight) top = rect.top - oh - margin;
    if (top < margin) top = margin;
    if (left < margin) left = margin;

    overlayEl.style.left = `${left}px`;
    overlayEl.style.top = `${top}px`;
    overlayEl.style.visibility = "visible";
  }
  function attachInfoHandlers() {
    ensureMutOverlay();

    // Event delegation for clicks inside the table
    document.addEventListener("click", e => {
      const cell = e.target.closest("#dino-table .info-cell");
      const icon = e.target.closest("#dino-table .info-cell .info-icon");

      if (cell) {
        if (mutOverlay.classList.contains("show") && currentCell === cell) {
          hideMutOverlay();
        } else {
          populateMutOverlayFromCell(cell);
          positionOverlayNear(icon || cell, mutOverlay);
          currentCell = cell;
        }
        return;
      }

      // Clicked outside: close
      if (mutOverlay && !mutOverlay.contains(e.target)) hideMutOverlay();
    });

    document.addEventListener("keydown", e => { if (e.key === "Escape") hideMutOverlay(); });
    window.addEventListener("scroll", hideMutOverlay, { passive: true });
    window.addEventListener("resize", hideMutOverlay);
  }

  /* ---------- Header tooltips overlay ---------- */
  let thTip = null;
  function ensureThTip() {
    if (!thTip) {
      thTip = document.getElementById("th-tip");
      if (!thTip) {
        thTip = document.createElement("div");
        thTip.id = "th-tip";
        document.body.appendChild(thTip);
      }
    }
  }
  function hideThTip() {
    if (!thTip) return;
    thTip.classList.remove("show");
    thTip.style.visibility = "";
  }
  function attachHeaderTips() {
    ensureThTip();
    const margin = 8;

    function showFor(el) {
      thTip.textContent = el.getAttribute("data-tip") || "";
      thTip.style.visibility = "hidden";
      thTip.classList.add("show");

      const rect = el.getBoundingClientRect();
      const tw = thTip.offsetWidth;
      const th = thTip.offsetHeight;

      let left = Math.min(Math.max(rect.left, margin), window.innerWidth - tw - margin);
      let top = rect.bottom + margin;
      if (top + th > window.innerHeight) top = rect.top - th - margin;
      if (top < margin) top = margin;

      thTip.style.left = `${left}px`;
      thTip.style.top = `${top}px`;
      thTip.style.visibility = "visible";
    }

    document.querySelectorAll("thead .th-tooltip").forEach(th => {
      th.setAttribute("tabindex", "0");
      th.addEventListener("mouseenter", () => showFor(th));
      th.addEventListener("mouseleave", hideThTip);
      th.addEventListener("focus", () => showFor(th));
      th.addEventListener("blur", hideThTip);
    });

    window.addEventListener("scroll", hideThTip, { passive: true });
    window.addEventListener("resize", hideThTip);
  }

  /* ---------- Render + Load ---------- */
  function renderTable() {
    const rows = sortData().map(rowHtml).join("");
    tbody.innerHTML = rows;
    updateHeaderIndicators();
    // No need to re-bind global delegation handlers each render
  }

  async function loadYaml() {
    try {
      const res = await fetch("data/dinosaurs.yaml", { cache: "no-cache" });
      const text = await res.text();
      const data = jsyaml.load(text);
      const dinos = (data && data.dinos) ? data.dinos : [];
      allData = dinos.map((d, i) => ({ ...d, _idx: i })); // remember original order
      renderTable();
    } catch (err) {
      console.error("Failed to load YAML:", err);
      tbody.innerHTML = `<tr><td colspan="10">Could not load <code>data/dinosaurs.yaml</code>.</td></tr>`;
    }
  }

  // Boot
  loadYaml();
  attachSortHandlers();
  attachInfoHandlers();
  attachHeaderTips();
})();

// Tabs setup (requires jQuery)
$(function() {
  const $tabs = $(".info-tabs");
  const $titles = $tabs.find(".tab-titles li");
  const $content = $tabs.find(".tab");

  $titles.on("click", function() {
    const $this = $(this);
    const tab = $this.data("tab");
    const isActive = $this.hasClass("active");

    // If active -> deactivate all
    if (isActive) {
      $titles.removeClass("active");
      $content.removeClass("active");
      $tabs.removeClass("has-active");
      return;
    }

    // Activate clicked tab, deactivate others
    $titles.removeClass("active");
    $this.addClass("active");
    $content.removeClass("active");
    $(`#tab-${tab}`).addClass("active");

    // Flag container so it shows border only when something is open
    $tabs.addClass("has-active");
  });
});