/* Apartment Renovation Expense Dashboard
 * Read-only visualization layer over renovation.json.
 * Vanilla JS, no dependencies, relative paths only (GitHub Pages friendly).
 */
(function () {
  "use strict";

  // ---------- State ----------
  var DATA = null;        // validated raw data
  var LOOKUPS = {};       // id -> name for rooms/categories
  var FILTERS = {
    dateFrom: "", dateTo: "", category: "", room: "", vendor: "", status: ""
  };
  var SORT = { by: "date", dir: "desc" };
  var CURRENCY = "EUR";

  // ---------- DOM helpers ----------
  function $(id) { return document.getElementById(id); }
  function setText(id, txt) { var el = $(id); if (el) el.textContent = txt; }
  function clearChildren(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ---------- Formatting ----------
  function formatMoney(value) {
    var n = Number(value) || 0;
    try {
      return n.toLocaleString(undefined, { style: "currency", currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
      return n.toFixed(2) + " " + CURRENCY;
    }
  }
  function formatDate(iso) {
    if (!iso) return "—";
    var d = parseDate(iso);
    if (!d) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function parseDate(iso) {
    if (!iso) return null;
    // Accept YYYY-MM-DD
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function pct(part, whole) {
    if (!whole) return 0;
    return (part / whole) * 100;
  }
  function fmtPct(v) { return (Math.round(v * 10) / 10).toFixed(1) + "%"; }

  // ---------- Validation ----------
  function validateData(raw) {
    if (!raw || typeof raw !== "object") throw new Error("Невалидни данни: липсва обект.");
    if (!raw.project || typeof raw.project !== "object") throw new Error("Липсва секция 'project'.");
    if (typeof raw.project.budget !== "number") throw new Error("Полето 'project.budget' трябва да е число.");
    if (!Array.isArray(raw.expenses)) throw new Error("Полето 'expenses' трябва да е масив.");
    if (!Array.isArray(raw.rooms)) raw.rooms = [];
    if (!Array.isArray(raw.categories)) raw.categories = [];
    return raw;
  }

  function buildLookups(data) {
    LOOKUPS.rooms = {};
    LOOKUPS.categories = {};
    (data.rooms || []).forEach(function (r) { LOOKUPS.rooms[r.id] = r.name || r.id; });
    (data.categories || []).forEach(function (c) { LOOKUPS.categories[c.id] = c.name || c.id; });
  }

  function roomName(id) { return LOOKUPS.rooms[id] || id || "—"; }
  function categoryName(id) { return LOOKUPS.categories[id] || id || "—"; }

  // Normalize an expense: fill missing optional fields with safe defaults.
  function normalizeExpense(e, i) {
    if (!e || typeof e !== "object") return null;
    if (!e.id) e.id = "exp-" + (i + 1);
    if (!e.date) e.date = "";
    if (typeof e.amount !== "number") e.amount = 0;
    e.currency = e.currency || DATA.project.currency || "EUR";
    e.category = e.category || "";
    // room may be string or array of strings
    if (e.room == null) e.room = "";
    if (typeof e.room === "string") e.rooms = [e.room];
    else if (Array.isArray(e.room)) e.rooms = e.room.slice();
    else e.rooms = [];
    e.vendor = e.vendor || "";
    e.description = e.description || "";
    e.payment_method = e.payment_method || "";
    e.receipt = e.receipt || "";
    e.notes = e.notes || "";
    e.thumbnail = e.thumbnail || "";
    e.status = e.status || "";
    e.url = e.url || "";
    e.order_number = e.order_number || "";
    e.quantity = (typeof e.quantity === "number") ? e.quantity : 1;
    return e;
  }

  // ---------- Filtering ----------
  function matchesFilters(e) {
    if (FILTERS.dateFrom) {
      var from = parseDate(FILTERS.dateFrom);
      var ed = parseDate(e.date);
      if (from && ed && ed < from) return false;
    }
    if (FILTERS.dateTo) {
      var to = parseDate(FILTERS.dateTo);
      var ed2 = parseDate(e.date);
      if (to && ed2 && ed2 > to) return false;
    }
    if (FILTERS.category && e.category !== FILTERS.category) return false;
    if (FILTERS.room && e.rooms.indexOf(FILTERS.room) === -1) return false;
    if (FILTERS.vendor) {
      var v = (e.vendor || "").toLowerCase();
      if (v.indexOf(FILTERS.vendor.toLowerCase()) === -1) return false;
    }
    if (FILTERS.status) {
      var paid = isPaid(e);
      if (FILTERS.status === "paid" && !paid) return false;
      if (FILTERS.status === "unpaid" && paid) return false;
    }
    return true;
  }

  // "Paid" interpretation: status paid OR amount>0 with status not in unpaid set.
  function isPaid(e) {
    var s = (e.status || "").toLowerCase();
    if (s === "paid" || s === "completed" || s === "approved") return true;
    if (s === "unpaid" || s === "pending" || s === "pending_approval" || s === "pending_payment") return false;
    // Unknown status: treat as unpaid if amount>0 but no clear paid marker.
    return false;
  }

  function statusLabel(e) {
    var s = (e.status || "").toLowerCase();
    if (s === "paid" || s === "approved" || s === "completed") return { text: "Платен", cls: "paid" };
    if (s === "pending" || s === "pending_approval") return { text: "Чака одобрение", cls: "pending" };
    if (s === "unpaid" || s === "pending_payment") return { text: "Неплатен", cls: "unpaid" };
    return { text: s || "—", cls: "" };
  }

  function filteredExpenses() {
    return DATA.expenses.filter(matchesFilters);
  }

  // ---------- Calculations ----------
  function computeStats(expenses) {
    var totalSpent = 0;
    var count = expenses.length;
    var largest = null;
    for (var i = 0; i < count; i++) {
      var amt = expenses[i].amount;
      totalSpent += amt;
      if (!largest || amt > largest.amount) largest = expenses[i];
    }
    var budget = DATA.project.budget || 0;
    var remaining = budget - totalSpent;
    var utilization = budget > 0 ? (totalSpent / budget) * 100 : (totalSpent > 0 ? 100 : 0);
    var average = count > 0 ? totalSpent / count : 0;
    return {
      budget: budget,
      totalSpent: totalSpent,
      remaining: remaining,
      utilization: utilization,
      average: average,
      count: count,
      largest: largest
    };
  }

  function groupTotals(expenses, keyFn) {
    var map = {};
    for (var i = 0; i < expenses.length; i++) {
      var keys = keyFn(expenses[i]);
      if (!Array.isArray(keys)) keys = [keys];
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k] || "other";
        if (!map[key]) map[key] = 0;
        map[key] += expenses[i].amount;
      }
    }
    return map;
  }

  function monthlyTotals(expenses) {
    var map = {};
    for (var i = 0; i < expenses.length; i++) {
      var d = parseDate(expenses[i].date);
      if (!d) continue;
      var key = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
      if (!map[key]) map[key] = 0;
      map[key] += expenses[i].amount;
    }
    // Sort keys ascending
    var keys = Object.keys(map).sort();
    var cumulative = 0;
    return keys.map(function (k) {
      cumulative += map[k];
      return { month: k, amount: map[k], cumulative: cumulative };
    });
  }

  // ---------- Rendering: header & summary ----------
  function renderHeader(stats) {
    setText("hdrBudget", formatMoney(stats.budget));
    setText("hdrSpent", formatMoney(stats.totalSpent));
    var remEl = $("hdrRemaining");
    remEl.textContent = formatMoney(stats.remaining);
    remEl.classList.toggle("over", stats.remaining < 0);
    setText("hdrUsed", fmtPct(stats.utilization));

    var bar = $("progressBar");
    var width = Math.min(stats.utilization, 100);
    bar.style.width = (stats.count === 0 ? 0 : width) + "%";
    bar.classList.toggle("over", stats.utilization > 100);
    setText("progressLabel", stats.count === 0 ? "" : fmtPct(stats.utilization));
  }

  function renderSummaryCards(stats) {
    setText("cardSpent", formatMoney(stats.totalSpent));
    var remEl = $("cardRemaining");
    remEl.textContent = formatMoney(stats.remaining);
    remEl.classList.toggle("over", stats.remaining < 0);
    setText("cardCount", String(stats.count));
    setText("cardAvg", stats.count ? formatMoney(stats.average) : "—");
    setText("cardLargest", stats.largest ? formatMoney(stats.largest.amount) : "—");
  }

  function renderBudgetAnalysis(stats, expenses) {
    setText("baBudget", formatMoney(stats.budget));
    setText("baSpent", formatMoney(stats.totalSpent));
    var remEl = $("baRemaining");
    remEl.textContent = formatMoney(stats.remaining);
    remEl.classList.toggle("over", stats.remaining < 0);
    setText("baUsed", fmtPct(stats.utilization));

    // Category vs total project budget
    var catTotals = groupTotals(expenses, function (e) { return e.category || "other"; });
    var container = $("categoryBudgetBars");
    clearChildren(container);
    var cats = Object.keys(catTotals).sort(function (a, b) { return catTotals[b] - catTotals[a]; });
    if (!cats.length) { container.appendChild(emptyNote("Няма данни.")); return; }
    cats.forEach(function (id) {
      var amount = catTotals[id];
      var share = pct(amount, stats.budget);
      container.appendChild(makeBarRow(categoryName(id), share, formatMoney(amount) + " · " + fmtPct(share), "warn"));
    });
  }

  // ---------- Rendering: breakdown ----------
  function renderBreakdown(expenses) {
    var total = expenses.reduce(function (s, e) { return s + e.amount; }, 0);
    renderGroupList($("breakdownCategory"), groupTotals(expenses, function (e) { return e.category || "other"; }), total, categoryName);
    renderGroupList($("breakdownRoom"), groupTotals(expenses, function (e) { return e.rooms.length ? e.rooms : ["other"]; }), total, roomName);
  }

  function renderGroupList(container, map, total, nameFn) {
    clearChildren(container);
    var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; });
    if (!keys.length) { container.appendChild(emptyNote("Няма данни.")); return; }
    keys.forEach(function (id) {
      var amount = map[id];
      var p = total > 0 ? pct(amount, total) : 0;
      var row = el("div", "bd-row");
      row.appendChild(el("span", "bd-name", nameFn(id)));
      row.appendChild(el("span", "bd-amount", formatMoney(amount)));
      row.appendChild(el("span", "bd-pct", fmtPct(p)));
      container.appendChild(row);
    });
  }

  // ---------- Rendering: charts ----------
  function renderCharts(expenses) {
    var total = expenses.reduce(function (s, e) { return s + e.amount; }, 0);
    renderBarChart($("chartCategory"), groupTotals(expenses, function (e) { return e.category || "other"; }), total, categoryName);
    renderBarChart($("chartRoom"), groupTotals(expenses, function (e) { return e.rooms.length ? e.rooms : ["other"]; }), total, roomName, "alt");
    renderTimeChart($("chartTime"), monthlyTotals(expenses));
  }

  function renderBarChart(container, map, total, nameFn, extraClass) {
    clearChildren(container);
    var keys = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; });
    if (!keys.length) { container.appendChild(emptyNote("Няма данни за графика.")); return; }
    var max = keys.reduce(function (m, k) { return Math.max(m, map[k]); }, 0);
    keys.forEach(function (id) {
      var amount = map[id];
      var share = total > 0 ? pct(amount, total) : 0;
      var width = max > 0 ? (amount / max) * 100 : 0;
      var row = el("div", "bar-row");
      row.appendChild(el("span", "bar-label", nameFn(id)));
      var track = el("div", "bar-track");
      var fill = el("div", "bar-fill" + (extraClass ? " " + extraClass : ""));
      fill.style.width = width + "%";
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el("span", "bar-value", formatMoney(amount) + " · " + fmtPct(share)));
      container.appendChild(row);
    });
  }

  function makeBarRow(label, percent, valueText, fillClass) {
    var row = el("div", "bar-row");
    row.appendChild(el("span", "bar-label", label));
    var track = el("div", "bar-track");
    var fill = el("div", "bar-fill" + (fillClass ? " " + fillClass : ""));
    fill.style.width = Math.min(percent, 100) + "%";
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el("span", "bar-value", valueText));
    return row;
  }

  function renderTimeChart(container, series) {
    clearChildren(container);
    if (!series.length) { container.appendChild(emptyNote("Няма данни за графика.")); return; }

    var W = Math.max(480, container.clientWidth || 600);
    var H = 220, padL = 48, padR = 16, padT = 16, padB = 28;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var maxY = series.reduce(function (m, p) { return Math.max(m, p.cumulative); }, 0) || 1;
    // Nice round max
    var niceMax = Math.ceil(maxY / 500) * 500 || 500;

    var xStep = series.length > 1 ? plotW / (series.length - 1) : 0;
    function x(i) { return padL + (series.length > 1 ? i * xStep : plotW / 2); }
    function y(v) { return padT + plotH - (v / niceMax) * plotH; }

    var svgNs = "http://www.w3.org/2000/svg";
    function svg(tag, attrs) {
      var n = document.createElementNS(svgNs, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    }

    var svgEl = svg("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });

    // Grid lines + Y labels
    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var val = (niceMax / ticks) * t;
      var yy = y(val);
      svgEl.appendChild(svg("line", { x1: padL, y1: yy, x2: W - padR, y2: yy, class: "grid-line" }));
      var lbl = svg("text", { x: padL - 6, y: yy + 3, "text-anchor": "end", class: "axis-text" });
      lbl.textContent = Math.round(val);
      svgEl.appendChild(lbl);
    }

    // Area + line path
    var lineD = "", areaD = "";
    series.forEach(function (p, i) {
      var xx = x(i), yy = y(p.cumulative);
      lineD += (i ? " L" : "M") + xx.toFixed(1) + " " + yy.toFixed(1);
    });
    areaD = "M" + x(0).toFixed(1) + " " + y(0).toFixed(1) + " L" + series.map(function (p, i) {
      return x(i).toFixed(1) + " " + y(p.cumulative).toFixed(1);
    }).join(" L") + " L" + x(series.length - 1).toFixed(1) + " " + y(0).toFixed(1) + " Z";

    svgEl.appendChild(svg("path", { d: areaD, class: "area" }));
    svgEl.appendChild(svg("path", { d: lineD, class: "line" }));

    // Dots + X labels
    series.forEach(function (p, i) {
      var xx = x(i), yy = y(p.cumulative);
      svgEl.appendChild(svg("circle", { cx: xx.toFixed(1), cy: yy.toFixed(1), r: 3, class: "dot" }));
      if (series.length <= 12 || i % Math.ceil(series.length / 8) === 0) {
        var lbl = svg("text", { x: xx.toFixed(1), y: H - 8, "text-anchor": "middle", class: "axis-text" });
        lbl.textContent = p.month;
        svgEl.appendChild(lbl);
      }
    });

    container.appendChild(svgEl);
  }

  // ---------- Rendering: expenses table ----------
  function renderTable(expenses) {
    var tbody = $("expensesBody");
    clearChildren(tbody);

    if (!expenses.length) {
      var tr = el("tr");
      var td = el("td", null, "");
      td.colSpan = 7;
      td.appendChild(emptyNote("Няма разходи, отговарящи на филтрите."));
      td.style.textAlign = "center";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    var sorted = expenses.slice().sort(function (a, b) {
      var dir = SORT.dir === "asc" ? 1 : -1;
      switch (SORT.by) {
        case "amount": return (a.amount - b.amount) * dir;
        case "category": return (a.category || "").localeCompare(b.category || "") * dir;
        case "room": return (a.rooms[0] || "").localeCompare(b.rooms[0] || "") * dir;
        case "date":
        default:
          var ta = parseDate(a.date) ? parseDate(a.date).getTime() : 0;
          var tb = parseDate(b.date) ? parseDate(b.date).getTime() : 0;
          return (ta - tb) * dir;
      }
    });

    sorted.forEach(function (e) {
      var tr = el("tr");
      // Thumbnail cell
      var thumbTd = el("td", "thumb-cell");
      if (e.thumbnail) {
        var img = el("img", "row-thumb");
        img.src = e.thumbnail;
        img.alt = e.description || "";
        img.loading = "lazy";
        thumbTd.appendChild(img);
      } else {
        thumbTd.appendChild(el("span", "thumb-placeholder", ""));
      }
      tr.appendChild(thumbTd);
      tr.appendChild(el("td", null, formatDate(e.date)));
      tr.appendChild(el("td", "desc", e.description || "—"));
      tr.appendChild(el("td", null, e.vendor || "—"));
      tr.appendChild(el("td", null, e.rooms.map(roomName).join(", ") || "—"));
      tr.appendChild(el("td", null, categoryName(e.category)));
      var amt = el("td", "num", formatMoney(e.amount));
      tr.appendChild(amt);
      tr.addEventListener("click", function () { showExpenseDetail(e); });
      tbody.appendChild(tr);
    });
  }

  // ---------- Expense detail modal ----------
  function showExpenseDetail(e) {
    var body = $("modalBody");
    clearChildren(body);

    function dlRow(label, valueNode) {
      var dt = el("dt", null, label);
      var dd = el("dd");
      if (typeof valueNode === "string") dd.textContent = valueNode;
      else if (valueNode) dd.appendChild(valueNode);
      body.appendChild(dt);
      body.appendChild(dd);
    }

    dlRow("ID", e.id);
    dlRow("Дата", formatDate(e.date));
    dlRow("Сума", formatMoney(e.amount) + (e.quantity > 1 ? " × " + e.quantity : ""));
    dlRow("Валута", e.currency);
    dlRow("Категория", categoryName(e.category));

    var roomsNode = el("div", "rooms-tags");
    e.rooms.forEach(function (r) { roomsNode.appendChild(el("span", "tag", roomName(r))); });
    dlRow("Стая/стаи", roomsNode.childNodes.length ? roomsNode : "—");

    dlRow("Описание", e.description || "—");
    dlRow("Доставчик", e.vendor || "—");
    if (e.order_number) dlRow("Поръчка №", e.order_number);
    dlRow("Метод на плащане", e.payment_method || "—");

    var st = statusLabel(e);
    var pill = el("span", "status-pill " + st.cls, st.text);
    dlRow("Статус", pill);

    if (e.thumbnail) {
      var thumbImg = el("img", "modal-thumb");
      thumbImg.src = e.thumbnail;
      thumbImg.alt = e.description || "";
      dlRow("Снимка", thumbImg);
    }

    if (e.receipt) {
      var a = el("a");
      a.href = e.receipt;
      a.textContent = e.receipt;
      a.target = "_blank";
      dlRow("Касов бон", a);
    } else {
      dlRow("Касов бон", "—");
    }
    if (e.url) {
      var a2 = el("a");
      a2.href = e.url;
      a2.textContent = e.url;
      a2.target = "_blank";
      dlRow("Линк", a2);
    }
    if (e.notes) {
      var notesBox = el("div", "notes", e.notes);
      body.appendChild(notesBox);
    }

    $("modal").classList.remove("hidden");
  }

  function closeModal() { $("modal").classList.add("hidden"); }

  // ---------- Empty / banner helpers ----------
  function emptyNote(text) {
    var wrap = el("div", "empty-state");
    wrap.appendChild(el("h3", null, "Няма данни"));
    wrap.appendChild(el("p", null, text));
    return wrap;
  }

  function showBanner(type, html) {
    var b = $("banner");
    b.className = "banner " + (type || "");
    b.innerHTML = html;
    b.classList.remove("hidden");
  }
  function hideBanner() { $("banner").classList.add("hidden"); }

  function showEmptyState() {
    var main = document.querySelector(".container");
    // Hide data panels except banner area
    var sections = main.querySelectorAll(":scope > section");
    sections.forEach(function (s) { s.style.display = "none"; });
    showBanner("info", "<strong>Все още няма регистрирани разходи.</strong> Добавете записи в <code>renovation.json</code> под масива <code>expenses</code>, за да видите статистики.");
  }

  // ---------- Main render ----------
  function renderAll() {
    var expenses = filteredExpenses();
    var stats = computeStats(expenses);
    renderHeader(stats);
    renderSummaryCards(stats);
    renderBudgetAnalysis(stats, expenses);
    renderBreakdown(expenses);
    renderCharts(expenses);
    renderTable(expenses);
    if (stats.count === 0 && DATA.expenses.length === 0) {
      // Truly empty dataset
    }
  }

  // ---------- Filters UI ----------
  function populateFilterOptions() {
    var catSel = $("fCategory");
    var roomSel = $("fRoom");
    clearChildren(catSel); clearChildren(roomSel);
    catSel.appendChild(new Option("Всички", ""));
    roomSel.appendChild(new Option("Всички", ""));
    (DATA.categories || []).forEach(function (c) { catSel.appendChild(new Option(c.name, c.id)); });
    (DATA.rooms || []).forEach(function (r) { roomSel.appendChild(new Option(r.name, r.id)); });
  }

  function bindFilters() {
    var inputs = document.querySelectorAll("[data-filter]");
    inputs.forEach(function (inp) {
      inp.addEventListener("change", function () {
        FILTERS[inp.getAttribute("data-filter")] = inp.value;
        renderAll();
      });
      if (inp.tagName === "INPUT") {
        inp.addEventListener("input", debounce(function () {
          FILTERS[inp.getAttribute("data-filter")] = inp.value;
          renderAll();
        }, 250));
      }
    });
    $("resetFilters").addEventListener("click", function () {
      FILTERS = { dateFrom: "", dateTo: "", category: "", room: "", vendor: "", status: "" };
      inputs.forEach(function (inp) { inp.value = ""; });
      renderAll();
    });
    $("sortBy").addEventListener("change", function () { SORT.by = this.value; renderAll(); });
    $("sortDir").addEventListener("change", function () { SORT.dir = this.value; renderAll(); });
    $("modalClose").addEventListener("click", closeModal);
    $("modalBackdrop").addEventListener("click", closeModal);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    window.addEventListener("resize", debounce(function () {
      // Re-render time chart to fit new width
      renderTimeChart($("chartTime"), monthlyTotals(filteredExpenses()));
    }, 200));
  }

  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); var ctx = this, args = arguments; t = setTimeout(function () { fn.apply(ctx, args); }, ms); };
  }

  // ---------- Init ----------
  function init() {
    fetch("renovation.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status + " — не може да се зареди renovation.json");
        return res.text();
      })
      .then(function (text) {
        var raw;
        try { raw = JSON.parse(text); }
        catch (err) { throw new Error("Невалиден JSON: " + err.message); }
        DATA = validateData(raw);
        CURRENCY = DATA.project.currency || "EUR";
        buildLookups(DATA);
        DATA.expenses = DATA.expenses.map(normalizeExpense).filter(Boolean);
        populateFilterOptions();
        bindFilters();

        setText("projectName", DATA.project.name || "Реновация");
        setText("projectSub", DATA.expenses.length + " записа · " + CURRENCY);

        if (DATA.expenses.length === 0) {
          showEmptyState();
        } else {
          hideBanner();
          renderAll();
        }
      })
      .catch(function (err) {
        setText("projectSub", "Грешка при зареждане");
        showBanner("", "<strong>Грешка при зареждане на данните.</strong><br>" + err.message +
          "<br><br>Ако отваряте <code>index.html</code> директно с <code>file://</code>, браузърът блокира зареждането на JSON. " +
          "Стартирайте локален сървър, напр. <code>python -m http.server 8000</code>, и отворете <code>http://localhost:8000/index.html</code>.");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();