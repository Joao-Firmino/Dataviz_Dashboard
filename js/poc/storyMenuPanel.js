const STORY_CATEGORY_META = {
    deadline: { labelKey: "categoryDeadline", icon: "clock" },
    prep: { labelKey: "categoryPrep", icon: "route" },
    bottleneck: { labelKey: "categoryBottleneck", icon: "user-exclamation" },
    social: { labelKey: "categorySocial", icon: "comments" },
    rhythm: { labelKey: "categoryRhythm", icon: "running" },
    profile: { labelKey: "categoryProfile", icon: "lightbulb" }
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function getStoryCategoryMeta(category, lang, tr, t) {
    const meta = STORY_CATEGORY_META[category];

    if (!meta) {
        return { label: category ? tr(lang, category) : t(lang, "categoryOther"), icon: "bulb" };
    }

    return {
        ...meta,
        label: t(lang, meta.labelKey)
    };
}

const STORY_HIGHLIGHT_RAW_LABELS = {
    risk: "Risco Alto",
    attention: "Atenção",
    good: "Positiva"
};

function summarizeStoryFilterRules(storyFilterInfo) {
    const rules = Array.isArray(storyFilterInfo?.rules) ? storyFilterInfo.rules : [];
    const summary = {
        active: 0,
        adapted: 0,
        removed: 0,
        adjustedRules: []
    };

    rules.forEach((rule) => {
        const status = String(rule?.status || "").toLowerCase();
        if (status === "active") {
            summary.active += 1;
            return;
        }

        if (status === "adapted") {
            summary.adapted += 1;
            summary.adjustedRules.push({
                id: rule.id,
                label: "Adaptada",
                reason: rule.reason,
                missingEvents: Array.isArray(rule.missing_events) ? rule.missing_events : []
            });
            return;
        }

        if (status === "removed") {
            summary.removed += 1;
            summary.adjustedRules.push({
                id: rule.id,
                label: "Ignorada",
                reason: rule.reason,
                missingEvents: Array.isArray(rule.missing_events) ? rule.missing_events : []
            });
        }
    });

    return summary;
}

function buildStoryFilterInfoMarkup(storyFilterInfo, lang, deps) {
    const {
        t,
        getEventLabel,
        enableFilterSummary,
    } = deps;

    if (!enableFilterSummary || !storyFilterInfo?.enabled) {
        return "";
    }

    const { active, adapted, removed, adjustedRules } = summarizeStoryFilterRules(storyFilterInfo);
    const selectedEventClasses = Array.isArray(storyFilterInfo?.selected_event_classes)
        ? storyFilterInfo.selected_event_classes
        : [];

    const selectedEventsLabel = selectedEventClasses.length
        ? selectedEventClasses.map((eventName) => getEventLabel(eventName, lang)).join(" • ")
        : t(lang, "allEventsFallback");

    const adjustedList = adjustedRules.slice(0, 4).map((rule) => {
        const reason = rule.reason ? String(rule.reason) : t(lang, "ruleAdjustedFallback");
        const missing = rule.missingEvents.length ? ` (${rule.missingEvents.join(", ")})` : "";
        return `
            <li>
                <strong>${escapeHtml(String(rule.id || "S"))}</strong>
                <span class="poc-story-filter-status__tag">${escapeHtml(t(lang, rule.label))}</span>
                ${escapeHtml(reason)}${escapeHtml(missing)}
            </li>
        `;
    }).join("");
    const hasAdjustedRules = Boolean(adjustedList);

    return `
        <div class="poc-story-filter-status" role="status" aria-live="polite">
            <div class="poc-story-filter-status__title">${escapeHtml(t(lang, "storyFilterRulesTitle"))}</div>
            <div class="poc-story-filter-status__counts">
                <span class="poc-story-filter-chip is-ok">${escapeHtml(t(lang, "storyRulesOk"))}: ${escapeHtml(String(active))}</span>
                <span class="poc-story-filter-chip is-adapted">${escapeHtml(t(lang, "storyRulesAdapted"))}: ${escapeHtml(String(adapted))}</span>
                <span class="poc-story-filter-chip is-ignored">${escapeHtml(t(lang, "storyRulesIgnored"))}: ${escapeHtml(String(removed))}</span>
            </div>
            <p class="poc-story-filter-status__events"><strong>${escapeHtml(t(lang, "activeEventsTitle"))}:</strong> ${escapeHtml(selectedEventsLabel)}</p>
            ${hasAdjustedRules
        ? `
                <button type="button" class="poc-story-filter-status__toggle" aria-expanded="false">
                    <span class="poc-story-filter-status__chevron" aria-hidden="true">▾</span>
                    <span class="poc-story-filter-status__toggle-text">${escapeHtml(t(lang, "storyFilterMoreInfo"))}</span>
                </button>
                <div class="poc-story-filter-status__details is-collapsed">
                    <ul class="poc-story-filter-status__list">${adjustedList}</ul>
                </div>
            `
        : ""}
        </div>
    `;
}

function attachStoryFilterToggleHandlers(detailPanelSelection, lang, t) {
    detailPanelSelection.selectAll(".poc-story-filter-status__toggle").on("click", function () {
        const detailsNode = this.parentElement?.querySelector(".poc-story-filter-status__details");
        const textNode = this.querySelector(".poc-story-filter-status__toggle-text");
        if (!detailsNode || !textNode) return;

        const isCollapsed = detailsNode.classList.toggle("is-collapsed");
        this.setAttribute("aria-expanded", String(!isCollapsed));
        this.classList.toggle("is-open", !isCollapsed);
        textNode.textContent = isCollapsed ? t(lang, "storyFilterMoreInfo") : t(lang, "storyFilterLessInfo");
    });
}

function renderStoryMenuPanel(options) {
    const {
        panelHeaderSelection,
        detailPanelSelection,
        storyFilterInfo,
        availableInsights,
        currentInsightIndex,
        activeInsight,
        affectedCount,
        affectedPct,
        lang,
        t,
        tr,
        getEventLabel,
        enableFilterSummary,
        onNavigate
    } = options;

    const total = availableInsights?.length || 0;
    const hasInsights = total > 0 && Boolean(activeInsight);

    panelHeaderSelection.html(`
        <button
            type="button"
            id="poc-insight-prev"
            class="poc-insight-nav__btn"
            aria-label="${escapeHtml(t(lang, "insightPrevAria"))}"
            ${!hasInsights || currentInsightIndex <= 0 ? "disabled" : ""}>
            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
        </button>
        <span class="poc-insight-nav__counter">${hasInsights ? `${currentInsightIndex + 1} ${t(lang, "ofRoutes")} ${total}` : "0"}</span>
        <button
            type="button"
            id="poc-insight-next"
            class="poc-insight-nav__btn"
            aria-label="${escapeHtml(t(lang, "insightNextAria"))}"
            ${!hasInsights || currentInsightIndex >= total - 1 ? "disabled" : ""}>
            <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
    `);

    panelHeaderSelection.select("#poc-insight-prev").on("click", () => onNavigate(-1));
    panelHeaderSelection.select("#poc-insight-next").on("click", () => onNavigate(1));

    const filterInfoMarkup = buildStoryFilterInfoMarkup(storyFilterInfo, lang, {
        t,
        getEventLabel,
        enableFilterSummary,
    });

    if (!hasInsights) {
        detailPanelSelection.html(`
            <div class="poc-story-nav">
                ${filterInfoMarkup}
                <p class="poc-story-nav__empty">${escapeHtml(t(lang, "noStories"))}</p>
            </div>
        `);
        attachStoryFilterToggleHandlers(detailPanelSelection, lang, t);
        return;
    }

    const categoryMeta = getStoryCategoryMeta(activeInsight.category, lang, tr, t);
    const highlight = activeInsight.highlight || "attention";
    const highlightLabel = t(lang, STORY_HIGHLIGHT_RAW_LABELS[highlight] || STORY_HIGHLIGHT_RAW_LABELS.attention);
    const pctSuffix = Number.isFinite(affectedPct) ? ` (${Math.round(affectedPct)}%)` : "";

    detailPanelSelection.html(`
        <div class="poc-story-nav">
            ${filterInfoMarkup}
            <div class="poc-insight-card">
                <div class="poc-insight-card__tags">
                    <span class="poc-insight-tag poc-insight-tag--category">
                        <i class="fa-solid fa-${escapeHtml(categoryMeta.icon)}" aria-hidden="true"></i>
                        ${escapeHtml(categoryMeta.label)}
                    </span>
                    <span class="poc-insight-tag poc-insight-tag--${escapeHtml(highlight)}">${escapeHtml(highlightLabel)}</span>
                </div>
                <div class="poc-insight-card__id">${escapeHtml(String(activeInsight.id || "S"))}</div>
                <h4 class="poc-insight-card__title">${escapeHtml(tr(lang, activeInsight.title || t(lang, "storyTitleFallback")))}</h4>
                <p class="poc-insight-card__description">${escapeHtml(tr(lang, activeInsight.question || ""))}</p>
                <div class="poc-insight-card__stat">
                    <span class="poc-insight-card__stat-value">${escapeHtml(String(affectedCount))}${escapeHtml(pctSuffix)}</span>
                    <span class="poc-insight-card__stat-label">${escapeHtml(t(lang, "insightStudentsImpacted"))}</span>
                </div>
            </div>
        </div>
    `);

    attachStoryFilterToggleHandlers(detailPanelSelection, lang, t);
}

export { renderStoryMenuPanel };
