import loadDashboardData, { buildTimelineRequest, fetchJson } from "./loadDashboardData.js";
import { t, tr } from "./i18n.js?v=20260725212500";
import { DashboardTheme } from "./colors.js";

const EVENT_ORDER = [
    "resource_vis",
    "forum_vis",
    "forum_participation",
    "assignment_vis",
    "assignment_try",
    "assignment_sub"
];

const DEFAULT_EVENTS_ORDER = [
    "assignment_sub",
    "assignment_try",
    "assignment_vis",
    "forum_participation",
    "forum_vis",
    "resource_vis"
];

function getEventLabel(eventName, lang) {
    return t(lang, `event_${eventName}`);
}

function getEventCustomization(state) {
    const rawDisabled = Array.isArray(state?.disabledEvents) ? state.disabledEvents : [];
    const disabledSet = new Set(rawDisabled.filter((eventName) => EVENT_ORDER.includes(eventName)));
    const rawOrder = Array.isArray(state?.eventsOrder) ? state.eventsOrder : [];
    const activeEvents = [];

    rawOrder.forEach((eventName) => {
        if (!EVENT_ORDER.includes(eventName) || disabledSet.has(eventName) || activeEvents.includes(eventName)) {
            return;
        }

        activeEvents.push(eventName);
    });

    EVENT_ORDER.forEach((eventName) => {
        if (!disabledSet.has(eventName) && !activeEvents.includes(eventName)) {
            activeEvents.push(eventName);
        }
    });

    const disabledEvents = [];

    rawDisabled.forEach((eventName) => {
        if (!EVENT_ORDER.includes(eventName) || activeEvents.includes(eventName) || disabledEvents.includes(eventName)) {
            return;
        }

        disabledEvents.push(eventName);
    });

    EVENT_ORDER.forEach((eventName) => {
        if (disabledSet.has(eventName) && !activeEvents.includes(eventName) && !disabledEvents.includes(eventName)) {
            disabledEvents.push(eventName);
        }
    });

    return { activeEvents, disabledEvents };
}

function getOrderedEvents(state) {
    return getEventCustomization(state).activeEvents;
}

function getDisabledEvents(state) {
    return getEventCustomization(state).disabledEvents;
}

function hasCustomizedEventConfiguration(state) {
    const activeEvents = getOrderedEvents(state);
    const disabledEvents = getDisabledEvents(state);

    return disabledEvents.length > 0 || activeEvents.join("|") !== DEFAULT_EVENTS_ORDER.join("|");
}

function ensureNarrativeTooltip(chartContainer) {
    let tooltip = chartContainer.select(".poc-narrative-tooltip");
    if (!tooltip.empty()) {
        return tooltip;
    }

    return chartContainer
        .append("div")
        .attr("class", "poc-narrative-tooltip")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", "5")
        .style("display", "none")
        .style("max-width", "340px")
        .style("padding", "10px 12px")
        .style("border-radius", "12px")
        .style("background", DashboardTheme.system.bgOverlay)
        .style("border", `1px solid ${DashboardTheme.system.borderStrong}40`)
        .style("box-shadow", DashboardTheme.system.dropShadowSoft)
        .style("color", DashboardTheme.system.textMain)
        .style("font-size", "12px")
        .style("line-height", "1.45");
}

function formatStoryParameterValue(rawValue) {
    if (Array.isArray(rawValue)) {
        return rawValue.join(", ");
    }

    if (typeof rawValue === "object" && rawValue !== null) {
        return Object.entries(rawValue)
            .map(([key, value]) => `${key}: ${value}`)
            .join(" | ");
    }

    return String(rawValue);
}

function getStoryAffectedCount(story) {
    const fromCount = Number(story?.affected_count);
    if (Number.isFinite(fromCount)) {
        return fromCount;
    }

    if (Array.isArray(story?.affected_users)) {
        return story.affected_users.length;
    }

    return 0;
}

function getStoryAffectedPercentage(story, affectedCount) {
    const rawPct = Number(story?.affected_pct);

    if (Number.isFinite(rawPct)) {
        return rawPct <= 1 ? rawPct * 100 : rawPct;
    }

    const totalStudentsInScope = Number(story?.__totalStudentsInScope);
    if (Number.isFinite(totalStudentsInScope) && totalStudentsInScope > 0) {
        return (affectedCount / totalStudentsInScope) * 100;
    }

    return null;
}

function showNarrativeTooltip(tooltip, pointer, story, containerNode, lang, options = {}) {
    if (!tooltip || !story) return;

    const { pinned = false } = options;
    const containerWidth = containerNode?.clientWidth || 0;
    const containerHeight = containerNode?.clientHeight || 0;
    const hoverTooltipWidth = 340;
    const pinnedTooltipWidth = 320;
    const pinnedTooltipHeight = 180;
    const safeMargin = 20;
    const minPadding = 8;

    const hoverX = (pointer?.[0] ?? 0) + 15;
    const hoverY = (pointer?.[1] ?? 0) + 15;

    let left = hoverX;
    let top = hoverY;

    if (pinned) {
        const targetX = containerWidth - pinnedTooltipWidth - safeMargin;
        const targetY = containerHeight - pinnedTooltipHeight - safeMargin;

        left = containerWidth > 0
            ? Math.max(minPadding, Math.min(targetX, containerWidth - minPadding))
            : Math.max(minPadding, targetX);
        top = containerHeight > 0
            ? Math.max(minPadding, Math.min(targetY, containerHeight - minPadding))
            : Math.max(minPadding, targetY);
    } else {
        left = containerWidth > 0
            ? Math.max(minPadding, Math.min(hoverX, containerWidth - hoverTooltipWidth - minPadding))
            : hoverX;
        top = containerHeight > 0
            ? Math.max(minPadding, Math.min(hoverY, containerHeight - pinnedTooltipHeight - minPadding))
            : hoverY;
    }

    const tone = STORY_HIGHLIGHT_TONES[story.highlight] || STORY_HIGHLIGHT_TONES.attention;
    const affectedCount = getStoryAffectedCount(story);
    const affectedPct = getStoryAffectedPercentage(story, affectedCount);
    const affectedPctLabel = Number.isFinite(affectedPct) ? `${affectedPct.toFixed(1)}%` : "--";
    const parameterEntries = Object.entries(story?.parameters || {});
    const parametersMarkup = parameterEntries.length
        ? `
            <div style="display:grid; gap:5px; margin-top:2px;">
                <div style="font-size:10px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:${DashboardTheme.system.textSoft};">${escapeHtml(t(lang, "paramsLabel"))}</div>
                ${parameterEntries
                    .map(([key, value]) => `
                        <div style="display:grid; grid-template-columns:max-content minmax(0,1fr); gap:6px; align-items:start; font-size:11px;">
                            <span style="font-weight:800; color:${DashboardTheme.system.textEmphasis};">${escapeHtml(key)}</span>
                            <span style="color:${DashboardTheme.system.textStrong};">${escapeHtml(formatStoryParameterValue(value))}</span>
                        </div>
                    `)
                    .join("")}
            </div>
        `
        : "";

    tooltip
        .style("display", "block")
        .style("left", `${left}px`)
        .style("top", `${top}px`)
        .style("transition", pinned ? "left 260ms ease, top 260ms ease, opacity 180ms ease" : "none")
        .html(`
            <div style="display:grid; gap:6px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; padding:4px 8px; border-radius:999px; background:${tone.soft}; border:1px solid ${tone.accent}33; color:${tone.accent}; font-size:10px; font-weight:900; letter-spacing:.06em; text-transform:uppercase;">${escapeHtml(t(lang, tone.labelKey))}</span>
                    <span style="display:inline-flex; align-items:center; justify-content:center; padding:4px 8px; border-radius:999px; background:${DashboardTheme.system.bgSurface}; border:1px solid ${DashboardTheme.system.borderMuted}; color:${DashboardTheme.system.textStrong}; font-size:10px; font-weight:900;">${escapeHtml(story.id)}</span>
                </div>
                <div style="font-weight:900;">${escapeHtml(tr(lang, story.title))}</div>
                <div>${escapeHtml(tr(lang, story.question))}</div>
                <div style="padding:6px 8px; border-radius:8px; background:${DashboardTheme.system.bgSurface}; border:1px solid ${DashboardTheme.system.borderSoft}; color:${DashboardTheme.system.textStrong};">${escapeHtml(t(lang, "studentsLabel"))}: <strong>${escapeHtml(String(affectedCount))}</strong> (${escapeHtml(affectedPctLabel)})</div>
                ${parametersMarkup}
            </div>
        `);
}

function hideNarrativeTooltip(tooltip) {
    if (!tooltip || tooltip.empty()) return;
    tooltip.style("display", "none");
}
const EVENT_COLOR = DashboardTheme.events;

const EVENT_FA_ICON = {
    resource_vis: { className: "fa-folder-open", color: DashboardTheme.events.resource_vis },
    forum_vis: { className: "fa-comments", color: DashboardTheme.events.forum_vis },
    forum_participation: { className: "fa-comment-medical", color: DashboardTheme.events.forum_participation },
    assignment_vis: { className: "fa-file-alt", color: DashboardTheme.events.assignment_vis },
    assignment_try: { className: "fa-check", color: DashboardTheme.events.assignment_try },
    assignment_sub: { className: "fa-check-double", color: DashboardTheme.events.assignment_sub }
};

const ROUTE_BASE_STROKE = DashboardTheme.system.contextLine;
const ROUTE_SELECTED_NEUTRAL_STROKE = DashboardTheme.system.neutralHighlight;
const ROUTE_BASE_OPACITY = DashboardTheme.opacities.baseRoute;
const ROUTE_DIMMED_OPACITY = DashboardTheme.opacities.declutter;

function getEventIcon(eventName) {
    return EVENT_FA_ICON[eventName] || null;
}

function appendFaIcon(selection, iconInfo, size, options = {}) {
    const {
        colorOverride = null,
        className = ""
    } = options;

    selection
        .append("xhtml:div")
        .attr("class", className)
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("width", "100%")
        .style("height", "100%")
        .style("color", colorOverride || iconInfo.color)
        .style("font-size", `${size}px`)
        .style("line-height", "1")
        .html(`<i class="fa-solid ${iconInfo.className}"></i>`);
}

function appendEventNodeGlyph(selection, eventName, options = {}) {
    const {
        x = 0,
        y = 0,
        circleRadius = 12,
        iconSize = 16,
        circleClass = "route-dot-bg",
        iconClass = "route-dot",
        iconInnerClass = "route-dot-icon",
        opacity = 1
    } = options;

    const iconInfo = getEventIcon(eventName);
    if (!iconInfo) return;

    const eventColor = EVENT_COLOR[eventName] || DashboardTheme.system.textSoft;

    selection
        .append("circle")
        .attr("class", circleClass)
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", circleRadius)
        .attr("fill", DashboardTheme.system.bgWhite)
        .attr("stroke", eventColor)
        .attr("stroke-width", 2.8)
        .style("pointer-events", "none")
        .style("opacity", opacity);

    const iconBoxSize = circleRadius * 1.5;
    const iconBox = selection
        .append("foreignObject")
        .attr("class", iconClass)
        .attr("x", x - (iconBoxSize / 2))
        .attr("y", y - (iconBoxSize / 2))
        .attr("width", iconBoxSize)
        .attr("height", iconBoxSize)
        .style("overflow", "visible")
        .style("pointer-events", "none")
        .style("opacity", opacity);

    appendFaIcon(iconBox, iconInfo, iconSize, {
        colorOverride: eventColor,
        className: iconInnerClass
    });
}

const EVENT_ICON = {
    resource_vis: '<path d="M7 4h8l4 4v12H7z"></path><path d="M15 4v4h4"></path>',
    forum_vis: '<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v5A2.5 2.5 0 0 1 16.5 14H11l-4 3v-3H7.5A2.5 2.5 0 0 1 5 11.5z"></path>',
    forum_participation: '<path d="M7 16c0-2 1.7-3.5 4-3.5s4 1.5 4 3.5"></path><circle cx="11" cy="8" r="2.3"></circle><path d="M15.5 8.5h3"></path><path d="M17 7v3"></path>',
    assignment_vis: '<path d="M7 4h10v16H7z"></path><path d="M9 8h6"></path><path d="M9 11h6"></path>',
    assignment_try: '<path d="M5.5 15.5l7.8-7.8 2.9 2.9-7.8 7.8H5.5z"></path><path d="M14.2 7.8l1.9-1.9 2.9 2.9-1.9 1.9"></path>',
    assignment_sub: '<path d="M7 12l5 5l10-10"></path><path d="M2 12l5 5l5-5"></path>'
};

function svgIconMarkup(iconName, className = "") {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${EVENT_ICON[iconName] || ""}</svg>`;
}

function getStatusMarkup(hasSubmission, lang) {
    return hasSubmission
    ? `<span class="poc-route-status is-finished">${svgIconMarkup("assignment_sub", "")}${escapeHtml(t(lang, "routeFinished"))}</span>`
    : `<span class="poc-route-status is-unfinished">${svgIconMarkup("assignment_try", "")}${escapeHtml(t(lang, "routeUnfinished"))}</span>`;
}

function getEventChipMarkup(eventName, lang) {
    const label = getEventLabel(eventName, lang) || eventName;
    return `<span class="poc-step-chip">${svgIconMarkup(eventName, "")}${label}</span>`;
}

function normalizeGrade(rawValue) {
    const grade = Number(rawValue);
    if (Number.isNaN(grade)) {
        return 0;
    }

    if (grade >= 0 && grade <= 2) {
        return grade * 5;
    }

    return grade;
}

function buildEventMap(mappingRows) {
    const eventMap = new Map();

    mappingRows.forEach((row) => {
        eventMap.set(`${row.component}|${row.action}|${row.target}`, String(row.class || "").trim());
    });

    return eventMap;
}

function simplifyAssignmentSequence(route) {
    if (!Array.isArray(route)) return [];
    if (route.length === 0) return route.slice();

    const normalizedRoute = route.filter((value, index) => index === 0 || value !== route[index - 1]);
    const simplifiedRoute = [];

    for (let index = 0; index < normalizedRoute.length; index += 1) {
        const currentEvent = normalizedRoute[index];

        if (currentEvent !== "assignment_vis" && currentEvent !== "assignment_try" && currentEvent !== "assignment_sub") {
            simplifiedRoute.push(currentEvent);
            continue;
        }

        let clusterEnd = index;

        while (
            clusterEnd + 1 < normalizedRoute.length &&
            ["assignment_vis", "assignment_try", "assignment_sub"].includes(normalizedRoute[clusterEnd + 1])
        ) {
            clusterEnd += 1;
        }

        const cluster = normalizedRoute.slice(index, clusterEnd + 1);

        if (cluster.includes("assignment_sub")) {
            simplifiedRoute.push("assignment_sub");
        } else if (cluster.includes("assignment_try")) {
            simplifiedRoute.push("assignment_try");
        } else {
            simplifiedRoute.push("assignment_vis");
        }

        index = clusterEnd;
    }

    return simplifiedRoute;
}

function routeHasSubmission(route) {
    return route.includes("assignment_sub");
}

function filterLogsByActivity(logRows, activity) {
    const tOpen = Number(activity.t_open);
    const tClose = Number(activity.t_close);

    return logRows.filter((row) => {
        const tValue = Number(row.t);
        return tValue >= tOpen && tValue <= tClose;
    });
}

function buildGradeByUser(quizGrades) {
    return d3.rollup(
        quizGrades,
        (rows) => d3.mean(rows, (d) => normalizeGrade(d.student_grade)) ?? 0,
        (d) => String(d.userid)
    );
}

function buildUserRoutes(logRows, eventMap, gradeByUser) {
    const logsByUser = d3.group(logRows, (d) => String(d.userid));
    const userRoutes = [];

    logsByUser.forEach((rows, userId) => {
        const orderedRows = rows.slice().sort((a, b) => Number(a.t) - Number(b.t));
        const route = [];

        orderedRows.forEach((row) => {
            const eventKey = `${row.component}|${row.action}|${row.target}`;
            const mappedEvent = eventMap.get(eventKey);

            if (!mappedEvent || !EVENT_ORDER.includes(mappedEvent)) {
                return;
            }

            if (route[route.length - 1] !== mappedEvent) {
                route.push(mappedEvent);
            }
        });

        if (route.length > 0) {
            const simplifiedRoute = simplifyAssignmentSequence(route);

            userRoutes.push({
                userId,
                route: simplifiedRoute,
                hasSubmission: routeHasSubmission(simplifiedRoute),
                grade: gradeByUser.get(String(userId)) ?? 0
            });
        }
    });

    return userRoutes;
}

function buildUserRoutesFromTimeline(users, allowedEvents = EVENT_ORDER) {
    if (!Array.isArray(users)) {
        return [];
    }

    const allowedEventSet = new Set(allowedEvents.filter((eventName) => EVENT_ORDER.includes(eventName)));

    return users
        .map((user) => {
            const route = (user.events || [])
                .map((eventData) => String(eventData.class || eventData.event || "").trim())
                .map((eventName) => eventName.split("_SOME")[0].split("_MANY")[0].split("_START")[0].split("_END")[0])
                .filter((eventName) => allowedEventSet.has(eventName));

            if (!route.length) {
                return null;
            }

            const simplifiedRoute = simplifyAssignmentSequence(route);
            const gradeRatio = Number(user.grade_ratio);

            return {
                userId: String(user.userid),
                route: simplifiedRoute,
                hasSubmission: routeHasSubmission(simplifiedRoute),
                grade: Number.isFinite(gradeRatio) ? gradeRatio * 10 : 0
            };
        })
        .filter(Boolean);
}

function groupRoutes(userRoutes) {
    const grouped = d3.rollup(
        userRoutes,
        (rows) => {
            const route = rows[0].route.slice();
            const students = rows.map((d) => d.userId);
            const grades = rows.map((d) => d.grade);

            return {
                route,
                students,
                totalStudents: students.length,
                avgGrade: d3.mean(grades) ?? 0,
                hasSubmission: routeHasSubmission(route)
            };
        },
        (d) => `${routeHasSubmission(d.route) ? "1" : "0"}|${d.route.join(">")}`
    );

    return Array.from(grouped, ([routeKey, summary]) => ({
        routeKey,
        route: summary.route,
        students: summary.students,
        totalStudents: summary.totalStudents,
        avgGrade: summary.avgGrade,
        hasSubmission: summary.hasSubmission
    })).sort((a, b) => d3.descending(a.totalStudents, b.totalStudents));
}

function buildNarrativeRoutes(groupedRoutes, narrativeMode, minVolume) {
    const volumeFiltered = groupedRoutes.filter((routeData) => routeData.totalStudents >= minVolume);

    if (narrativeMode === "unfinished") {
        return volumeFiltered.filter((routeData) => !routeHasSubmission(routeData.route));
    }

    if (narrativeMode === "finished") {
        return volumeFiltered.filter((routeData) => routeHasSubmission(routeData.route));
    }

    return volumeFiltered;
}

const STORY_CATEGORY_META = {
    deadline: { labelKey: "categoryDeadline", icon: "clock" },
    prep: { labelKey: "categoryPrep", icon: "route" },
    bottleneck: { labelKey: "categoryBottleneck", icon: "user-exclamation" },
    social: { labelKey: "categorySocial", icon: "comments" },
    rhythm: { labelKey: "categoryRhythm", icon: "running" },
    profile: { labelKey: "categoryProfile", icon: "lightbulb" }
};

const STORY_HIGHLIGHT_LABELS = {
    risk: "Risco",
    good: "Positiva",
    attention: "Atenção"
};

const STORY_HIGHLIGHT_TONES = {
    risk: { labelKey: "Risco Alto", accent: DashboardTheme.status.risk.strong, soft: DashboardTheme.status.risk.soft },
    good: { labelKey: "Positiva", accent: DashboardTheme.status.good.strong, soft: DashboardTheme.status.good.soft },
    attention: { labelKey: "Atenção", accent: DashboardTheme.status.attention.strong, soft: DashboardTheme.status.attention.soft }
};

const STORY_HIGHLIGHT_STROKES = {
    risk: DashboardTheme.status.risk.strong,
    good: DashboardTheme.status.good.strong,
    attention: DashboardTheme.status.attention.stroke
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function getStoryCategoryMeta(category, lang) {
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

function renderStoryMenuPanel(detailPanelSelection, stories, selectedStoryId, onStorySelect, lang) {
    const grouped = groupStories(stories || []);

    if (!grouped.length) {
        detailPanelSelection.html(`
            <div class="poc-story-nav">
                <p class="poc-story-nav__empty">${escapeHtml(t(lang, "noStories"))}</p>
            </div>
        `);
        return;
    }

    const html = `
        <div class="poc-story-nav">
            <div class="poc-story-list-scroll">
                ${grouped
                    .map(({ category, items }) => {
                        const categoryMeta = getStoryCategoryMeta(category, lang);
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

function buildStoryRouteHighlights(stories, groupedRoutes) {
    const routeMap = new Map(groupedRoutes.map((routeData) => [routeData.routeKey, routeData]));
    const userToRoute = new Map();

    groupedRoutes.forEach((routeData) => {
        (routeData.students || []).forEach((userId) => {
            userToRoute.set(String(userId), routeData.routeKey);
        });
    });

    const highlightByRoute = new Map();

    (stories || []).forEach((story) => {
        const users = Array.isArray(story.affected_users) ? story.affected_users : [];
        const routeKeys = new Set();

        users.forEach((userId) => {
            const routeKey = userToRoute.get(String(userId));
            if (routeKey) {
                routeKeys.add(routeKey);
            }
        });

        routeKeys.forEach((routeKey) => {
            const existing = highlightByRoute.get(routeKey) || {
                routeKey,
                stories: [],
                affectedUsers: new Set(),
                severityRank: 0,
                highlight: "attention"
            };

            existing.stories.push(story);
            users.forEach((userId) => existing.affectedUsers.add(String(userId)));
            existing.severityRank = Math.max(existing.severityRank, story.highlight === "risk" ? 3 : story.highlight === "attention" ? 2 : 1);
            existing.highlight = existing.severityRank === 3 ? "risk" : existing.severityRank === 2 ? "attention" : "good";
            highlightByRoute.set(routeKey, existing);
        });
    });

    return {
        routeMap,
        highlights: Array.from(highlightByRoute.values()).map((entry) => ({
            ...entry,
            routeData: routeMap.get(entry.routeKey) || null,
            stories: entry.stories.slice().sort((a, b) => {
                const aScore = a.highlight === "risk" ? 3 : a.highlight === "attention" ? 2 : 1;
                const bScore = b.highlight === "risk" ? 3 : b.highlight === "attention" ? 2 : 1;
                return d3.descending(aScore, bScore);
            })
        }))
    };
}

function applyUiTranslations(state) {
    const lang = state.lang;
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "pt-BR");

    document.querySelectorAll("[data-i18n]").forEach((node) => {
        const key = node.getAttribute("data-i18n");
        if (!key) return;
        node.textContent = t(lang, key);
    });

    const activitySelectNode = document.getElementById("poc-activity-select");
    if (activitySelectNode) {
        activitySelectNode.setAttribute("aria-label", t(lang, "selectActivityAria"));
    }

    const minVolumeNode = document.getElementById("poc-min-volume");
    if (minVolumeNode) {
        minVolumeNode.setAttribute("aria-label", t(lang, "minVolumeAria"));
    }

    const langPt = document.getElementById("lang-pt");
    const langEn = document.getElementById("lang-en");

    if (langPt && langEn) {
        langPt.classList.toggle("is-active", lang === "pt");
        langEn.classList.toggle("is-active", lang === "en");
    }
}

function setTimelineLoadingOverlay(chartContainer, lang, isLoading) {
    chartContainer.selectAll(".poc-loading-overlay").remove();

    if (!isLoading) {
        return;
    }

    chartContainer.style("position", "relative");

    const overlay = chartContainer
        .append("div")
        .attr("class", "poc-loading-overlay")
        .style("position", "absolute")
        .style("inset", "0")
        .style("display", "grid")
        .style("place-items", "center")
        .style("background", "rgba(248, 250, 252, 0.82)")
        .style("z-index", "8")
        .style("pointer-events", "all");

    const card = overlay
        .append("div")
        .style("display", "inline-flex")
        .style("align-items", "center")
        .style("gap", "10px")
        .style("padding", "12px 14px")
        .style("border-radius", "12px")
        .style("border", `1px solid ${DashboardTheme.system.borderMuted}`)
        .style("background", DashboardTheme.system.bgWhite)
        .style("box-shadow", DashboardTheme.system.dropShadowSoft)
        .style("color", DashboardTheme.system.textMain)
        .style("font-size", "13px")
        .style("font-weight", "700");

    card
        .append("span")
        .style("width", "14px")
        .style("height", "14px")
        .style("border-radius", "999px")
        .style("border", `2px solid ${DashboardTheme.system.borderMuted}`)
        .style("border-top-color", DashboardTheme.system.selectionFallback)
        .style("animation", "poc-spin 0.8s linear infinite");

    card.append("span").text(t(lang, "recalculatingStories"));
}

function renderInteractiveYAxisPanel({ chartContainer, eventsOrder, disabledEvents, y, margin, innerHeight, lang, onChange, isRecalculating }) {
    chartContainer.selectAll(".poc-yorder-panel, .poc-yorder-disabled-zone--bottom").remove();

    const panel = chartContainer
        .append("div")
        .attr("class", "poc-yorder-panel")
        .style("left", "10px")
        .style("top", `${margin.top}px`)
        .style("width", `${Math.max(136, margin.left - 26)}px`)
        .style("height", `${innerHeight}px`);

    panel
        .append("p")
        .attr("class", "poc-yorder-heading")
        .text(t(lang, "activeEventsTitle"));

    const activeSection = panel
        .append("div")
        .attr("class", "poc-yorder-active-section")
        .style("height", `${innerHeight}px`);

    const list = activeSection
        .append("ul")
        .attr("class", "poc-yorder-list")
        .attr("data-zone", "active");

    panel
        .append("p")
        .attr("class", "poc-yorder-hint")
        .text(t(lang, "dragHint"));

    const hasDisabledEvents = disabledEvents.length > 0;

    const disabledSection = chartContainer
        .append("div")
        .attr("class", "poc-yorder-disabled-zone poc-yorder-disabled-zone--bottom")
        .classed("is-populated", hasDisabledEvents)
        .style("left", `${margin.left}px`)
        .style("right", `${margin.right}px`)
        .style("top", `${margin.top + innerHeight + 34}px`)
        .attr("data-zone", "disabled");

    disabledSection
        .append("div")
        .attr("class", "poc-yorder-disabled-zone__title")
        .text(t(lang, "disabledEventsTitle"));

    disabledSection
        .append("div")
        .attr("class", "poc-yorder-disabled-zone__hint")
        .classed("is-hidden", hasDisabledEvents)
        .text(disabledEvents.length ? t(lang, "disabledDropHint") : t(lang, "disabledEmptyHint"));

    const disabledList = disabledSection
        .append("div")
        .attr("class", "poc-yorder-disabled-list");

    let draggingEvent = null;
    let draggingFromZone = null;

    function clearDropStates() {
        chartContainer.selectAll(".poc-yorder-card").classed("is-dragging", false).classed("is-drop-target", false);
        chartContainer
            .selectAll(".poc-yorder-list, .poc-yorder-disabled-zone")
            .classed("is-drop-target", false)
            .classed("is-available-dropzone", false);
    }

    function commitEventChange(nextActiveEvents, nextDisabledEvents) {
        if (!Array.isArray(nextActiveEvents) || nextActiveEvents.length === 0) {
            return;
        }

        if (
            nextActiveEvents.join("|") === eventsOrder.join("|")
            && nextDisabledEvents.join("|") === disabledEvents.join("|")
        ) {
            return;
        }

        Promise.resolve(onChange({
            activeEvents: nextActiveEvents,
            disabledEvents: nextDisabledEvents
        })).catch((error) => {
            console.error("Erro ao recalcular timeline apos personalizacao dos eventos:", error);
        });
    }

    function removeEvent(list, eventName) {
        return list.filter((currentEvent) => currentEvent !== eventName);
    }

    function buildNextState(targetZone, targetEvent = null, targetPlacement = "before") {
        if (!draggingEvent) {
            return null;
        }

        if (targetEvent && targetEvent === draggingEvent) {
            return null;
        }

        const activeEvents = eventsOrder.slice();
        const inactiveEvents = disabledEvents.slice();
        const isActiveSource = activeEvents.includes(draggingEvent);
        const isDisabledSource = inactiveEvents.includes(draggingEvent);

        if (!isActiveSource && !isDisabledSource) {
            return null;
        }

        if (targetZone === "active") {
            const nextActiveEvents = removeEvent(activeEvents, draggingEvent);
            const nextDisabledEvents = removeEvent(inactiveEvents, draggingEvent);
            const insertIndex = targetEvent ? nextActiveEvents.indexOf(targetEvent) : -1;

            if (insertIndex >= 0) {
                const normalizedIndex = targetPlacement === "after" ? insertIndex + 1 : insertIndex;
                nextActiveEvents.splice(normalizedIndex, 0, draggingEvent);
            } else {
                nextActiveEvents.push(draggingEvent);
            }

            return { nextActiveEvents, nextDisabledEvents };
        }

        if (targetZone === "disabled") {
            if (isActiveSource && activeEvents.length <= 1) {
                return null;
            }

            const nextActiveEvents = removeEvent(activeEvents, draggingEvent);
            const nextDisabledEvents = removeEvent(inactiveEvents, draggingEvent);
            const insertIndex = targetEvent ? nextDisabledEvents.indexOf(targetEvent) : -1;

            if (insertIndex >= 0) {
                const normalizedIndex = targetPlacement === "after" ? insertIndex + 1 : insertIndex;
                nextDisabledEvents.splice(normalizedIndex, 0, draggingEvent);
            } else {
                nextDisabledEvents.push(draggingEvent);
            }

            return { nextActiveEvents, nextDisabledEvents };
        }

        return null;
    }

    function attachDropTarget(selection, zone, targetEvent = null, options = {}) {
        const { relativePlacement = false } = options;

        selection
            .on("dragenter", function (event) {
                event.preventDefault();
                event.stopPropagation();
                d3.select(this).classed("is-drop-target", true);
            })
            .on("dragleave", function () {
                d3.select(this).classed("is-drop-target", false);
            })
            .on("dragover", function (event) {
                event.preventDefault();
                event.stopPropagation();
            })
            .on("drop", function (event) {
                event.preventDefault();
                event.stopPropagation();
                d3.select(this).classed("is-drop-target", false);

                if (isRecalculating) {
                    return;
                }

                let targetPlacement = "before";
                let dropTargetEvent = targetEvent;

                if (zone === "active" && !targetEvent) {
                    const activeCards = Array.from(this.querySelectorAll('.poc-yorder-card[data-zone="active"]'));

                    if (activeCards.length) {
                        const pointerY = event.clientY;
                        const nextCard = activeCards.find((card) => {
                            const box = card.getBoundingClientRect();
                            return pointerY <= box.top + (box.height / 2);
                        });

                        if (nextCard) {
                            dropTargetEvent = nextCard.getAttribute("data-event");
                            targetPlacement = "before";
                        } else {
                            dropTargetEvent = activeCards[activeCards.length - 1].getAttribute("data-event");
                            targetPlacement = "after";
                        }
                    }
                }

                if (relativePlacement) {
                    const box = this.getBoundingClientRect();
                    targetPlacement = event.clientY > (box.top + (box.height / 2)) ? "after" : "before";
                }

                const nextState = buildNextState(zone, dropTargetEvent, targetPlacement);
                if (!nextState) {
                    return;
                }

                commitEventChange(nextState.nextActiveEvents, nextState.nextDisabledEvents);
            });
    }

    eventsOrder.forEach((eventName) => {
        const yPos = y(eventName);
        if (yPos == null) return;

        const item = list
            .append("li")
            .attr("class", "poc-yorder-item")
            .style("top", `${yPos}px`);

        const card = item
            .append("div")
            .attr("class", "poc-yorder-card")
            .attr("draggable", isRecalculating ? "false" : "true")
            .attr("data-event", eventName)
            .attr("data-zone", "active")
            .attr("aria-label", getEventLabel(eventName, lang));

        const iconInfo = getEventIcon(eventName);
        const iconColor = EVENT_COLOR[eventName] || DashboardTheme.system.textSoft;

        card
            .append("span")
            .style("display", "inline-flex")
            .style("align-items", "center")
            .style("justify-content", "center")
            .style("width", "22px")
            .style("height", "22px")
            .style("border-radius", "999px")
            .style("background", DashboardTheme.system.bgWhite)
            .style("border", `2px solid ${iconColor}`)
            .style("flex", "0 0 auto")
            .html(iconInfo ? `<i class="fa-solid ${iconInfo.className}" style="color:${iconColor};font-size:12px;"></i>` : "");

        card
            .append("span")
            .attr("class", "poc-yorder-label")
            .text(getEventLabel(eventName, lang));

        attachDropTarget(card, "active", eventName, { relativePlacement: true });
    });

    disabledEvents.forEach((eventName) => {
        const card = disabledList
            .append("div")
            .attr("class", "poc-yorder-card poc-yorder-card--disabled")
            .attr("draggable", isRecalculating ? "false" : "true")
            .attr("data-event", eventName)
            .attr("data-zone", "disabled")
            .attr("aria-label", getEventLabel(eventName, lang));

        const iconInfo = getEventIcon(eventName);
        const iconColor = EVENT_COLOR[eventName] || DashboardTheme.system.textSoft;

        card
            .append("span")
            .style("display", "inline-flex")
            .style("align-items", "center")
            .style("justify-content", "center")
            .style("width", "22px")
            .style("height", "22px")
            .style("border-radius", "999px")
            .style("background", DashboardTheme.system.bgWhite)
            .style("border", `2px solid ${iconColor}`)
            .style("flex", "0 0 auto")
            .html(iconInfo ? `<i class="fa-solid ${iconInfo.className}" style="color:${iconColor};font-size:12px;"></i>` : "");

        card
            .append("span")
            .attr("class", "poc-yorder-label")
            .text(getEventLabel(eventName, lang));

        attachDropTarget(card, "disabled", eventName, { relativePlacement: true });
    });

    chartContainer.selectAll(".poc-yorder-card")
        .on("dragstart", function (event) {
            draggingEvent = this.getAttribute("data-event");
            draggingFromZone = this.getAttribute("data-zone");
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", draggingEvent || "");
            }
            d3.select(this).classed("is-dragging", true);
            chartContainer
                .selectAll(`.poc-yorder-list[data-zone]:not([data-zone="${draggingFromZone}"]), .poc-yorder-disabled-zone[data-zone]:not([data-zone="${draggingFromZone}"])`)
                .classed("is-available-dropzone", true);
        })
        .on("dragend", function () {
            draggingEvent = null;
            draggingFromZone = null;
            clearDropStates();
        });

    attachDropTarget(list, "active");
    attachDropTarget(disabledSection, "disabled");
}


function renderTrajectoryChart({
    chartContainer,
    titleNode,
    detailPanel,
    detailPanelContainer,
    btnAll,
    btnDrop,
    groupedRoutes,
    stories,
    activityName,
    state,
    onStateChange,
    onEventsOrderChange
}) {
    const lang = state.lang;
    const activeEventsOrder = getOrderedEvents(state);
    const disabledEvents = getDisabledEvents(state);
    const activeEventSet = new Set(activeEventsOrder);

    chartContainer.selectAll("svg, .poc-empty-overlay, .poc-render-note").remove();
    const narrativeTooltip = ensureNarrativeTooltip(chartContainer);

    const routesToRender = buildNarrativeRoutes(groupedRoutes, state.narrativeMode, state.minVolume);
    const routesForStoryMapping = buildNarrativeRoutes(groupedRoutes, state.narrativeMode, 1);
    const totalStudentsInScope = d3.sum(groupedRoutes, (entry) => entry.totalStudents) || 1;
    const MAX_RENDER_ROUTES = 180;
    const hiddenRoutesCount = Math.max(0, routesToRender.length - MAX_RENDER_ROUTES);

    const { highlights: storyHighlights } = buildStoryRouteHighlights(stories, routesForStoryMapping);
    const highlightByRoute = new Map(storyHighlights.map((entry) => [entry.routeKey, entry]));
    const storyIdToRouteKey = new Map();

    storyHighlights.forEach((entry) => {
        const routeSize = entry.routeData?.totalStudents || 0;
        (entry.stories || []).forEach((story) => {
            const storyId = String(story.id);
            const current = storyIdToRouteKey.get(storyId);
            if (!current || routeSize > current.routeSize) {
                storyIdToRouteKey.set(storyId, { routeKey: entry.routeKey, routeSize });
            }
        });
    });

    if (state.selectedStoryId && !state.selectedRouteKey) {
        const selectedStoryRoute = storyIdToRouteKey.get(String(state.selectedStoryId));
        state.selectedRouteKey = selectedStoryRoute ? selectedStoryRoute.routeKey : null;
    }

    const routesForChart = routesToRender.slice(0, MAX_RENDER_ROUTES);
    if (state.selectedRouteKey && !routesForChart.some((routeData) => routeData.routeKey === state.selectedRouteKey)) {
        const selectedRouteData = routesForStoryMapping.find((routeData) => routeData.routeKey === state.selectedRouteKey);
        if (selectedRouteData) {
            routesForChart.push(selectedRouteData);
        }
    }

    const allVisibleKeys = new Set(routesForChart.map((d) => d.routeKey));
    const routeKeyToIndex = new Map(routesForChart.map((routeData, routeIndex) => [routeData.routeKey, routeIndex]));
    const storyIdToVisibleRouteIndices = new Map();
    const visibleStoryIds = new Set();

    routesForChart.forEach((routeData, routeIndex) => {
        const routeHighlight = highlightByRoute.get(routeData.routeKey);
        if (!routeHighlight?.stories?.length) {
            return;
        }

        routeHighlight.stories.forEach((story) => {
            const storyId = String(story.id);
            visibleStoryIds.add(storyId);

            if (!storyIdToVisibleRouteIndices.has(storyId)) {
                storyIdToVisibleRouteIndices.set(storyId, []);
            }

            const indices = storyIdToVisibleRouteIndices.get(storyId);
            if (!indices.includes(routeIndex)) {
                indices.push(routeIndex);
            }
        });
    });

    const storiesForSidebar = (stories || []).filter((story) => visibleStoryIds.has(String(story.id)));
    const selectedStoryRouteIndices = state.selectedStoryId
        ? new Set(storyIdToVisibleRouteIndices.get(String(state.selectedStoryId)) || [])
        : new Set();

    if (state.selectedStoryId && !visibleStoryIds.has(String(state.selectedStoryId))) {
        state.selectedStoryId = null;
        state.selectedRouteKey = null;
        state.selectedRouteIndex = null;
        state.pinnedCoords = null;
    }

    if (state.selectedStoryId && !selectedStoryRouteIndices.size) {
        state.selectedStoryId = null;
        state.selectedRouteKey = null;
        state.selectedRouteIndex = null;
        state.pinnedCoords = null;
    }

    if (state.selectedRouteKey && routeKeyToIndex.has(state.selectedRouteKey)) {
        state.selectedRouteIndex = routeKeyToIndex.get(state.selectedRouteKey);
    }

    if (state.selectedRouteKey && !allVisibleKeys.has(state.selectedRouteKey)) {
        state.selectedRouteKey = null;
        state.selectedRouteIndex = null;
        state.pinnedCoords = null;
    }

    if (state.selectedRouteIndex == null && state.selectedRouteKey && routeKeyToIndex.has(state.selectedRouteKey)) {
        state.selectedRouteIndex = routeKeyToIndex.get(state.selectedRouteKey);
    }

    if (state.selectedRouteIndex != null) {
        const indexedRoute = routesForChart[state.selectedRouteIndex] || null;

        if (!indexedRoute) {
            state.selectedRouteIndex = null;
            state.selectedRouteKey = null;
            state.selectedStoryId = null;
            state.pinnedCoords = null;
        } else {
            state.selectedRouteKey = indexedRoute.routeKey;
        }
    }

    renderStoryMenuPanel(detailPanel, storiesForSidebar, state.selectedStoryId, (storyId) => {
        const normalizedStoryId = String(storyId);
        const matchingRouteIndices = storyIdToVisibleRouteIndices.get(normalizedStoryId) || [];

        if (!matchingRouteIndices.length) {
            state.selectedStoryId = null;
            state.selectedRouteKey = null;
            state.selectedRouteIndex = null;
            state.pinnedCoords = null;
            onStateChange();
            return;
        }

        if (state.selectedStoryId === normalizedStoryId) {
            state.selectedStoryId = null;
            state.selectedRouteKey = null;
            state.selectedRouteIndex = null;
            state.pinnedCoords = null;
            onStateChange();
            return;
        }

        const firstMatchIndex = matchingRouteIndices[0];
        const firstMatchRoute = routesForChart[firstMatchIndex] || null;

        state.selectedStoryId = normalizedStoryId;
        state.selectedRouteIndex = firstMatchRoute ? firstMatchIndex : null;
        state.selectedRouteKey = firstMatchRoute ? firstMatchRoute.routeKey : null;
        state.pinnedCoords = null;

        onStateChange();
    }, lang);
    detailPanelContainer.style("display", "block");

    const totalRoutes = routesToRender.length;
    const modeLabel = state.narrativeMode === "unfinished"
        ? t(lang, "modeUnfinished")
        : t(lang, "modeFinished");

    titleNode.text(
        totalRoutes > 0
            ? `${modeLabel} ${t(lang, "inWord")} ${activityName} (${totalRoutes} ${t(lang, "routesCountSuffix")})`
            : `${t(lang, "noRoutesMode")} ${activityName}.`
    );
    btnAll.classed("is-active", state.narrativeMode === "finished");
    btnDrop.classed("is-active", state.narrativeMode === "unfinished");

    const isEmptyState = totalRoutes === 0;

    const width = chartContainer.node().clientWidth || 1100;
    const availableHeight = detailPanelContainer.node().clientHeight || chartContainer.node().clientHeight || 420;
    const height = Math.max(240, availableHeight);
    const margin = { top: 16, right: 20, bottom: 112, left: 190 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const maxSteps = isEmptyState ? 6 : (d3.max(groupedRoutes, (d) => d.route.length) || 1);
    const allSteps = d3.range(1, maxSteps + 1);
    const stepStride = isEmptyState ? 1 : Math.max(1, Math.ceil(allSteps.length / 12));
    const xTicks = isEmptyState ? d3.range(1, 7) : allSteps.filter((step, index) => index % stepStride === 0 || step === maxSteps);
    const yDomain = activeEventsOrder.slice();
    const denseMode = routesForChart.length > 120;

    const x = d3.scaleLinear().domain([1, maxSteps]).range([0, innerWidth]);
    const y = d3.scalePoint().domain(yDomain).range([0, innerHeight]).padding(0.5);
    const widthScale = d3
        .scaleLinear()
        .domain(d3.extent(routesForChart, (d) => d.totalStudents))
        .range(denseMode ? [1.0, 3.6] : [2.4, 8.5])
        .clamp(true);

    const svg = chartContainer
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-label", `${t(lang, "ariaJourneyIn")} ${activityName}`);

    const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    root
        .append("rect")
        .attr("class", "poc-chart-background-hit")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "transparent")
        .attr("pointer-events", "all")
        .on("click", () => {
            if (!state.selectedStoryId && !state.selectedRouteKey) {
                return;
            }

            state.selectedStoryId = null;
            state.selectedRouteKey = null;
            state.selectedRouteIndex = null;
            state.pinnedCoords = null;
            hideNarrativeTooltip(narrativeTooltip);
            onStateChange();
        });

    const rowStep = y.step ? y.step() : (innerHeight / Math.max(1, yDomain.length));
    const rowHeight = rowStep;
    const yDomainTopDown = yDomain
        .slice()
        .sort((a, b) => d3.ascending(y(a) ?? 0, y(b) ?? 0));

    renderInteractiveYAxisPanel({
        chartContainer,
        eventsOrder: yDomain,
        disabledEvents,
        y,
        margin,
        innerHeight,
        lang,
        isRecalculating: state.isRecalculating,
        onChange: onEventsOrderChange
    });

    root
        .append("g")
        .attr("class", "poc-row-stripes")
        .attr("pointer-events", "none")
        .selectAll("rect")
        .data(yDomainTopDown)
        .join("rect")
        .attr("x", 0)
        .attr("y", (eventLabel) => (y(eventLabel) ?? 0) - (rowHeight / 2))
        .attr("width", innerWidth)
        .attr("height", rowHeight)
        .attr("fill", (_, index) => (index % 2 === 0 ? DashboardTheme.system.zebraStripe : "transparent"));

    root
        .append("g")
        .attr("class", "y-grid")
        .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""))
        .call((axis) => axis.select(".domain").remove())
        .call((axis) => axis.selectAll("line").attr("stroke", DashboardTheme.system.axisGrid).attr("stroke-dasharray", "3 5"));

    root
        .append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickValues(xTicks).tickFormat((step) => `${step}`))
        .call((axis) => axis.selectAll("text").attr("fill", DashboardTheme.system.textSoft).style("font-size", "12px"))
        .call((axis) => axis.select(".domain").attr("stroke", DashboardTheme.system.borderStrong));

    const yAxis = root
        .append("g")
        .call(d3.axisLeft(y).tickPadding(0).tickSize(6).tickFormat(() => ""))
        .call((axis) => axis.select(".domain").attr("stroke", DashboardTheme.system.borderStrong));

    yAxis.selectAll("text").remove();

    const lineGenerator = d3
        .line()
        .x((d) => x(d.step + 1))
        .y((d) => y(d.event))
        .curve(d3.curveLinear);

    const routeGroup = root
        .append("g")
        .attr("class", "routes-layer")
        .selectAll(".route-group")
        .data(routesForChart, (d) => d.routeKey)
        .join("g")
        .attr("class", "route-group outline-none");

    const selectedRouteIndex = Number.isInteger(state.selectedRouteIndex) ? state.selectedRouteIndex : null;
    const selectedRoute = selectedRouteIndex != null ? routesForChart[selectedRouteIndex] || null : null;
    const selectedStory = state.selectedStoryId
        ? (stories || []).find((story) => String(story.id) === String(state.selectedStoryId)) || null
        : null;
    const selectedStorySemanticStroke = selectedStory
        ? (STORY_HIGHLIGHT_STROKES[selectedStory.highlight] || DashboardTheme.system.selectionFallback)
        : DashboardTheme.system.selectionFallback;
    let hoveredRouteKey = null;
    let isPinningInProgress = false;

    function hasPinnedStory() {
        return Boolean(state.selectedStoryId && state.selectedRouteIndex != null);
    }

    function hasPinnedSelection() {
        return Boolean(state.selectedRouteIndex != null);
    }

    function isTooltipLocked() {
        return hasPinnedStory() || hasPinnedSelection() || isPinningInProgress;
    }

    function isStoryRouteHighlighted(routeIndex) {
        return Boolean(state.selectedStoryId && selectedStoryRouteIndices.has(routeIndex));
    }

    function isHighlighted(routeData, routeIndex) {
        if (state.selectedStoryId) {
            return isStoryRouteHighlighted(routeIndex);
        }

        if (hoveredRouteKey && !state.selectedRouteKey) {
            return routeData.routeKey === hoveredRouteKey;
        }

        if (selectedRoute) {
            return routeData.routeKey === selectedRoute.routeKey;
        }

        return false;
    }

    function isPinnedRoute(routeData, routeIndex) {
        return Boolean(selectedRoute && routeIndex === selectedRouteIndex && routeData.routeKey === selectedRoute.routeKey);
    }

    function getRouteColor(routeData, routeIndex) {
        const storyHighlight = highlightByRoute.get(routeData.routeKey);

        if (state.selectedStoryId) {
            if (isStoryRouteHighlighted(routeIndex)) {
                return selectedStorySemanticStroke;
            }

            return ROUTE_BASE_STROKE;
        }

        if (isPinnedRoute(routeData, routeIndex)) {
            return storyHighlight
                ? (STORY_HIGHLIGHT_STROKES[storyHighlight.highlight] || DashboardTheme.system.selectionFallback)
                : ROUTE_SELECTED_NEUTRAL_STROKE;
        }

        if (state.selectedRouteKey) {
            return ROUTE_BASE_STROKE;
        }

        if (hoveredRouteKey && routeData.routeKey === hoveredRouteKey) {
            return storyHighlight
                ? (STORY_HIGHLIGHT_STROKES[storyHighlight.highlight] || DashboardTheme.system.selectionFallback)
                : ROUTE_SELECTED_NEUTRAL_STROKE;
        }

        return ROUTE_BASE_STROKE;
    }

    function getRouteOpacity(routeData, routeIndex) {
        if (state.selectedStoryId) {
            return isStoryRouteHighlighted(routeIndex) ? 1 : ROUTE_DIMMED_OPACITY;
        }

        if (isPinnedRoute(routeData, routeIndex)) {
            return 1;
        }

        if (state.selectedRouteKey) {
            return ROUTE_DIMMED_OPACITY;
        }

        if (hoveredRouteKey) {
            return routeData.routeKey === hoveredRouteKey ? DashboardTheme.opacities.hoverStrong : ROUTE_DIMMED_OPACITY;
        }

        return denseMode ? ROUTE_DIMMED_OPACITY : ROUTE_BASE_OPACITY;
    }

    function getRouteStrokeWidth(routeData, routeIndex) {
        const storyHighlight = highlightByRoute.get(routeData.routeKey);
        const baseWidth = widthScale(routeData.totalStudents);

        if (isStoryRouteHighlighted(routeIndex)) {
            return Math.max(baseWidth + 1.6, 4.2);
        }

        if (isPinnedRoute(routeData, routeIndex)) {
            return Math.max(baseWidth + 2.4, 4.8);
        }

        if (hoveredRouteKey && routeData.routeKey === hoveredRouteKey && !state.selectedRouteKey) {
            return Math.max(baseWidth + 1.4, 3.8);
        }

        if (state.selectedRouteKey) {
            return Math.max(0.8, baseWidth * 0.45);
        }

        if (storyHighlight) {
            return Math.max(baseWidth + 1.8, 4);
        }

        return Math.max(1.2, baseWidth * 0.7);
    }

    function applyRouteVisualState() {
        routeGroup.each(function (routeData, routeIndex) {
            const group = d3.select(this);
            const path = group.select(".route-path");
            const routeOpacity = getRouteOpacity(routeData, routeIndex);

            path
                .attr("stroke", getRouteColor(routeData, routeIndex))
                .attr("opacity", routeOpacity)
                .attr("stroke-width", getRouteStrokeWidth(routeData, routeIndex));

            group
                .selectAll(".route-dot")
                .style("opacity", Math.min(1, routeOpacity + DashboardTheme.opacities.iconBoost));

            group
                .selectAll(".route-dot-bg")
                .attr("stroke", (d) => EVENT_COLOR[d.event] || DashboardTheme.system.borderMuted)
                .style("opacity", Math.min(1, routeOpacity + DashboardTheme.opacities.markerBoost));

            group
                .selectAll(".route-dot-icon")
                .style("color", (d) => EVENT_COLOR[d.event] || DashboardTheme.system.textSoft);

            group
                .select(".route-terminal")
                .attr("stroke", isHighlighted(routeData, routeIndex) ? DashboardTheme.system.terminalAlert : DashboardTheme.system.borderMuted)
                .attr("opacity", isHighlighted(routeData, routeIndex) ? DashboardTheme.opacities.highlight : Math.max(DashboardTheme.opacities.terminalMin, routeOpacity + 0.08));
        });
    }

    let selectedStoryForPinned = null;
    let selectedStoryPointer = null;
    const selectedStoryPrimaryRouteIndex = state.selectedStoryId
        && Number.isInteger(state.selectedRouteIndex)
        && selectedStoryRouteIndices.has(state.selectedRouteIndex)
        ? state.selectedRouteIndex
        : (selectedStoryRouteIndices.size ? Math.min(...selectedStoryRouteIndices) : null);

    function getStoryMarkerPosition(points) {
        const dx = 15;
        const dy = -15;

        if (points.length >= 2) {
            const prev = points[points.length - 2];
            const curr = points[points.length - 1];

            return {
                x: ((x(prev.step + 1) + x(curr.step + 1)) / 2) + dx,
                y: ((y(prev.event) + y(curr.event)) / 2) + dy
            };
        }

        const only = points[0];
        return {
            x: x(only.step + 1) + dx,
            y: y(only.event) + dy
        };
    }

    routeGroup.each(function (routeData, routeIndex) {
        const group = d3.select(this);
        const points = routeData.route
            .filter((eventName) => activeEventSet.has(eventName))
            .map((eventName, step) => ({ event: eventName, step }));
        if (!points.length) {
            return;
        }
        const terminalPoint = points[points.length - 1];
        const submissionIndex = points.findIndex((point) => point.event === "assignment_sub");
        const submissionPoint = submissionIndex >= 0 ? points[submissionIndex] : null;
        const storyHighlight = highlightByRoute.get(routeData.routeKey) || null;
        const activeStory = storyHighlight
            ? ((storyHighlight.stories || []).find((story) => String(story.id) === String(state.selectedStoryId || "")) || storyHighlight.stories[0])
            : null;
        const activeStoryWithMetrics = activeStory
            ? { ...activeStory, __totalStudentsInScope: totalStudentsInScope }
            : null;
        const storyMarkerPosition = getStoryMarkerPosition(points);

        group
            .append("path")
            .attr("class", "route-path outline-none")
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("aria-label", `${t(lang, "ariaRouteWithStudents")} ${routeData.totalStudents} ${t(lang, "studentsWord")}`)
            .attr("d", lineGenerator(points))
            .attr("fill", "none")
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("stroke", getRouteColor(routeData, routeIndex))
            .attr("opacity", getRouteOpacity(routeData, routeIndex))
            .attr("stroke-width", getRouteStrokeWidth(routeData, routeIndex))
            .style("filter", storyHighlight ? DashboardTheme.system.dropShadowRoute : "none")
            .style("outline", "none")
            .style("cursor", "pointer")
            .on("mouseover", (event) => {
                hoveredRouteKey = routeData.routeKey;
                applyRouteVisualState();

                if (!isTooltipLocked() && storyHighlight && activeStoryWithMetrics) {
                    showNarrativeTooltip(narrativeTooltip, d3.pointer(event, chartContainer.node()), activeStoryWithMetrics, chartContainer.node(), lang);
                }
            })
            .on("mousemove", (event) => {
                if (isTooltipLocked()) {
                    return;
                }

                if (!hasPinnedStory() && storyHighlight && activeStoryWithMetrics) {
                    showNarrativeTooltip(narrativeTooltip, d3.pointer(event, chartContainer.node()), activeStoryWithMetrics, chartContainer.node(), lang);
                }
            })
            .on("mouseleave", () => {
                if (isTooltipLocked()) {
                    return;
                }

                hoveredRouteKey = null;
                applyRouteVisualState();

                if (!hasPinnedStory()) {
                    hideNarrativeTooltip(narrativeTooltip);
                }
            })
            .on("click", (event) => {
                event.stopPropagation();
                isPinningInProgress = true;

                const [xCoord, yCoord] = d3.pointer(event, chartContainer.node());

                const alreadySelected = state.selectedRouteIndex != null && routeIndex === state.selectedRouteIndex;
                state.selectedRouteKey = alreadySelected ? null : routeData.routeKey;
                state.selectedRouteIndex = alreadySelected ? null : routeIndex;
                state.selectedStoryId = !alreadySelected && activeStoryWithMetrics ? String(activeStoryWithMetrics.id) : null;
                state.pinnedCoords = !alreadySelected ? { x: xCoord, y: yCoord } : null;
                onStateChange();
            })
            .on("focus", () => {
                if (isPinningInProgress || hoveredRouteKey) {
                    return;
                }

                hoveredRouteKey = routeData.routeKey;
                applyRouteVisualState();

                if ((hasPinnedStory() && isHighlighted(routeData, routeIndex)) || (!hasPinnedStory() && activeStoryWithMetrics)) {
                    showNarrativeTooltip(
                        narrativeTooltip,
                        hasPinnedStory() && state.pinnedCoords
                            ? [state.pinnedCoords.x, state.pinnedCoords.y]
                            : [storyMarkerPosition.x, storyMarkerPosition.y],
                        activeStoryWithMetrics,
                        chartContainer.node(),
                        lang,
                        { pinned: hasPinnedStory() }
                    );
                }
            })
            .on("blur", () => {
                hoveredRouteKey = null;
                applyRouteVisualState();
                if (!hasPinnedStory()) {
                    hideNarrativeTooltip(narrativeTooltip);
                }
            })
            .on("keydown", (event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                isPinningInProgress = true;

                const alreadySelected = state.selectedRouteIndex != null && routeIndex === state.selectedRouteIndex;
                state.selectedRouteKey = alreadySelected ? null : routeData.routeKey;
                state.selectedRouteIndex = alreadySelected ? null : routeIndex;
                state.selectedStoryId = !alreadySelected && activeStoryWithMetrics ? String(activeStoryWithMetrics.id) : null;
                state.pinnedCoords = !alreadySelected
                    ? { x: storyMarkerPosition.x, y: storyMarkerPosition.y }
                    : null;
                onStateChange();
            });

        const routeNodes = group
            .selectAll(".route-node")
            .data(points)
            .join("g")
            .attr("class", "route-node")
            .style("pointer-events", "none");

        routeNodes.each(function (d) {
            const node = d3.select(this);
            node.selectAll("*").remove();

            appendEventNodeGlyph(node, d.event, {
                x: x(d.step + 1),
                y: y(d.event),
                circleRadius: 12,
                iconSize: 16,
                circleClass: "route-dot-bg",
                iconClass: "route-dot",
                iconInnerClass: "route-dot-icon",
                opacity: Math.min(1, getRouteOpacity(routeData, routeIndex) + DashboardTheme.opacities.markerBoost)
            });
        });

        if (!submissionPoint) {
            group
                .append("circle")
                .attr("class", "route-terminal")
                .attr("cx", x(terminalPoint.step + 1))
                .attr("cy", y(terminalPoint.event))
                .attr("r", 6)
                .attr("fill", DashboardTheme.system.bgWhite)
                .attr("stroke", DashboardTheme.system.borderMuted)
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "4 3")
                .attr("opacity", isHighlighted(routeData, routeIndex) ? DashboardTheme.opacities.highlight : DashboardTheme.opacities.terminalDefault)
                .style("pointer-events", "none");
        }

        if (isPinnedRoute(routeData, routeIndex) && storyHighlight && activeStoryWithMetrics) {
            selectedStoryForPinned = activeStoryWithMetrics;
            selectedStoryPointer = state.pinnedCoords
                ? [state.pinnedCoords.x, state.pinnedCoords.y]
                : null;
        }

        if (state.selectedStoryId && selectedStoryPrimaryRouteIndex != null && routeIndex === selectedStoryPrimaryRouteIndex && storyHighlight && activeStoryWithMetrics) {
            selectedStoryForPinned = activeStoryWithMetrics;
            selectedStoryPointer = state.pinnedCoords
                ? [state.pinnedCoords.x, state.pinnedCoords.y]
                : [storyMarkerPosition.x, storyMarkerPosition.y];
        }
    });

    applyRouteVisualState();

    if (selectedStoryForPinned && selectedStoryPointer) {
        showNarrativeTooltip(narrativeTooltip, selectedStoryPointer, selectedStoryForPinned, chartContainer.node(), lang, { pinned: true });
    } else {
        hideNarrativeTooltip(narrativeTooltip);
    }

    if (isEmptyState) {
        const emptyMessage = state.narrativeMode === "unfinished"
            ? `${t(lang, "emptyUnfinished")} ${activityName}.`
            : `${t(lang, "emptyFinished")} ${activityName}.`;

        chartContainer
            .append("div")
            .attr("class", "poc-empty-overlay")
            .html(`<span>${escapeHtml(emptyMessage)}</span>`);
    }

    if (hiddenRoutesCount > 0) {
        chartContainer
            .append("div")
            .attr("class", "poc-render-note")
            .style("position", "absolute")
            .style("left", "12px")
            .style("bottom", "10px")
            .style("padding", "4px 8px")
            .style("border-radius", "999px")
            .style("font-size", "11px")
            .style("font-weight", "700")
            .style("background", DashboardTheme.system.pillBg)
            .style("border", `1px solid ${DashboardTheme.system.borderMuted}`)
            .style("color", DashboardTheme.system.textEmphasis)
            .text(`${t(lang, "showingRoutes")} ${routesForChart.length} ${t(lang, "ofRoutes")} ${routesToRender.length} ${t(lang, "routesCountSuffix")}.`);
    }
}

async function renderStudentJourneyPoC() {
    const chartContainer = d3.select("#poc-dashboard-container");
    const activitySelect = d3.select("#poc-activity-select");
    const minVolumeSlider = d3.select("#poc-min-volume");
    const minVolumeValue = d3.select("#poc-min-volume-value");
    const minVolumeLabel = d3.select("#poc-volume-label");
    const titleNode = d3.select("#poc-title");
    const detailPanel = d3.select("#poc-panel-content");
    const detailPanelContainer = d3.select("#poc-detail-panel");
    const btnAll = d3.select("#btn-all");
    const btnDrop = d3.select("#btn-drop");
    const langPtBtn = d3.select("#lang-pt");
    const langEnBtn = d3.select("#lang-en");

    if (
        chartContainer.empty() ||
        activitySelect.empty() ||
        minVolumeSlider.empty() ||
        minVolumeValue.empty() ||
        minVolumeLabel.empty() ||
        titleNode.empty() ||
        detailPanel.empty() ||
        detailPanelContainer.empty() ||
        btnAll.empty() ||
        btnDrop.empty() ||
        langPtBtn.empty() ||
        langEnBtn.empty()
    ) {
        console.error("POC elements not found");
        return;
    }

    try {
        const dataStore = await loadDashboardData();

        if (!dataStore.quizList.length) {
            throw new Error("Nenhuma atividade retornada pela API.");
        }

        activitySelect.selectAll("option").remove();
        activitySelect
            .selectAll("option")
            .data(dataStore.quizList)
            .enter()
            .append("option")
            .attr("value", (_, index) => index)
            .text((d) => d.name);

        const state = {
            activityIndex: 0,
            minVolume: 10,
            narrativeMode: "finished",
            lang: "en",
            isRecalculating: false,
            eventsOrder: DEFAULT_EVENTS_ORDER.slice(),
            disabledEvents: [],
            selectedRouteKey: null,
            selectedStoryId: null,
            selectedRouteIndex: null,
            pinnedCoords: null,
        };

        let currentGroupedRoutes = [];
        let currentTimeline = dataStore.timelinesByQuizId[dataStore.quizList[0].id];

        function getSelectedActivity() {
            const parsedIndex = Number(state.activityIndex);
            const safeIndex = Number.isNaN(parsedIndex) ? 0 : parsedIndex;
            return dataStore.quizList[safeIndex] || dataStore.quizList[0];
        }

        function getGroupedRoutesForCurrentActivity() {
            const selectedActivity = getSelectedActivity();
            const activeEvents = getOrderedEvents(state);

            currentTimeline = dataStore.timelinesByQuizId[selectedActivity.id];

            if (!currentTimeline) {
                throw new Error(`Timeline não encontrada para a atividade ${selectedActivity.name}.`);
            }

            const userRoutes = buildUserRoutesFromTimeline(currentTimeline.users, activeEvents);

            return {
                selectedActivity,
                groupedRoutes: groupRoutes(userRoutes)
            };
        }

        async function recalculateTimelineForEventConfig({ activeEvents, disabledEvents }) {
            const selectedActivity = getSelectedActivity();

            state.eventsOrder = activeEvents.slice();
            state.disabledEvents = disabledEvents.slice();
            state.isRecalculating = true;
            refreshView();

            try {
                const payload = buildTimelineRequest(selectedActivity.id, {
                    event_classes: activeEvents.slice(),
                    story_params: {
                        fluxo_ideal: activeEvents.slice(),
                        evento_marco: activeEvents[0] || null
                    }
                });

                const recalculatedTimeline = await fetchJson("/api/timeline", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });

                dataStore.timelinesByQuizId[selectedActivity.id] = recalculatedTimeline;
                currentTimeline = recalculatedTimeline;
                state.selectedRouteKey = null;
                state.selectedStoryId = null;
                state.selectedRouteIndex = null;
                state.pinnedCoords = null;
            } catch (error) {
                console.error("Falha ao recalcular timeline com nova ordem:", error);
            } finally {
                state.isRecalculating = false;
                refreshView();
            }
        }

        function refreshView() {
            applyUiTranslations(state);

            const activityData = getGroupedRoutesForCurrentActivity();
            currentGroupedRoutes = activityData.groupedRoutes;
            const activityName = currentTimeline?.quiz?.name || activityData.selectedActivity.name;

            const visibleRoutes = buildNarrativeRoutes(currentGroupedRoutes, state.narrativeMode, state.minVolume);
            if (state.selectedRouteKey && !visibleRoutes.some((route) => route.routeKey === state.selectedRouteKey)) {
                state.selectedRouteKey = null;
                state.selectedRouteIndex = null;
                state.pinnedCoords = null;
            }

            btnAll.attr("disabled", null);
            btnDrop.attr("disabled", null);
            activitySelect.attr("disabled", null);
            minVolumeSlider.attr("disabled", null);

            if (state.isRecalculating) {
                btnAll.attr("disabled", true);
                btnDrop.attr("disabled", true);
                activitySelect.attr("disabled", true);
                minVolumeSlider.attr("disabled", true);
            }

            renderTrajectoryChart({
                chartContainer,
                titleNode,
                detailPanel,
                detailPanelContainer,
                btnAll,
                btnDrop,
                groupedRoutes: currentGroupedRoutes,
                stories: currentTimeline?.stories ?? [],
                activityName,
                state,
                onStateChange: refreshView,
                onEventsOrderChange: recalculateTimelineForEventConfig
            });

            setTimelineLoadingOverlay(chartContainer, state.lang, state.isRecalculating);

            const maxVolume = d3.max(currentGroupedRoutes, (routeData) => routeData.totalStudents) || 1;
            minVolumeSlider
                .attr("max", Math.max(10, Math.min(50, maxVolume)))
                .property("value", state.minVolume)
                .attr("disabled", state.isRecalculating ? true : null);
            minVolumeLabel.html(`${escapeHtml(t(state.lang, "minVolumePrefix"))} <strong id="poc-min-volume-value">${escapeHtml(String(state.minVolume))}</strong> ${escapeHtml(t(state.lang, "minVolumeSuffix"))}`);

            const refreshedMinVolumeValue = d3.select("#poc-min-volume-value");
            if (!refreshedMinVolumeValue.empty()) {
                refreshedMinVolumeValue.text(state.minVolume);
            }

            detailPanelContainer.style("display", "block");
            activitySelect.property("value", String(state.activityIndex));
        }

        activitySelect.on("change", function () {
            state.activityIndex = Number(this.value) || 0;
            state.minVolume = 10;
            state.narrativeMode = "finished";
            state.selectedRouteKey = null;
            state.selectedStoryId = null;
            state.selectedRouteIndex = null;
            state.pinnedCoords = null;

            if (hasCustomizedEventConfiguration(state)) {
                recalculateTimelineForEventConfig({
                    activeEvents: getOrderedEvents(state),
                    disabledEvents: getDisabledEvents(state)
                });
                return;
            }

            refreshView();
        });

        minVolumeSlider.on("input", function () {
            state.minVolume = Number(this.value) || 10;
            refreshView();
        });

        btnAll.on("click", () => {
            state.narrativeMode = "finished";
            state.selectedRouteKey = null;
            state.selectedStoryId = null;
            state.selectedRouteIndex = null;
            state.pinnedCoords = null;
            refreshView();
        });

        btnDrop.on("click", () => {
            state.narrativeMode = "unfinished";
            state.selectedRouteKey = null;
            state.selectedStoryId = null;
            state.selectedRouteIndex = null;
            state.pinnedCoords = null;
            refreshView();
        });

        langPtBtn.on("click", () => {
            if (state.lang === "pt") return;
            state.lang = "pt";
            refreshView();
        });

        langEnBtn.on("click", () => {
            if (state.lang === "en") return;
            state.lang = "en";
            refreshView();
        });

        refreshView();
    } catch (error) {
        console.error("Error rendering PoC:", error);
        chartContainer.selectAll("*").remove();
        chartContainer
            .append("div")
            .style("padding", "24px")
            .style("color", DashboardTheme.system.dangerText)
            .text(`Erro ao carregar dados da PoC: ${error.message}`);
    }
}

export default renderStudentJourneyPoC;
