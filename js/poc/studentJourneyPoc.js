import loadDashboardData from "./loadDashboardData.js";

const EVENT_ORDER = [
    "resource_vis",
    "forum_vis",
    "forum_participation",
    "assignment_vis",
    "assignment_try",
    "assignment_sub"
];


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
        .style("background", "rgba(248, 250, 252, 0.98)")
        .style("border", "1px solid rgba(100, 116, 139, 0.25)")
        .style("box-shadow", "0 12px 28px rgba(15, 23, 42, 0.14)")
        .style("color", "#1f2937")
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

function showNarrativeTooltip(tooltip, pointer, story, containerNode) {
    if (!tooltip || !story) return;

    const containerWidth = containerNode?.clientWidth || 0;
    const containerHeight = containerNode?.clientHeight || 0;
    const tooltipWidth = 340;
    const fallbackX = (pointer?.[0] ?? 0) + 16;
    const fallbackY = (pointer?.[1] ?? 0) - 12;
    const left = containerWidth > 0
        ? Math.max(8, Math.min(fallbackX, containerWidth - tooltipWidth - 8))
        : fallbackX;
    const top = containerHeight > 0
        ? Math.max(8, Math.min(fallbackY, containerHeight - 120))
        : fallbackY;

    const tone = STORY_HIGHLIGHT_TONES[story.highlight] || STORY_HIGHLIGHT_TONES.attention;
    const affectedCount = getStoryAffectedCount(story);
    const affectedPct = getStoryAffectedPercentage(story, affectedCount);
    const affectedPctLabel = Number.isFinite(affectedPct) ? `${affectedPct.toFixed(1)}%` : "--";
    const parameterEntries = Object.entries(story?.parameters || {});
    const parametersMarkup = parameterEntries.length
        ? `
            <div style="display:grid; gap:5px; margin-top:2px;">
                <div style="font-size:10px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; color:#64748b;">Parâmetros</div>
                ${parameterEntries
                    .map(([key, value]) => `
                        <div style="display:grid; grid-template-columns:max-content minmax(0,1fr); gap:6px; align-items:start; font-size:11px;">
                            <span style="font-weight:800; color:#475569;">${escapeHtml(key)}</span>
                            <span style="color:#334155;">${escapeHtml(formatStoryParameterValue(value))}</span>
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
        .html(`
            <div style="display:grid; gap:6px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; padding:4px 8px; border-radius:999px; background:${tone.soft}; border:1px solid ${tone.accent}33; color:${tone.accent}; font-size:10px; font-weight:900; letter-spacing:.06em; text-transform:uppercase;">${escapeHtml(tone.label)}</span>
                    <span style="display:inline-flex; align-items:center; justify-content:center; padding:4px 8px; border-radius:999px; background:#f1f5f9; border:1px solid #cbd5e1; color:#334155; font-size:10px; font-weight:900;">${escapeHtml(story.id)}</span>
                </div>
                <div style="font-weight:900;">${escapeHtml(story.title)}</div>
                <div>${escapeHtml(story.question)}</div>
                <div style="padding:6px 8px; border-radius:8px; background:#f8fafc; border:1px solid #dbe3ed; color:#334155;">Alunos: <strong>${escapeHtml(String(affectedCount))}</strong> (${escapeHtml(affectedPctLabel)})</div>
                ${parametersMarkup}
            </div>
        `);
}

function hideNarrativeTooltip(tooltip) {
    if (!tooltip || tooltip.empty()) return;
    tooltip.style("display", "none");
}
const EVENT_LABEL = {
    resource_vis: "Vis. de recursos",
    forum_vis: "Forum",
    forum_participation: "Part. forum",
    assignment_vis: "Vis. da atividade",
    assignment_try: "Tentativa",
    assignment_sub: "Entrega"
};

const EVENT_COLOR = {
    resource_vis: "#e64a19",
    forum_vis: "#ff94c2",
    forum_participation: "#00bcd4",
    assignment_vis: "#00897b",
    assignment_try: "#819ca9",
    assignment_sub: "#c0ca33"
};

const EVENT_FA_ICON = {
    resource_vis: { className: "fa-folder-open", color: "#e64a19" },
    forum_vis: { className: "fa-comments", color: "#ff94c2" },
    forum_participation: { className: "fa-comment-medical", color: "#00bcd4" },
    assignment_vis: { className: "fa-file-alt", color: "#00897b" },
    assignment_try: { className: "fa-check", color: "#819ca9" },
    assignment_sub: { className: "fa-check-double", color: "#c0ca33" }
};

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

function getStatusMarkup(hasSubmission) {
    return hasSubmission
        ? `<span class="poc-route-status is-finished">${svgIconMarkup("assignment_sub", "")}Trajetória finalizada</span>`
        : `<span class="poc-route-status is-unfinished">${svgIconMarkup("assignment_try", "")}Trajetória não finalizada</span>`;
}

function getEventChipMarkup(eventName) {
    const label = EVENT_LABEL[eventName] || eventName;
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

function buildUserRoutesFromTimeline(users) {
    if (!Array.isArray(users)) {
        return [];
    }

    return users
        .map((user) => {
            const route = (user.events || [])
                .map((eventData) => String(eventData.class || eventData.event || "").trim())
                .map((eventName) => eventName.split("_SOME")[0].split("_MANY")[0].split("_START")[0].split("_END")[0])
                .filter((eventName) => EVENT_ORDER.includes(eventName));

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
    deadline: { label: "Prazo e urgência", icon: "clock" },
    prep: { label: "Preparação e percurso", icon: "route" },
    bottleneck: { label: "Gargalos de conversão", icon: "user-exclamation" },
    social: { label: "Fórum e engajamento social", icon: "comments" },
    rhythm: { label: "Ritmo de estudo", icon: "running" },
    profile: { label: "Perfis comportamentais", icon: "lightbulb" }
};

const STORY_HIGHLIGHT_LABELS = {
    risk: "Risco",
    good: "Positiva",
    attention: "Atenção"
};

const STORY_HIGHLIGHT_TONES = {
    risk: { label: "Risco Alto", accent: "#c44", soft: "rgba(196, 68, 68, 0.12)" },
    good: { label: "Positiva", accent: "#2f8f5b", soft: "rgba(47, 143, 91, 0.12)" },
    attention: { label: "Atenção", accent: "#b46f12", soft: "rgba(180, 111, 18, 0.12)" }
};

const STORY_HIGHLIGHT_STROKES = {
    risk: "#c44",
    good: "#2f8f5b",
    attention: "#c58a1a"
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function getStoryCategoryMeta(category) {
    return STORY_CATEGORY_META[category] || { label: category || "Outras narrativas", icon: "bulb" };
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

function renderStoryMenuPanel(detailPanelSelection, stories, selectedStoryId, onStorySelect) {
    const grouped = groupStories(stories || []);

    if (!grouped.length) {
        detailPanelSelection.html(`
            <div class="poc-story-nav">
                <p class="poc-story-nav__empty">Nenhuma estoria foi retornada para esta atividade.</p>
            </div>
        `);
        return;
    }

    const html = `
        <div class="poc-story-nav">
            <div class="poc-story-list-scroll">
                ${grouped
                    .map(({ category, items }) => {
                        const categoryMeta = getStoryCategoryMeta(category);
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
                                                title="${escapeHtml(story.title || "Estoria")}">
                                                <div class="poc-story-item__meta">
                                                    <span class="poc-story-item__id">${escapeHtml(String(story.id || "S"))}</span>
                                                    <span class="poc-story-item__badge">${escapeHtml(String(affectedCount))}</span>
                                                </div>
                                                <div class="poc-story-item__title">${escapeHtml(story.title || "Sem titulo")}</div>
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
    onStateChange
}) {
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

    renderStoryMenuPanel(detailPanel, stories, state.selectedStoryId, (storyId) => {
        if (String(state.selectedStoryId) === String(storyId)) {
            state.selectedStoryId = null;
            state.selectedRouteKey = null;
            state.selectedRouteIndex = null;
            state.pinnedCoords = null;
        } else {
            state.selectedStoryId = String(storyId);
            state.selectedRouteKey = storyIdToRouteKey.get(String(storyId))?.routeKey || null;
            state.selectedRouteIndex = state.selectedRouteKey && routeKeyToIndex.has(state.selectedRouteKey)
                ? routeKeyToIndex.get(state.selectedRouteKey)
                : null;
            state.pinnedCoords = null;
        }

        onStateChange();
    });
    detailPanelContainer.style("display", "block");

    const totalRoutes = routesToRender.length;
    const modeLabel = state.narrativeMode === "unfinished"
        ? "Trajetórias não finalizadas"
        : "Trajetórias finalizadas";

    titleNode.text(
        totalRoutes > 0
            ? `${modeLabel} em ${activityName} (${totalRoutes} rotas)`
            : `Sem rotas suficientes em ${activityName}.`
    );
    btnAll.classed("is-active", state.narrativeMode === "finished");
    btnDrop.classed("is-active", state.narrativeMode === "unfinished");

    const isEmptyState = totalRoutes === 0;

    const width = chartContainer.node().clientWidth || 1100;
    const availableHeight = detailPanelContainer.node().clientHeight || chartContainer.node().clientHeight || 420;
    const height = Math.max(240, availableHeight);
    const margin = { top: 16, right: 20, bottom: 48, left: 190 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const maxSteps = isEmptyState ? 6 : (d3.max(groupedRoutes, (d) => d.route.length) || 1);
    const allSteps = d3.range(1, maxSteps + 1);
    const stepStride = isEmptyState ? 1 : Math.max(1, Math.ceil(allSteps.length / 12));
    const xTicks = isEmptyState ? d3.range(1, 7) : allSteps.filter((step, index) => index % stepStride === 0 || step === maxSteps);
    const yDomain = EVENT_ORDER.map((eventName) => EVENT_LABEL[eventName]);
    const denseMode = routesForChart.length > 120;

    const x = d3.scaleLinear().domain([1, maxSteps]).range([0, innerWidth]);
    const y = d3.scalePoint().domain(yDomain).range([innerHeight, 0]).padding(0.5);
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
        .attr("aria-label", `Jornada dos estudantes em ${activityName}`);

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
        .attr("fill", (_, index) => (index % 2 === 0 ? "rgba(0, 0, 0, 0.03)" : "transparent"));

    root
        .append("g")
        .attr("class", "y-grid")
        .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""))
        .call((axis) => axis.select(".domain").remove())
        .call((axis) => axis.selectAll("line").attr("stroke", "#e2e8f0").attr("stroke-dasharray", "3 5"));

    root
        .append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickValues(xTicks).tickFormat((step) => `${step}`))
        .call((axis) => axis.selectAll("text").attr("fill", "#64748b").style("font-size", "12px"))
        .call((axis) => axis.select(".domain").attr("stroke", "#94a3b8"));

    const yAxis = root
        .append("g")
        .call(d3.axisLeft(y).tickPadding(0).tickSize(6))
        .call((axis) => axis.selectAll("text")
            .attr("fill", "#475569")
            .style("font-size", "12px")
            .style("text-anchor", "start")
            .attr("x", -130))
        .call((axis) => axis.select(".domain").attr("stroke", "#94a3b8"));

    yAxis.selectAll(".tick").each(function (eventLabel) {
        const eventName = EVENT_ORDER.find((name) => EVENT_LABEL[name] === eventLabel);
        const iconInfo = eventName ? getEventIcon(eventName) : null;

        if (!iconInfo) {
            return;
        }

        const tick = d3.select(this);

        tick
            .insert("circle", ":first-child")
            .attr("class", "poc-yaxis-icon-bg")
            .attr("cx", -146)
            .attr("cy", 0)
            .attr("r", 12)
            .attr("fill", "#ffffff")
            .attr("stroke", EVENT_COLOR[eventName] || "#cbd5e1")
            .attr("stroke-width", 2.8)
            .style("pointer-events", "none");

        const iconBox = tick
            .insert("foreignObject", ":first-child")
            .attr("class", "poc-yaxis-icon")
            .attr("x", -155)
            .attr("y", -9)
            .attr("width", 18)
            .attr("height", 18)
            .style("overflow", "visible")
            .style("pointer-events", "none");

        appendFaIcon(iconBox, iconInfo, 16, {
            colorOverride: EVENT_COLOR[eventName] || iconInfo.color,
            className: "route-dot-icon"
        });
    });

    const lineGenerator = d3
        .line()
        .x((d) => x(d.step + 1))
        .y((d) => y(EVENT_LABEL[d.event]))
        .curve(d3.curveLinear);

    const routeGroup = root
        .append("g")
        .attr("class", "routes-layer")
        .selectAll(".route-group")
        .data(routesForChart, (d) => d.routeKey)
        .join("g")
        .attr("class", "route-group");

    const selectedRouteIndex = Number.isInteger(state.selectedRouteIndex) ? state.selectedRouteIndex : null;
    const selectedRoute = selectedRouteIndex != null ? routesForChart[selectedRouteIndex] || null : null;
    const selectedStory = state.selectedStoryId
        ? (stories || []).find((story) => String(story.id) === String(state.selectedStoryId)) || null
        : null;
    const selectedStorySemanticStroke = selectedStory
        ? (STORY_HIGHLIGHT_STROKES[selectedStory.highlight] || "#2563eb")
        : "#2563eb";
    let hoveredRouteKey = null;

    function hasPinnedStory() {
        return Boolean(state.selectedStoryId && state.selectedRouteIndex != null);
    }

    function isHighlighted(routeData, routeIndex) {
        if (state.selectedStoryId) {
            return state.selectedRouteIndex != null && routeIndex === state.selectedRouteIndex;
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
            if (state.selectedRouteIndex != null && routeIndex === state.selectedRouteIndex) {
                return selectedStorySemanticStroke;
            }

            return "#cbd5e1";
        }

        if (isPinnedRoute(routeData, routeIndex)) {
            return storyHighlight
                ? (STORY_HIGHLIGHT_STROKES[storyHighlight.highlight] || "#2563eb")
                : "#475569";
        }

        if (state.selectedRouteKey) {
            return "#cbd5e1";
        }

        if (hoveredRouteKey && routeData.routeKey === hoveredRouteKey) {
            return "#94a3b8";
        }

        return "#cbd5e1";
    }

    function getRouteOpacity(routeData, routeIndex) {
        if (state.selectedStoryId) {
            return state.selectedRouteIndex != null && routeIndex === state.selectedRouteIndex ? 1 : 0.25;
        }

        if (isPinnedRoute(routeData, routeIndex)) {
            return 1;
        }

        if (state.selectedRouteKey) {
            return denseMode ? 0.25 : 0.3;
        }

        if (hoveredRouteKey) {
            return routeData.routeKey === hoveredRouteKey ? 0.95 : (denseMode ? 0.25 : 0.3);
        }

        return denseMode ? 0.25 : 0.3;
    }

    function getRouteStrokeWidth(routeData, routeIndex) {
        const storyHighlight = highlightByRoute.get(routeData.routeKey);
        const baseWidth = widthScale(routeData.totalStudents);

        if (state.selectedStoryId && state.selectedRouteIndex != null && routeIndex === state.selectedRouteIndex) {
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
                .style("opacity", Math.min(1, routeOpacity + 0.22));

            group
                .selectAll(".route-dot-bg")
                .attr("stroke", (d) => EVENT_COLOR[d.event] || "#cbd5e1")
                .style("opacity", Math.min(1, routeOpacity + 0.26));

            group
                .selectAll(".route-dot-icon")
                .style("color", (d) => EVENT_COLOR[d.event] || "#64748b");

            group
                .select(".route-terminal")
                .attr("stroke", isHighlighted(routeData, routeIndex) ? "#ef4444" : "#cbd5e1")
                .attr("opacity", isHighlighted(routeData, routeIndex) ? 1 : Math.max(0.3, routeOpacity + 0.08));
        });
    }

    let selectedStoryForPinned = null;
    let selectedStoryPointer = null;

    function getStoryMarkerPosition(points) {
        const dx = 15;
        const dy = -15;

        if (points.length >= 2) {
            const prev = points[points.length - 2];
            const curr = points[points.length - 1];

            return {
                x: ((x(prev.step + 1) + x(curr.step + 1)) / 2) + dx,
                y: ((y(EVENT_LABEL[prev.event]) + y(EVENT_LABEL[curr.event])) / 2) + dy
            };
        }

        const only = points[0];
        return {
            x: x(only.step + 1) + dx,
            y: y(EVENT_LABEL[only.event]) + dy
        };
    }

    routeGroup.each(function (routeData, routeIndex) {
        const group = d3.select(this);
        const points = routeData.route
            .filter((eventName) => EVENT_ORDER.includes(eventName))
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
            .attr("class", "route-path")
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("aria-label", `Trajetoria com ${routeData.totalStudents} estudantes`)
            .attr("d", lineGenerator(points))
            .attr("fill", "none")
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("stroke", getRouteColor(routeData, routeIndex))
            .attr("opacity", getRouteOpacity(routeData, routeIndex))
            .attr("stroke-width", getRouteStrokeWidth(routeData, routeIndex))
            .style("filter", storyHighlight ? "drop-shadow(0 0 4px rgba(0,0,0,0.12))" : "none")
            .on("mouseover", (event) => {
                hoveredRouteKey = routeData.routeKey;
                applyRouteVisualState();

                if (!hasPinnedStory() && storyHighlight && activeStoryWithMetrics) {
                    showNarrativeTooltip(narrativeTooltip, d3.pointer(event, chartContainer.node()), activeStoryWithMetrics, chartContainer.node());
                }
            })
            .on("mousemove", (event) => {
                if (!hasPinnedStory() && storyHighlight && activeStoryWithMetrics) {
                    showNarrativeTooltip(narrativeTooltip, d3.pointer(event, chartContainer.node()), activeStoryWithMetrics, chartContainer.node());
                }
            })
            .on("mouseout", () => {
                hoveredRouteKey = null;
                applyRouteVisualState();

                if (!hasPinnedStory()) {
                    hideNarrativeTooltip(narrativeTooltip);
                }
            })
            .on("click", (event) => {
                event.stopPropagation();

                const [xCoord, yCoord] = d3.pointer(event, chartContainer.node());

                const alreadySelected = state.selectedRouteIndex != null && routeIndex === state.selectedRouteIndex;
                state.selectedRouteKey = alreadySelected ? null : routeData.routeKey;
                state.selectedRouteIndex = alreadySelected ? null : routeIndex;
                state.selectedStoryId = !alreadySelected && activeStoryWithMetrics ? String(activeStoryWithMetrics.id) : null;
                state.pinnedCoords = !alreadySelected ? { x: xCoord, y: yCoord } : null;
                onStateChange();
            })
            .on("focus", () => {
                hoveredRouteKey = routeData.routeKey;
                applyRouteVisualState();

                if ((hasPinnedStory() && isHighlighted(routeData, routeIndex)) || (!hasPinnedStory() && activeStoryWithMetrics)) {
                    showNarrativeTooltip(
                        narrativeTooltip,
                        hasPinnedStory() && state.pinnedCoords
                            ? [state.pinnedCoords.x, state.pinnedCoords.y]
                            : [storyMarkerPosition.x, storyMarkerPosition.y],
                        activeStoryWithMetrics,
                        chartContainer.node()
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

                const alreadySelected = state.selectedRouteIndex != null && routeIndex === state.selectedRouteIndex;
                state.selectedRouteKey = alreadySelected ? null : routeData.routeKey;
                state.selectedRouteIndex = alreadySelected ? null : routeIndex;
                state.selectedStoryId = !alreadySelected && activeStoryWithMetrics ? String(activeStoryWithMetrics.id) : null;
                state.pinnedCoords = !alreadySelected
                    ? { x: storyMarkerPosition.x, y: storyMarkerPosition.y }
                    : null;
                onStateChange();
            });

        group
            .selectAll(".route-dot-bg")
            .data(points)
            .join("circle")
            .attr("class", "route-dot-bg")
            .attr("cx", (d) => x(d.step + 1))
            .attr("cy", (d) => y(EVENT_LABEL[d.event]))
            .attr("r", 12)
            .attr("fill", "#ffffff")
            .attr("stroke", (d) => EVENT_COLOR[d.event] || "#cbd5e1")
            .attr("stroke-width", 2.8)
            .style("pointer-events", "none")
            .style("opacity", Math.min(1, getRouteOpacity(routeData, routeIndex) + 0.26));

        group
            .selectAll(".route-dot")
            .data(points)
            .join("foreignObject")
            .attr("class", "route-dot")
            .attr("x", (d) => x(d.step + 1) - 9)
            .attr("y", (d) => y(EVENT_LABEL[d.event]) - 9)
            .attr("width", 18)
            .attr("height", 18)
            .style("overflow", "visible")
            .style("pointer-events", "none")
            .style("opacity", Math.min(1, getRouteOpacity(routeData, routeIndex) + 0.22));

        group
            .selectAll(".route-dot")
            .each(function (d) {
                const iconInfo = getEventIcon(d.event);

                if (!iconInfo) {
                    return;
                }

                appendFaIcon(d3.select(this), iconInfo, 16, {
                    colorOverride: EVENT_COLOR[d.event] || iconInfo.color,
                    className: "route-dot-icon"
                });
            });

        if (!submissionPoint) {
            group
                .append("circle")
                .attr("class", "route-terminal")
                .attr("cx", x(terminalPoint.step + 1))
                .attr("cy", y(EVENT_LABEL[terminalPoint.event]))
                .attr("r", 6)
                .attr("fill", "#ffffff")
                .attr("stroke", "#cbd5e1")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "4 3")
                .attr("opacity", isHighlighted(routeData, routeIndex) ? 1 : 0.7)
                .style("pointer-events", "none");
        }

        if (isPinnedRoute(routeData, routeIndex) && storyHighlight && activeStoryWithMetrics) {
            selectedStoryForPinned = activeStoryWithMetrics;
            selectedStoryPointer = state.pinnedCoords
                ? [state.pinnedCoords.x, state.pinnedCoords.y]
                : null;
        }
    });

    applyRouteVisualState();

    if (selectedStoryForPinned && selectedStoryPointer) {
        showNarrativeTooltip(narrativeTooltip, selectedStoryPointer, selectedStoryForPinned, chartContainer.node());
    } else {
        hideNarrativeTooltip(narrativeTooltip);
    }

    if (isEmptyState) {
        const emptyMessage = state.narrativeMode === "unfinished"
            ? `Nenhuma trajetória não finalizada atende aos filtros atuais para ${activityName}.`
            : `Nenhuma trajetória finalizada atende aos filtros atuais para ${activityName}.`;

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
            .style("background", "rgba(248, 250, 252, 0.94)")
            .style("border", "1px solid #cbd5e1")
            .style("color", "#475569")
            .text(`Mostrando ${routesForChart.length} de ${routesToRender.length} rotas.`);
    }
}

async function renderStudentJourneyPoC() {
    const chartContainer = d3.select("#poc-dashboard-container");
    const activitySelect = d3.select("#poc-activity-select");
    const minVolumeSlider = d3.select("#poc-min-volume");
    const minVolumeValue = d3.select("#poc-min-volume-value");
    const titleNode = d3.select("#poc-title");
    const detailPanel = d3.select("#poc-panel-content");
    const detailPanelContainer = d3.select("#poc-detail-panel");
    const btnAll = d3.select("#btn-all");
    const btnDrop = d3.select("#btn-drop");

    if (
        chartContainer.empty() ||
        activitySelect.empty() ||
        minVolumeSlider.empty() ||
        minVolumeValue.empty() ||
        titleNode.empty() ||
        detailPanel.empty() ||
        detailPanelContainer.empty() ||
        btnAll.empty() ||
        btnDrop.empty()
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
            selectedRouteKey: null,
            selectedStoryId: null,
            selectedRouteIndex: null,
            pinnedCoords: null,
        };

        let currentGroupedRoutes = [];
        let currentTimeline = dataStore.timelinesByQuizId[dataStore.quizList[0].id];

        function getGroupedRoutesForCurrentActivity() {
            const parsedIndex = Number(state.activityIndex);
            const safeIndex = Number.isNaN(parsedIndex) ? 0 : parsedIndex;
            const selectedActivity = dataStore.quizList[safeIndex] || dataStore.quizList[0];

            currentTimeline = dataStore.timelinesByQuizId[selectedActivity.id];

            if (!currentTimeline) {
                throw new Error(`Timeline não encontrada para a atividade ${selectedActivity.name}.`);
            }

            const userRoutes = buildUserRoutesFromTimeline(currentTimeline.users);

            return {
                selectedActivity,
                groupedRoutes: groupRoutes(userRoutes)
            };
        }

        function refreshView() {
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
                onStateChange: refreshView
            });

            const maxVolume = d3.max(currentGroupedRoutes, (routeData) => routeData.totalStudents) || 1;
            minVolumeSlider
                .attr("max", Math.max(10, Math.min(50, maxVolume)))
                .property("value", state.minVolume)
                .attr("disabled", null);
            minVolumeValue.text(state.minVolume);

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
            refreshView();
        });

        minVolumeSlider.on("input", function () {
            state.minVolume = Number(this.value) || 10;
            minVolumeValue.text(state.minVolume);
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

        refreshView();
    } catch (error) {
        console.error("Error rendering PoC:", error);
        chartContainer.selectAll("*").remove();
        chartContainer
            .append("div")
            .style("padding", "24px")
            .style("color", "#c44")
            .text(`Erro ao carregar dados da PoC: ${error.message}`);
    }
}

export default renderStudentJourneyPoC;
