/* Besucher-Führungen-Rechner
 *
 * Zwei Modi:
 *   - Wochenplanung: Führungen je Wochentag (Musterwoche), Auslastungsampel, KPIs
 *   - Jahresplanung: 365/366-Tage-Tabelle mit Feiertagen, Auslastung,
 *                    Gästeprognose und MA-Stunden. Musterwoche kann per
 *                    Button auf das ganze Jahr übertragen werden.
 */

(function () {
    "use strict";

    // -------- Konstanten --------
    const DAYS = [
        { key: "mon", label: "Mo" },
        { key: "tue", label: "Di" },
        { key: "wed", label: "Mi" },
        { key: "thu", label: "Do" },
        { key: "fri", label: "Fr" },
        { key: "sat", label: "Sa" },
        { key: "sun", label: "So" },
    ];
    const DOW_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const DOW_TO_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    // -------- Zustand --------
    const dayTours = Object.fromEntries(DAYS.map((d) => [d.key, 0]));
    const yearPlan = {}; // key "YYYY-MM-DD" -> { tours, level, notes }
    let holidaysMap = {};
    let currentYear = null;

    // -------- DOM Refs --------
    const $ = (id) => document.getElementById(id);
    const elGroupSize   = $("groupSize");
    const elDuration    = $("tourDuration");
    const elLow         = $("levelLow");
    const elMedium      = $("levelMedium");
    const elHigh        = $("levelHigh");
    const elDaysGrid    = $("daysGrid");
    const elKpiTours    = $("kpiTours");
    const elKpiVisitors = $("kpiVisitors");
    const elKpiHours    = $("kpiHours");
    const elKpiLoad     = $("kpiLoad");

    const elYearSelect  = $("yearSelect");
    const elExcludeHol  = $("excludeHolidays");
    const elApplyTpl    = $("applyTemplateBtn");
    const elClearYear   = $("clearYearBtn");
    const elYearBody    = $("yearTableBody");
    const elYearKTours  = $("yearKpiTours");
    const elYearKGuests = $("yearKpiGuests");
    const elYearKHours  = $("yearKpiHours");
    const elYearKDays   = $("yearKpiDays");

    // -------- Bindings --------
    [elGroupSize, elDuration, elLow, elMedium, elHigh].forEach((el) => {
        el.addEventListener("input", () => {
            renderWeek();
            if (currentYear !== null) {
                renderYearAll();
                renderYearTotals();
            }
        });
    });

    document.querySelectorAll("[data-bulk]").forEach((btn) => {
        btn.addEventListener("click", () => applyBulk(btn.dataset.bulk));
    });

    document.querySelectorAll("#modeTabs .tab").forEach((tab) => {
        tab.addEventListener("click", () => switchView(tab.dataset.view));
    });

    elYearSelect.addEventListener("change", () => {
        const y = clampInt(elYearSelect.value, 2000, 2099);
        if (y !== currentYear) buildYear(y);
    });

    elApplyTpl.addEventListener("click", () => applyTemplateToYear());
    elClearYear.addEventListener("click", () => {
        Object.keys(yearPlan).forEach((k) => {
            yearPlan[k].tours = 0;
            yearPlan[k].level = "none";
        });
        renderYearAll();
        renderYearTotals();
    });

    // -------- Helpers --------
    function clampInt(value, min, max) {
        const n = parseInt(value, 10);
        if (Number.isNaN(n)) return min;
        return Math.min(Math.max(n, min), max);
    }

    const getGroupSize = () => clampInt(elGroupSize.value, 1, 9999);
    const getDuration  = () => clampInt(elDuration.value, 1, 1440);
    const getLevels = () => ({
        low:    clampInt(elLow.value,    0, 99),
        medium: clampInt(elMedium.value, 0, 99),
        high:   clampInt(elHigh.value,   0, 99),
    });

    function levelPreset(kind) {
        const lvl = getLevels();
        if (kind === "low")    return lvl.low;
        if (kind === "medium") return lvl.medium;
        if (kind === "high")   return lvl.high;
        return 0;
    }

    function inferLevel(tours) {
        const lvl = getLevels();
        if (tours <= 0)           return "none";
        if (tours === lvl.low)    return "low";
        if (tours === lvl.medium) return "medium";
        if (tours === lvl.high)   return "high";
        return "custom";
    }

    function classifyDay(tours, lvl) {
        if (tours <= 0)          return { key: "none",   label: "–" };
        if (tours >  lvl.high)   return { key: "over",   label: "ÜBER HIGH" };
        if (tours >= lvl.high)   return { key: "high",   label: "HIGH" };
        if (tours >= lvl.medium) return { key: "medium", label: "MEDIUM" };
        if (tours >= lvl.low)    return { key: "low",    label: "LOW" };
        return { key: "low", label: "< LOW" };
    }

    function formatDuration(minutes) {
        if (!minutes) return "0 h";
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h === 0) return `${m} min`;
        if (m === 0) return `${h} h`;
        return `${h} h ${m} min`;
    }

    function formatHours(minutes) {
        if (!minutes) return "0 h";
        const hours = minutes / 60;
        const txt = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(".", ",");
        return `${txt} h`;
    }

    function keyFor(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function formatDate(date) {
        return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
    }

    function parseKey(key) {
        const [y, m, d] = key.split("-").map(Number);
        return new Date(y, m - 1, d);
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));
    }

    // -------- Wochenplanung --------
    function buildDayCards() {
        elDaysGrid.innerHTML = "";
        DAYS.forEach((day) => {
            const card = document.createElement("div");
            card.className = "day";
            card.dataset.day = day.key;
            card.innerHTML = `
                <div class="day-name">
                    <span>${day.label}</span>
                    <span class="day-tag" data-role="tag">–</span>
                </div>
                <input type="number" min="0" max="99" value="0" data-role="input" aria-label="Führungen ${day.label}">
                <div class="day-quick">
                    <button type="button" class="q-low"    data-level="low">LOW</button>
                    <button type="button" class="q-medium" data-level="medium">MED</button>
                    <button type="button" class="q-high"   data-level="high">HIGH</button>
                </div>
                <div class="day-info" data-role="info"></div>
            `;
            card.querySelector("[data-role=input]").addEventListener("input", (e) => {
                dayTours[day.key] = clampInt(e.target.value, 0, 99);
                renderWeek();
            });
            card.querySelectorAll(".day-quick button").forEach((btn) => {
                btn.addEventListener("click", () => {
                    dayTours[day.key] = levelPreset(btn.dataset.level);
                    renderWeek();
                });
            });
            elDaysGrid.appendChild(card);
        });
    }

    function applyBulk(kind) {
        const value = kind === "zero" ? 0 : levelPreset(kind);
        DAYS.forEach((d) => (dayTours[d.key] = value));
        renderWeek();
    }

    function renderWeek() {
        const groupSize = getGroupSize();
        const duration  = getDuration();
        const lvl = getLevels();

        let totalTours = 0;
        const buckets = { low: 0, medium: 0, high: 0, over: 0, none: 0 };

        DAYS.forEach((day) => {
            const card  = elDaysGrid.querySelector(`.day[data-day="${day.key}"]`);
            if (!card) return;
            const input = card.querySelector("[data-role=input]");
            const tag   = card.querySelector("[data-role=tag]");
            const info  = card.querySelector("[data-role=info]");

            const tours = dayTours[day.key];
            if (parseInt(input.value, 10) !== tours) input.value = tours;

            const cls = classifyDay(tours, lvl);
            card.classList.remove("is-low", "is-medium", "is-high", "is-over");
            if (cls.key !== "none") card.classList.add(`is-${cls.key}`);

            tag.className = "day-tag " + (cls.key === "none" ? "" : cls.key);
            tag.textContent = cls.label;

            info.innerHTML = tours > 0
                ? `${tours * groupSize} Besucher<br>${formatDuration(tours * duration)}`
                : "Keine Führungen";

            totalTours += tours;
            buckets[cls.key] = (buckets[cls.key] || 0) + 1;
        });

        elKpiTours.textContent    = totalTours.toString();
        elKpiVisitors.textContent = (totalTours * groupSize).toString();
        elKpiHours.textContent    = formatDuration(totalTours * duration);
        elKpiLoad.textContent     = avgLoadLabel(buckets);
    }

    function avgLoadLabel(buckets) {
        const weights = { low: 1, medium: 2, high: 3, over: 4 };
        let sum = 0, count = 0;
        for (const k of Object.keys(weights)) {
            sum   += (buckets[k] || 0) * weights[k];
            count += (buckets[k] || 0);
        }
        if (count === 0) return "–";
        const avg = sum / count;
        if (avg >= 3.5) return "ÜBER HIGH";
        if (avg >= 2.5) return "HIGH";
        if (avg >= 1.5) return "MEDIUM";
        return "LOW";
    }

    // -------- Feiertage (Deutschland, bundesweit) --------
    function easterSunday(year) {
        // Gauss'sche Osterformel
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const L = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * L) / 451);
        const month = Math.floor((h + L - 7 * m + 114) / 31);
        const day = ((h + L - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    function germanHolidays(year) {
        const easter = easterSunday(year);
        const map = {};
        const add = (date, name) => { map[keyFor(date)] = name; };
        const fixed = (mo, dy, name) => add(new Date(year, mo - 1, dy), name);
        const rel = (days, name) => {
            const d = new Date(easter);
            d.setDate(d.getDate() + days);
            add(d, name);
        };
        fixed(1, 1,   "Neujahr");
        rel(-2,       "Karfreitag");
        rel(1,        "Ostermontag");
        fixed(5, 1,   "Tag der Arbeit");
        rel(39,       "Christi Himmelfahrt");
        rel(50,       "Pfingstmontag");
        fixed(10, 3,  "Tag der Deutschen Einheit");
        fixed(12, 25, "1. Weihnachtstag");
        fixed(12, 26, "2. Weihnachtstag");
        return map;
    }

    // -------- Jahresplanung --------
    function switchView(view) {
        document.querySelectorAll("#modeTabs .tab").forEach((t) => {
            t.classList.toggle("is-active", t.dataset.view === view);
        });
        document.querySelectorAll(".view").forEach((el) => {
            el.hidden = !el.classList.contains("view-" + view);
        });
        if (view === "year" && currentYear === null) {
            buildYear(clampInt(elYearSelect.value, 2000, 2099));
        }
    }

    function buildYear(year) {
        currentYear = year;
        holidaysMap = germanHolidays(year);
        Object.keys(yearPlan).forEach((k) => delete yearPlan[k]);

        const frag = document.createDocumentFragment();
        const end = new Date(year + 1, 0, 1);
        for (let d = new Date(year, 0, 1); d < end; d.setDate(d.getDate() + 1)) {
            frag.appendChild(buildRow(new Date(d)));
        }
        elYearBody.innerHTML = "";
        elYearBody.appendChild(frag);
        renderYearAll();
        renderYearTotals();
    }

    function buildRow(date) {
        const key = keyFor(date);
        const dow = date.getDay();
        const holiday = holidaysMap[key] || "";
        yearPlan[key] = { tours: 0, level: "none", notes: "" };

        const tr = document.createElement("tr");
        tr.dataset.key = key;
        if (dow === 0 || dow === 6) tr.classList.add("is-weekend");
        if (holiday) tr.classList.add("is-holiday");
        if (date.getDate() === 1) tr.classList.add("month-start");

        tr.innerHTML = `
            <td class="c-dow">${DOW_LABELS[dow]}</td>
            <td class="c-date">${formatDate(date)}</td>
            <td class="c-holiday"><input type="text" value="${escapeHtml(holiday)}" data-role="holiday" placeholder="–"></td>
            <td class="c-level">
                <select data-role="level">
                    <option value="none">—</option>
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                    <option value="custom">Manuell</option>
                </select>
            </td>
            <td class="c-tours"><input type="number" min="0" max="99" value="0" data-role="tours"></td>
            <td class="c-guests" data-role="guests">0</td>
            <td class="c-staff"  data-role="staff">0 h</td>
            <td class="c-notes"><input type="text" data-role="notes" placeholder="Notizen"></td>
        `;

        tr.querySelector("[data-role=level]").addEventListener("change", (e) => {
            const v = e.target.value;
            const p = yearPlan[key];
            if (v === "none")        p.tours = 0;
            else if (v !== "custom") p.tours = levelPreset(v);
            p.level = v;
            renderYearRow(tr, key);
            renderYearTotals();
        });
        tr.querySelector("[data-role=tours]").addEventListener("input", (e) => {
            const p = yearPlan[key];
            p.tours = clampInt(e.target.value, 0, 99);
            p.level = inferLevel(p.tours);
            renderYearRow(tr, key);
            renderYearTotals();
        });
        tr.querySelector("[data-role=notes]").addEventListener("input", (e) => {
            yearPlan[key].notes = e.target.value;
        });
        tr.querySelector("[data-role=holiday]").addEventListener("input", (e) => {
            holidaysMap[key] = e.target.value.trim();
            tr.classList.toggle("is-holiday", !!holidaysMap[key]);
        });
        return tr;
    }

    function applyTemplateToYear() {
        if (currentYear === null) return;
        const excludeHolidays = elExcludeHol.checked;
        Object.keys(yearPlan).forEach((key) => {
            const date = parseKey(key);
            const isHoliday = !!holidaysMap[key];
            const weekdayKey = DOW_TO_KEY[date.getDay()];
            const p = yearPlan[key];
            if (excludeHolidays && isHoliday) {
                p.tours = 0;
            } else {
                p.tours = dayTours[weekdayKey] || 0;
            }
            p.level = inferLevel(p.tours);
        });
        renderYearAll();
        renderYearTotals();
    }

    function renderYearAll() {
        elYearBody.querySelectorAll("tr[data-key]").forEach((tr) => {
            renderYearRow(tr, tr.dataset.key);
        });
    }

    function renderYearRow(tr, key) {
        const p = yearPlan[key];
        if (!p) return;
        const groupSize = getGroupSize();
        const duration  = getDuration();

        const toursInput = tr.querySelector("[data-role=tours]");
        const levelSel   = tr.querySelector("[data-role=level]");
        const guestsCell = tr.querySelector("[data-role=guests]");
        const staffCell  = tr.querySelector("[data-role=staff]");

        if (parseInt(toursInput.value, 10) !== p.tours) toursInput.value = p.tours;
        if (levelSel.value !== p.level) levelSel.value = p.level;
        guestsCell.textContent = (p.tours * groupSize).toString();
        staffCell.textContent  = formatHours(p.tours * duration);

        tr.classList.remove("is-level-low", "is-level-medium", "is-level-high", "is-level-custom");
        if (p.level && p.level !== "none") tr.classList.add("is-level-" + p.level);
    }

    function renderYearTotals() {
        let totalTours = 0;
        let activeDays = 0;
        Object.values(yearPlan).forEach((p) => {
            totalTours += p.tours;
            if (p.tours > 0) activeDays++;
        });
        const groupSize = getGroupSize();
        const duration  = getDuration();
        elYearKTours.textContent  = totalTours.toString();
        elYearKGuests.textContent = (totalTours * groupSize).toString();
        elYearKHours.textContent  = formatHours(totalTours * duration);
        elYearKDays.textContent   = activeDays.toString();
    }

    // -------- Init --------
    buildDayCards();
    renderWeek();
})();
