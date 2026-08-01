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

function groupStories(stories) {
    const grouped = stories.reduce((acc, story) => {
        const category = story.category || "other";
        (acc[category] ??= []).push(story);
        return acc;
    }, {});

    const categoryOrder = ["deadline", "prep", "bottleneck", "social", "rhythm", "profile"];

    return Object.entries(grouped)
        .map(([category, items]) => ({ category, items: items.slice().sort((a, b) => d3.descending(a.affected_count, b.affected_count)) }))
        .sort((a, b) => {
            const aIndex = categoryOrder.indexOf(a.category);
            const bIndex = categoryOrder.indexOf(b.category);
            if (aIndex === -1 && bIndex === -1) return d3.ascending(a.category, b.category);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return d3.ascending(aIndex, bIndex);
        });
}

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
        detailPanelSelection,
        stories,
        storyFilterInfo,
        selectedStoryId,
        onStorySelect,
        lang,
        t,
        tr,
        getEventLabel,
        getStoryAffectedCount,
        enableFilterSummary
    } = options;

    const grouped = groupStories(stories || []);
    const filterInfoMarkup = buildStoryFilterInfoMarkup(storyFilterInfo, lang, {
        t,
        getEventLabel,
        enableFilterSummary,
    });

    if (!grouped.length) {
        detailPanelSelection.html(`
            <div class="poc-story-nav">
                ${filterInfoMarkup}
                <p class="poc-story-nav__empty">${escapeHtml(t(lang, "noStories"))}</p>
            </div>
        `);
        attachStoryFilterToggleHandlers(detailPanelSelection, lang, t);
        return;
    }

    const html = `
        <div class="poc-story-nav">
            ${filterInfoMarkup}
            <div class="poc-story-list-scroll">
                ${grouped
            .map(({ category, items }) => {
                const categoryMeta = getStoryCategoryMeta(category, lang, tr, t);
                return `
                            <section class="poc-story-group" data-category="${escapeHtml(category)}">
                                <div class="poc-story-group__title">
                                    <span>${escapeHtml(categoryMeta.label)}</span>
                                    <span class="poc-story-group__count">${items.length}</span>
                                </div>
                                <div class="poc-story-list">
                                    ${items.map((story) => {
                        const isActive = selectedStoryId && String(story.id) === String(selectedStoryId);
                        const affectedCount = getStoryAffectedCount(story);
                        return `
                                            <button
                                                type="button"
                                                class="poc-story-item ${isActive ? "is-active" : ""}"
                                                data-story-id="${escapeHtml(String(story.id))}"
                                                title="${escapeHtml(tr(lang, story.title || t(lang, "storyTitleFallback")))}">
                                                <div class="poc-story-item__meta">
                                                    <span class="poc-story-item__id">${escapeHtml(String(story.id || "S"))}</span>
                                                    <span class="poc-story-item__badge">${escapeHtml(String(affectedCount))}</span>
                                                </div>
                                                <div class="poc-story-item__title">${escapeHtml(tr(lang, story.title || t(lang, "untitledStory")))}</div>
                                            </button>
                                        `;
                    }).join("")}
                                </div>
                            </section>
                        `;
            })
            .join("")}
            </div>
        </div>
    `;

    detailPanelSelection.html(html);
    detailPanelSelection.selectAll(".poc-story-item").on("click", function (event) {
        event.preventDefault();
        const storyId = this.getAttribute("data-story-id");
        if (storyId) {
            onStorySelect(storyId);
        }
    });
    attachStoryFilterToggleHandlers(detailPanelSelection, lang, t);

    if (selectedStoryId) {
        const activeCard = detailPanelSelection
            .selectAll(".poc-story-item")
            .filter(function () {
                return this.getAttribute("data-story-id") === String(selectedStoryId);
            })
            .node();
        if (activeCard && typeof activeCard.scrollIntoView === "function") {
            activeCard.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
    }
}

export { renderStoryMenuPanel };
