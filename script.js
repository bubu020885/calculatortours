/* Besucher-Führungen-Rechner
 *
 * Zwei Modi:
 *   - Wochenauswertung: Musterwoche (Führungen je Wochentag) mit KPIs
 *   - Jahreskalender: 365/366-Tage-Tabelle mit Feiertagen und Schulferien,
 *                     letztere per API je gewähltem Bundesland.
 *
 * Feiertage  : lokal berechnet (Gauss'sche Osterformel, bundesweit DE).
 * Schulferien: OpenHolidays API (primär) mit Fallback auf ferien-api.de.
 */

(function () {
    "use strict";

    // -------- Konstanten --------
    const DAY_KEYS    = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const DAY_SHORT   = { mon: "Mo", tue: "Di", wed: "Mi", thu: "Do", fri: "Fr", sat: "Sa", sun: "So" };
    const DOW_TO_KEY  = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const DOW_SHORT   = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni",
                         "Juli", "August", "September", "Oktober", "November", "Dezember"];

    const BUNDESLAENDER = {
        BW: "Baden-Württemberg", BY: "Bayern", BE: "Berlin", BB: "Brandenburg",
        HB: "Bremen", HH: "Hamburg", HE: "Hessen", MV: "Mecklenburg-Vorpommern",
        NI: "Niedersachsen", NW: "Nordrhein-Westfalen", RP: "Rheinland-Pfalz", SL: "Saarland",
        SN: "Sachsen", ST: "Sachsen-Anhalt", SH: "Schleswig-Holstein", TH: "Thüringen"
    };

    // -------- Zustand --------
    const state = {
        weekTours: Object.fromEntries(DAY_KEYS.map((k) => [k, 0])),
        yearDays: [],       // [{ key, date, dow, ph, sh, tours, level, notes }]
        publicMap: {},      // "YYYY-MM-DD" -> Name
        schoolMap: {},      // "YYYY-MM-DD" -> Name
        currentYear: null,
        currentState: "",
        currentView: "week",
        loading: false,
    };

    // -------- DOM Refs --------
    const $ = (id) => document.getElementById(id);

    // -------- Helpers --------
    function clampInt(v, min, max) {
        const n = parseInt(v, 10);
        if (Number.isNaN(n)) return min;
        return Math.min(Math.max(n, min), max);
    }
    const groupSize = () => clampInt($("groupSize").value, 1, 9999);
    const duration  = () => clampInt($("tourDuration").value, 1, 1440);
    const levels = () => ({
        low:    clampInt($("levelLow").value, 0, 99),
        medium: clampInt($("levelMedium").value, 0, 99),
        high:   clampInt($("levelHigh").value, 0, 99),
    });
    const levelPreset = (kind) => {
        const l = levels();
        return l[kind] || 0;
    };
    function inferLevel(tours) {
        const l = levels();
        if (tours <= 0)        return "none";
        if (tours === l.low)   return "low";
        if (tours === l.medium) return "medium";
        if (tours === l.high)  return "high";
        return "custom";
    }
    function classifyWeek(tours, l) {
        if (tours <= 0)          return { key: "none",   label: "–" };
        if (tours >  l.high)     return { key: "over",   label: "ÜBER HIGH" };
        if (tours >= l.high)     return { key: "high",   label: "HIGH" };
        if (tours >= l.medium)   return { key: "medium", label: "MEDIUM" };
        if (tours >= l.low)      return { key: "low",    label: "LOW" };
        return { key: "low", label: "< LOW" };
    }
    function formatDuration(mins) {
        if (!mins) return "0 h";
        const h = Math.floor(mins / 60), m = mins % 60;
        if (h === 0) return `${m} min`;
        if (m === 0) return `${h} h`;
        return `${h} h ${m} min`;
    }
    function formatHours(mins) {
        if (!mins) return "0 h";
        const h = mins / 60;
        const txt = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ",");
        return `${txt} h`;
    }
    function keyFor(d) {
        return d.getFullYear() + "-" +
               String(d.getMonth() + 1).padStart(2, "0") + "-" +
               String(d.getDate()).padStart(2, "0");
    }
    function parseKey(k) {
        const [y, m, d] = k.split("-").map(Number);
        return new Date(y, m - 1, d);
    }
    function formatDate(d) {
        return String(d.getDate()).padStart(2, "0") + "." +
               String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
    }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        }[c]));
    }

    // -------- Feiertage (bundesweit) --------
    function easterSunday(y) {
        const a = y % 19;
        const b = Math.floor(y / 100);
        const c = y % 100;
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
        return new Date(y, month - 1, day);
    }
    function getPublicHolidays(year) {
        const e = easterSunday(year);
        const map = {};
        const add   = (d, n) => { map[keyFor(d)] = n; };
        const fixed = (mo, dy, n) => add(new Date(year, mo - 1, dy), n);
        const rel   = (days, n) => { const d = new Date(e); d.setDate(d.getDate() + days); add(d, n); };
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

    // -------- Schulferien-API --------
    async function fetchSchool(year, sc) {
        if (!sc) return null;
        const sub = "DE-" + sc;
        // Primär: OpenHolidays API
        try {
            const url1 = "https://openholidaysapi.org/SchoolHolidays" +
                "?countryIsoCode=DE&languageIsoCode=DE" +
                "&validFrom=" + year + "-01-01&validTo=" + year + "-12-31" +
                "&subdivisionCode=" + sub;
            const r = await fetch(url1, { headers: { Accept: "application/json" } });
            if (r.ok) return { src: "oh", data: await r.json() };
        } catch (e) { /* Fallback unten */ }
        // Fallback: ferien-api.de
        try {
            const url2 = "https://ferien-api.de/api/v1/holidays/" + sc + "/" + year;
            const r2 = await fetch(url2);
            if (r2.ok) return { src: "fa", data: await r2.json() };
        } catch (e) { /* aufgeben */ }
        return null;
    }
    function buildSchoolMap(resp) {
        const map = {};
        if (!resp || !resp.data) return map;
        const addRange = (startStr, endStr, name) => {
            const s = parseKey(startStr.slice(0, 10));
            const e = parseKey(endStr.slice(0, 10));
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
                const k = keyFor(d);
                if (!map[k]) map[k] = name;
                else if (!map[k].includes(name)) map[k] = map[k] + " · " + name;
            }
        };
        if (resp.src === "oh") {
            (resp.data || []).forEach((h) => {
                let name = "Ferien";
                if (Array.isArray(h.name)) {
                    const de = h.name.find((n) => n.language === "DE") || h.name[0];
                    if (de && de.text) name = de.text;
                }
                addRange(h.startDate, h.endDate, name);
            });
        } else if (resp.src === "fa") {
            (resp.data || []).forEach((h) => {
                const start = (h.start || "").slice(0, 10);
                const end   = (h.end   || "").slice(0, 10);
                if (start && end) addRange(start, end, h.name || "Ferien");
            });
        }
        return map;
    }

    // -------- Musterwoche --------
    function initTemplate() {
        const grid = $("templateGrid");
        grid.innerHTML = "";
        DAY_KEYS.forEach((k) => {
            const div = document.createElement("div");
            div.className = "tpl-day";
            div.innerHTML = `
                <label>${DAY_SHORT[k]}</label>
                <input type="number" min="0" max="99" value="0" data-day="${k}" class="tpl-input">
                <div class="tpl-quick">
                    <button type="button" class="q-low"    data-day="${k}" data-lvl="low">LOW</button>
                    <button type="button" class="q-medium" data-day="${k}" data-lvl="medium">MED</button>
                    <button type="button" class="q-high"   data-day="${k}" data-lvl="high">HIGH</button>
                </div>
                <div class="tpl-tag" data-day="${k}">–</div>
            `;
            grid.appendChild(div);
        });
        grid.querySelectorAll(".tpl-input").forEach((inp) => {
            inp.addEventListener("input", () => {
                state.weekTours[inp.dataset.day] = clampInt(inp.value, 0, 99);
                renderWeek();
            });
        });
        grid.querySelectorAll(".tpl-quick button").forEach((b) => {
            b.addEventListener("click", () => {
                state.weekTours[b.dataset.day] = levelPreset(b.dataset.lvl);
                renderWeek();
            });
        });
    }

    function renderWeek() {
        const gs = groupSize(), dur = duration(), lvl = levels();
        let totalTours = 0;
        const buckets = { none: 0, low: 0, medium: 0, high: 0, over: 0 };

        DAY_KEYS.forEach((k) => {
            const t = state.weekTours[k];
            const inp = document.querySelector(`.tpl-input[data-day="${k}"]`);
            if (inp && parseInt(inp.value, 10) !== t) inp.value = t;
            const tag = document.querySelector(`.tpl-tag[data-day="${k}"]`);
            const cls = classifyWeek(t, lvl);
            if (tag) {
                tag.className = "tpl-tag occ-" + cls.key;
                tag.textContent = cls.label;
            }
            totalTours += t;
            buckets[cls.key] = (buckets[cls.key] || 0) + 1;
        });

        $("kpiTours").textContent    = totalTours.toString();
        $("kpiVisitors").textContent = (totalTours * gs).toString();
        $("kpiHours").textContent    = formatDuration(totalTours * dur);
        $("kpiLoad").textContent     = avgLoadLabel(buckets);
    }

    function avgLoadLabel(b) {
        const w = { low: 1, medium: 2, high: 3, over: 4 };
        let s = 0, c = 0;
        for (const k of Object.keys(w)) {
            s += (b[k] || 0) * w[k];
            c += (b[k] || 0);
        }
        if (!c) return "–";
        const a = s / c;
        if (a >= 3.5) return "ÜBER HIGH";
        if (a >= 2.5) return "HIGH";
        if (a >= 1.5) return "MEDIUM";
        return "LOW";
    }

    // -------- Jahreskalender --------
    async function generateYear() {
        if (state.loading) return;
        const year = clampInt($("yearSelect").value, 2000, 2099);
        const sc   = $("stateSelect").value;
        state.currentYear  = year;
        state.currentState = sc;
        state.publicMap    = getPublicHolidays(year);

        if (sc) {
            setInfo("Lade Schulferien für " + BUNDESLAENDER[sc] + " " + year + " …", "loading");
            state.loading = true;
            setButtonsDisabled(true);
            const resp = await fetchSchool(year, sc);
            state.schoolMap = buildSchoolMap(resp);
            state.loading = false;
            setButtonsDisabled(false);
            if (resp) {
                const src = resp.src === "oh" ? "openholidaysapi.org" : "ferien-api.de";
                setInfo("Feiertage und Schulferien für " + BUNDESLAENDER[sc] + " " +
                        year + " geladen (Quelle: " + src + ").", "success");
            } else {
                setInfo("Schulferien-API für " + BUNDESLAENDER[sc] +
                        " nicht erreichbar – es werden nur bundesweite Feiertage angezeigt.", "warning");
            }
        } else {
            state.schoolMap = {};
            setInfo("Kein Bundesland ausgewählt – es werden nur bundesweite Feiertage angezeigt.", "");
        }

        buildYearDays(year);
        applyTemplateToYear(false);
        renderYearTable();
        renderYearKpis();
    }

    function buildYearDays(year) {
        state.yearDays = [];
        const end = new Date(year + 1, 0, 1);
        for (let d = new Date(year, 0, 1); d < end; d.setDate(d.getDate() + 1)) {
            const k = keyFor(d);
            state.yearDays.push({
                key: k,
                date: new Date(d),
                dow: d.getDay(),
                ph: state.publicMap[k] || "",
                sh: state.schoolMap[k] || "",
                tours: 0,
                level: "none",
                notes: "",
            });
        }
    }

    function applyTemplateToYear(updateDOM) {
        if (state.yearDays.length === 0) {
            // wenn noch kein Jahr generiert ist: generieren, dann anwenden
            generateYear();
            return;
        }
        const excludeHol = $("excludeHolidays").checked;
        state.yearDays.forEach((day) => {
            const wk = DOW_TO_KEY[day.dow];
            if (excludeHol && day.ph) {
                day.tours = 0;
            } else {
                day.tours = state.weekTours[wk] || 0;
            }
            day.level = inferLevel(day.tours);
        });
        if (updateDOM !== false) {
            renderYearTable();
            renderYearKpis();
        }
    }

    function renderYearTable() {
        const tbody = $("dayTableBody");
        tbody.innerHTML = "";
        const frag = document.createDocumentFragment();
        let lastMonth = -1;
        state.yearDays.forEach((day) => {
            const month = day.date.getMonth();
            if (month !== lastMonth) {
                lastMonth = month;
                const mr = document.createElement("tr");
                mr.className = "month-header";
                mr.innerHTML = `<td colspan="8">${MONTH_NAMES[month]} ${day.date.getFullYear()}</td>`;
                frag.appendChild(mr);
            }
            frag.appendChild(buildRow(day));
        });
        tbody.appendChild(frag);
        state.yearDays.forEach(updateRow);
    }

    function buildRow(day) {
        const tr = document.createElement("tr");
        tr.dataset.key = day.key;
        if (day.dow === 0 || day.dow === 6) tr.classList.add("weekend");
        if (day.ph) tr.classList.add("holiday");
        if (day.sh) tr.classList.add("school-holiday");

        tr.innerHTML = `
            <td>${formatDate(day.date)}</td>
            <td>${DOW_SHORT[day.dow]}</td>
            <td class="holiday-cell">
                ${day.ph ? `<span class="ph">${escapeHtml(day.ph)}</span>` : ""}
                ${day.ph && day.sh ? "<br>" : ""}
                ${day.sh ? `<span class="sh">${escapeHtml(day.sh)}</span>` : ""}
            </td>
            <td>
                <select class="occupancy-select" data-role="level">
                    <option value="none">Keine</option>
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                    <option value="custom">Manuell</option>
                </select>
            </td>
            <td><input type="number" min="0" max="99" class="tour-input" data-role="tours"></td>
            <td class="visitors-cell" data-role="guests">0</td>
            <td class="visitors-cell hours-cell" data-role="staff">0 h</td>
            <td><input type="text" class="note-input" data-role="notes" placeholder="Notizen"></td>
        `;

        tr.querySelector("[data-role=level]").addEventListener("change", (e) => {
            const v = e.target.value;
            day.level = v;
            if (v === "none") day.tours = 0;
            else if (v !== "custom") day.tours = levelPreset(v);
            updateRow(day);
            renderYearKpis();
        });
        tr.querySelector("[data-role=tours]").addEventListener("input", (e) => {
            day.tours = clampInt(e.target.value, 0, 99);
            day.level = inferLevel(day.tours);
            updateRow(day);
            renderYearKpis();
        });
        tr.querySelector("[data-role=notes]").addEventListener("input", (e) => {
            day.notes = e.target.value;
        });
        return tr;
    }

    function updateRow(day) {
        const tr = document.querySelector(`tr[data-key="${day.key}"]`);
        if (!tr) return;
        const selLvl     = tr.querySelector("[data-role=level]");
        const inpTours   = tr.querySelector("[data-role=tours]");
        const guestsCell = tr.querySelector("[data-role=guests]");
        const staffCell  = tr.querySelector("[data-role=staff]");
        const notesInp   = tr.querySelector("[data-role=notes]");

        selLvl.value = day.level;
        selLvl.setAttribute("data-occ", day.level);
        if (parseInt(inpTours.value, 10) !== day.tours) inpTours.value = day.tours;
        if (notesInp.value !== day.notes) notesInp.value = day.notes;
        guestsCell.textContent = (day.tours * groupSize()).toString();
        staffCell.textContent  = formatHours(day.tours * duration());
    }

    function renderYearKpis() {
        let totalTours = 0, activeDays = 0;
        state.yearDays.forEach((d) => {
            totalTours += d.tours;
            if (d.tours > 0) activeDays++;
        });
        $("yearKpiTours").textContent  = totalTours.toString();
        $("yearKpiGuests").textContent = (totalTours * groupSize()).toString();
        $("yearKpiHours").textContent  = formatHours(totalTours * duration());
        $("yearKpiDays").textContent   = activeDays.toString();
    }

    function resetYear() {
        if (state.yearDays.length === 0) return;
        state.yearDays.forEach((d) => {
            d.tours = 0;
            d.level = "none";
            d.notes = "";
        });
        renderYearTable();
        renderYearKpis();
    }

    // -------- Info / UI --------
    function setInfo(msg, type) {
        const el = $("infoMsg");
        el.textContent = msg;
        el.className = "info-msg" + (type ? " " + type : "");
    }

    function setButtonsDisabled(dis) {
        ["generateBtn", "applyTemplateBtn", "resetYearBtn"].forEach((id) => {
            $(id).disabled = dis;
        });
    }

    function switchView(view) {
        state.currentView = view;
        document.querySelectorAll(".tab-btn").forEach((b) => {
            b.classList.toggle("is-active", b.dataset.view === view);
        });
        document.querySelectorAll(".view").forEach((v) => {
            v.hidden = !v.classList.contains("view-" + view);
        });
        if (view === "year" && state.currentYear === null) {
            generateYear();
        }
    }

    // -------- Init --------
    function init() {
        initTemplate();
        renderWeek();

        // Live-Updates für Grundeinstellungen
        ["groupSize", "tourDuration", "levelLow", "levelMedium", "levelHigh"].forEach((id) => {
            $(id).addEventListener("input", () => {
                renderWeek();
                if (state.yearDays.length > 0) {
                    state.yearDays.forEach((d) => { d.level = inferLevel(d.tours); });
                    state.yearDays.forEach(updateRow);
                    renderYearKpis();
                }
            });
        });

        // Bulk-Buttons Musterwoche
        document.querySelectorAll("[data-bulk]").forEach((b) => {
            b.addEventListener("click", () => {
                const v = b.dataset.bulk === "zero" ? 0 : levelPreset(b.dataset.bulk);
                DAY_KEYS.forEach((k) => { state.weekTours[k] = v; });
                renderWeek();
            });
        });

        // Tabs
        document.querySelectorAll(".tab-btn").forEach((b) => {
            b.addEventListener("click", () => switchView(b.dataset.view));
        });

        // Jahreskalender-Aktionen
        $("generateBtn").addEventListener("click", () => {
            generateYear();
            if (state.currentView !== "year") switchView("year");
        });
        $("applyTemplateBtn").addEventListener("click", () => applyTemplateToYear(true));
        $("resetYearBtn").addEventListener("click", resetYear);

        // bei Jahr/Bundesland-Änderung: wenn bereits generiert, neu laden
        $("yearSelect").addEventListener("change", () => {
            if (state.currentYear !== null) generateYear();
        });
        $("stateSelect").addEventListener("change", () => {
            if (state.currentYear !== null) generateYear();
        });
        $("excludeHolidays").addEventListener("change", () => {
            if (state.yearDays.length > 0) applyTemplateToYear(true);
        });
    }

    init();
})();
