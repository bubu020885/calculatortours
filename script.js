/* Besucher-Führungen-Rechner
 * Analog zum Besucher-Budget-Rechner, aber mit Fokus auf Führungen.
 * - Eingabe: Gruppengröße, Dauer je Führung, Vorbelegung LOW/MEDIUM/HIGH
 * - Planung: Anzahl Führungen pro Wochentag
 * - Auswertung: Summen und Auslastungseinstufung je Tag
 */

(function () {
    "use strict";

    const DAYS = [
        { key: "mon", label: "Mo" },
        { key: "tue", label: "Di" },
        { key: "wed", label: "Mi" },
        { key: "thu", label: "Do" },
        { key: "fri", label: "Fr" },
        { key: "sat", label: "Sa" },
        { key: "sun", label: "So" },
    ];

    // State: Anzahl Führungen je Tag
    const dayTours = Object.fromEntries(DAYS.map((d) => [d.key, 0]));

    // DOM Refs
    const elGroupSize    = document.getElementById("groupSize");
    const elDuration     = document.getElementById("tourDuration");
    const elLow          = document.getElementById("levelLow");
    const elMedium       = document.getElementById("levelMedium");
    const elHigh         = document.getElementById("levelHigh");
    const elDaysGrid     = document.getElementById("daysGrid");
    const elKpiTours     = document.getElementById("kpiTours");
    const elKpiVisitors  = document.getElementById("kpiVisitors");
    const elKpiHours     = document.getElementById("kpiHours");
    const elKpiLoad      = document.getElementById("kpiLoad");

    // --- Setup Bindings ---
    [elGroupSize, elDuration, elLow, elMedium, elHigh].forEach((el) => {
        el.addEventListener("input", render);
    });

    document.querySelectorAll("[data-bulk]").forEach((btn) => {
        btn.addEventListener("click", () => applyBulk(btn.dataset.bulk));
    });

    // --- Wochentage initial rendern ---
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
                render();
            });

            card.querySelectorAll(".day-quick button").forEach((btn) => {
                btn.addEventListener("click", () => {
                    dayTours[day.key] = levelValue(btn.dataset.level);
                    render();
                });
            });

            elDaysGrid.appendChild(card);
        });
    }

    // --- Helpers ---
    function clampInt(value, min, max) {
        const n = parseInt(value, 10);
        if (Number.isNaN(n)) return 0;
        return Math.min(Math.max(n, min), max);
    }

    function levelValue(level) {
        switch (level) {
            case "low":    return clampInt(elLow.value, 0, 99);
            case "medium": return clampInt(elMedium.value, 0, 99);
            case "high":   return clampInt(elHigh.value, 0, 99);
            default:       return 0;
        }
    }

    function classifyDay(tours, lvl) {
        if (tours <= 0) return { key: "none",   label: "–" };
        if (tours >  lvl.high)   return { key: "over",   label: "ÜBER HIGH" };
        if (tours >= lvl.high)   return { key: "high",   label: "HIGH" };
        if (tours >= lvl.medium) return { key: "medium", label: "MEDIUM" };
        if (tours >= lvl.low)    return { key: "low",    label: "LOW" };
        return { key: "low", label: "< LOW" };
    }

    function applyBulk(kind) {
        const value = kind === "zero" ? 0 : levelValue(kind);
        DAYS.forEach((d) => (dayTours[d.key] = value));
        render();
    }

    // --- Hauptrendering ---
    function render() {
        const groupSize = clampInt(elGroupSize.value, 1, 9999);
        const duration  = clampInt(elDuration.value, 1, 1440);

        // Auslastungsstufen sortieren, falls User die Reihenfolge verletzt hat
        const lvl = {
            low:    clampInt(elLow.value,    0, 99),
            medium: clampInt(elMedium.value, 0, 99),
            high:   clampInt(elHigh.value,   0, 99),
        };

        let totalTours = 0;
        const buckets = { low: 0, medium: 0, high: 0, over: 0, none: 0 };

        DAYS.forEach((day) => {
            const card  = elDaysGrid.querySelector(`.day[data-day="${day.key}"]`);
            if (!card) return;
            const input = card.querySelector("[data-role=input]");
            const tag   = card.querySelector("[data-role=tag]");
            const info  = card.querySelector("[data-role=info]");

            // Input-Wert synchronisieren (falls von außen gesetzt)
            const tours = dayTours[day.key];
            if (parseInt(input.value, 10) !== tours) input.value = tours;

            const cls = classifyDay(tours, lvl);
            card.classList.remove("is-low", "is-medium", "is-high", "is-over");
            if (cls.key !== "none") card.classList.add(`is-${cls.key === "over" ? "over" : cls.key}`);

            tag.className = "day-tag " + (cls.key === "none" ? "" : cls.key);
            tag.textContent = cls.label;

            const visitors = tours * groupSize;
            const minutes  = tours * duration;
            info.innerHTML = tours > 0
                ? `${visitors} Besucher<br>${formatDuration(minutes)}`
                : "Keine Führungen";

            totalTours += tours;
            buckets[cls.key] = (buckets[cls.key] || 0) + 1;
        });

        const totalVisitors = totalTours * groupSize;
        const totalMinutes  = totalTours * duration;

        elKpiTours.textContent    = totalTours.toString();
        elKpiVisitors.textContent = totalVisitors.toString();
        elKpiHours.textContent    = formatDuration(totalMinutes);
        elKpiLoad.textContent     = avgLoadLabel(buckets);
    }

    function formatDuration(minutes) {
        if (!minutes) return "0 h";
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h === 0) return `${m} min`;
        if (m === 0) return `${h} h`;
        return `${h} h ${m} min`;
    }

    function avgLoadLabel(buckets) {
        // gewichtete Durchschnittsauslastung (nur Tage mit Führungen)
        const weights = { low: 1, medium: 2, high: 3, over: 4 };
        let sum = 0, count = 0;
        for (const key of Object.keys(weights)) {
            sum   += (buckets[key] || 0) * weights[key];
            count += (buckets[key] || 0);
        }
        if (count === 0) return "–";
        const avg = sum / count;
        if (avg >= 3.5) return "ÜBER HIGH";
        if (avg >= 2.5) return "HIGH";
        if (avg >= 1.5) return "MEDIUM";
        return "LOW";
    }

    // --- Start ---
    buildDayCards();
    render();
})();
