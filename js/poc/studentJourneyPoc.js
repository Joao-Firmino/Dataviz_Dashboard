import loadDashboardData from "./loadDashboardData.js";

const EVENT_ORDER = [
    "course_vis",
    "resource_vis",
    "forum_vis",
    "forum_participation",
    "assignment_vis",
    "assignment_try",
    "assignment_sub"
];

const EVENT_LABEL = {
    course_vis: "Vis. do curso",
    resource_vis: "Vis. de recursos",
    forum_vis: "Forum",
    forum_participation: "Part. forum",
    assignment_vis: "Vis. da atividade",
    assignment_try: "Tentativa",
    assignment_sub: "Entrega"
};

const EVENT_COLOR = {
    course_vis: "#8d6e63",
    resource_vis: "#e64a19",
    forum_vis: "#ff94c2",
    forum_participation: "#00bcd4",
    assignment_vis: "#00897b",
    assignment_try: "#819ca9",
    assignment_sub: "#c0ca33"
};

const EVENT_FA_ICON = {
    course_vis: { className: "fa-mouse-pointer", color: "#8d6e63" },
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

function appendFaIcon(selection, iconInfo, size) {
    selection
        .append("xhtml:div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("width", "100%")
        .style("height", "100%")
        .style("color", iconInfo.color)
        .style("font-size", `${size}px`)
        .style("line-height", "1")
        .html(`<i class="fa-solid ${iconInfo.className}"></i>`);
}

const EVENT_ICON = {
    course_vis: '<path d="M5 5h7v14H5z"></path><path d="M12 5h7v14h-7z"></path>',
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

    const normalizedRoute = route.filter((value, index) => index === 0 || value.event !== route[index - 1].event);
    const simplifiedRoute = [];

    for (let index = 0; index < normalizedRoute.length; index += 1) {
        const currentItem = normalizedRoute[index];
        const currentEvent = currentItem.event;

        if (currentEvent !== "assignment_vis" && currentEvent !== "assignment_try" && currentEvent !== "assignment_sub") {
            simplifiedRoute.push(currentItem);
            continue;
        }

        let clusterEnd = index;

        while (
            clusterEnd + 1 < normalizedRoute.length &&
            ["assignment_vis", "assignment_try", "assignment_sub"].includes(normalizedRoute[clusterEnd + 1].event)
        ) {
            clusterEnd += 1;
        }

        const cluster = normalizedRoute.slice(index, clusterEnd + 1);

        const sub = cluster.find(c => c.event === "assignment_sub");
        const tryMatch = cluster.find(c => c.event === "assignment_try");
        const vis = cluster.find(c => c.event === "assignment_vis");

        if (sub) {
            simplifiedRoute.push(sub);
        } else if (tryMatch) {
            simplifiedRoute.push(tryMatch);
        } else {
            simplifiedRoute.push(vis);
        }

        index = clusterEnd;
    }

    return simplifiedRoute;
}

function routeHasSubmission(route) {
    if (route.length > 0 && typeof route[0] === 'object') {
        return route.some(r => r.event === "assignment_sub");
    }
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

            // Coalesce repeating pointing events into one
            if (route.length === 0 || route[route.length - 1].event !== mappedEvent) {
                route.push({ event: mappedEvent, t: Number(row.t) });
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

function groupRoutes(userRoutes) {
    const grouped = d3.rollup(
        userRoutes,
        (rows) => {
            const sampleRoute = rows[0].route.slice();
            const students = rows.map((d) => d.userId);
            const grades = rows.map((d) => d.grade);

            const route = sampleRoute.map((step, i) => {
                const avgSeconds = d3.mean(rows, r => r.route[i].t - r.route[0].t);
                // Convert seconds to hours
                return { event: step.event, t: avgSeconds / 3600, step: i };
            });

            return {
                route,
                students,
                totalStudents: students.length,
                avgGrade: d3.mean(grades) ?? 0,
                hasSubmission: routeHasSubmission(route)
            };
        },
        (d) => `${routeHasSubmission(d.route) ? "1" : "0"}|${d.route.map(r => r.event).join(">")}`
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

function getRouteLabel(route) {
    return route.map((step) => EVENT_LABEL[step.event || step] || (step.event || step)).join(" → ");
}

function buildInsights(routeData, allRoutes) {
    const insights = [];
    const totalStudentsInScope = d3.sum(allRoutes, (d) => d.totalStudents) || 1;
    const participation = ((routeData.totalStudents / totalStudentsInScope) * 100).toFixed(1);

    insights.push(`<strong>${participation}%</strong> dos estudantes seguem esta rota.`);

    if (routeData.totalStudents === 1) {
        insights.push("Rota <strong>única</strong>.");
    } else if (routeData.totalStudents > 10) {
        insights.push(`Rota <strong>frequente</strong> com ${routeData.totalStudents} estudantes.`);
    }

    if (!routeHasSubmission(routeData.route)) {
        insights.push("Sem entrega: trajetória <strong>não finalizada</strong>.");
    } else if (routeData.avgGrade >= 7) {
        insights.push(`Bom desempenho: média <strong>${routeData.avgGrade.toFixed(1)}</strong>.`);
    } else if (routeData.avgGrade < 5) {
        insights.push(`Dificuldade: média <strong>${routeData.avgGrade.toFixed(1)}</strong>.`);
    }

    if (routeData.route.length >= 6) {
        insights.push("A trajetória tem <strong>mais passos</strong> e tende a ser mais longa.");
    }
    
    // Add time insight
    const targetEnd = routeData.route[routeData.route.length - 1];
    if (targetEnd && targetEnd.t > 0) {
        insights.push(`Tempo médio de conclusão: <strong>${targetEnd.t.toFixed(1)} horas</strong>.`);
    }

    return insights.slice(0, 3);
}

function renderDetailPanel(detailPanelSelection, routeData, allRoutes, options = {}) {
    const previewLabel = options.preview ? "Prévia da rota" : "Detalhes da trajetória";

    if (!routeData) {
        detailPanelSelection.html(`
            <div class="poc-detail-empty">
                <div class="poc-detail-empty__lead">${svgIconMarkup("forum_vis", "")}Passe o mouse ou clique em uma rota</div>
                <div class="poc-detail-empty__hint">Os ícones, a leitura da trajetória e os destaques ficam aqui. Use as duas visões para alternar entre trajetórias finalizadas e não finalizadas.</div>
            </div>
        `);
        return;
    }

    const routeLabel = getRouteLabel(routeData.route);
    const insights = buildInsights(routeData, allRoutes);
    const stepsMarkup = routeData.route.map((step) => getEventChipMarkup(step.event || step)).join("");
    const studentsPreview = routeData.students.slice(0, 6).join(", ");
    const moreStudents = routeData.students.length > 6 ? ` +${routeData.students.length - 6}` : "";

    const html = `
        <div class="poc-route-detail">
            <div class="poc-route-header">
                ${getStatusMarkup(routeHasSubmission(routeData.route))}
                <div class="poc-route-title">${previewLabel}: ${routeLabel}</div>
            </div>

            <div class="poc-stat-grid">
                <div class="poc-stat">
                    <div class="poc-stat__label">Estudantes</div>
                    <div class="poc-stat__value">${routeData.totalStudents}</div>
                </div>
                <div class="poc-stat">
                    <div class="poc-stat__label">Média</div>
                    <div class="poc-stat__value">${routeData.avgGrade.toFixed(2)}</div>
                </div>
                <div class="poc-stat">
                    <div class="poc-stat__label">Passos</div>
                    <div class="poc-stat__value">${routeData.route.length}</div>
                </div>
            </div>

            <div class="poc-step-list">${stepsMarkup}</div>

            <div class="poc-insight-list">
                ${insights.map((insight) => `<div class="poc-insight">${insight}</div>`).join("")}
            </div>

            <div class="poc-insight">Amostra: ${studentsPreview}${moreStudents}</div>
        </div>
    `;

    detailPanelSelection.html(html);
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

function renderTrajectoryChart({
    chartContainer,
    tooltip,
    titleNode,
    detailPanel,
    detailPanelContainer,
    btnAll,
    btnDrop,
    groupedRoutes,
    activityName,
    state,
    onStateChange
}) {
    chartContainer.selectAll("svg, .poc-empty-state, .poc-render-note").remove();

    const routesToRender = buildNarrativeRoutes(groupedRoutes, state.narrativeMode, state.minVolume);
    const MAX_RENDER_ROUTES = 180;
    const routesForChart = routesToRender.slice(0, MAX_RENDER_ROUTES);
    const hiddenRoutesCount = Math.max(0, routesToRender.length - routesForChart.length);
    const allVisibleKeys = new Set(routesForChart.map((d) => d.routeKey));

    if (state.selectedRouteKey && !allVisibleKeys.has(state.selectedRouteKey)) {
        state.selectedRouteKey = null;
    }

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

    if (totalRoutes === 0) {
        renderDetailPanel(detailPanel, null, groupedRoutes);
        detailPanelContainer.style("display", "block");

        chartContainer
            .append("div")
            .attr("class", "poc-empty-state")
            .style("padding", "24px")
            .style("color", "#5f4a39")
            .text("Nenhuma rota corresponde aos filtros atuais.");
        return;
    }

    const width = chartContainer.node().clientWidth || 1100;
    const availableHeight = detailPanelContainer.node().clientHeight || chartContainer.node().clientHeight || 420;
    const height = Math.max(240, availableHeight);
    const margin = { top: 32, right: 20, bottom: 48, left: 190 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Find min and max time from routes
    let maxTime = 0;
    groupedRoutes.forEach(g => {
        const routeMax = d3.max(g.route, r => r.t) || 0;
        if (routeMax > maxTime) maxTime = routeMax;
    });
    
    if (maxTime === 0) maxTime = 1;

    if (!state.viewport) {
        // Initial viewport: 0 to min of 72 hours (3 days) or maxTime
        state.viewport = { start: 0, end: Math.min(maxTime, 72) }; 
    }

    const clampedStart = Math.max(0, Math.min(maxTime, state.viewport.start || 0));
    const clampedEnd = Math.max(clampedStart, Math.min(maxTime, state.viewport.end || maxTime));
    const span = clampedEnd - clampedStart;

    if (span <= 1) { // minimum 1 hour visible
        state.viewport.start = Math.max(0, clampedEnd - 1);
        state.viewport.end = Math.min(maxTime, state.viewport.start + 1);
    } else {
        state.viewport.start = clampedStart;
        state.viewport.end = clampedEnd;
    }

    const yDomain = EVENT_ORDER.map((eventName) => EVENT_LABEL[eventName]);
    const denseMode = routesForChart.length > 120;

    const x = d3.scaleLinear().domain([state.viewport.start, state.viewport.end]).range([0, innerWidth]);
    const y = d3.scalePoint().domain(yDomain).range([innerHeight, 0]).padding(0.5);
    const widthScale = d3
        .scaleLinear()
        .domain(d3.extent(routesForChart, (d) => d.totalStudents))
        .range(denseMode ? [1.2, 4.4] : [3.2, 11])
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
        .append("g")
        .attr("class", "x-grid")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(10).tickSize(-innerHeight).tickFormat(""))
        .call((axis) => axis.select(".domain").remove())
        .call((axis) => axis.selectAll("line").attr("stroke", "#e9e2d8").attr("stroke-dasharray", "3 5"));

    root
        .append("g")
        .attr("class", "y-grid")
        .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(""))
        .call((axis) => axis.select(".domain").remove())
        .call((axis) => axis.selectAll("line").attr("stroke", "#efe6dc").attr("stroke-dasharray", "3 5"));

    root
        .append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(10).tickFormat((t) => `${Math.round(t)}h`))
        .call((axis) => axis.selectAll("text").attr("fill", "#5f4a39").style("font-size", "12px"))
        .call((axis) => axis.select(".domain").attr("stroke", "#9a8c7f"));

    // Add X-axis label
    root.append("text")
        .attr("x", innerWidth)
        .attr("y", innerHeight - 8)
        .attr("fill", "#9a8c7f")
        .style("font-size", "12px")
        .style("text-anchor", "end")
        .text("Tempo desde o início (horas)");

    const yAxis = root
        .append("g")
        .call(d3.axisLeft(y).tickPadding(0).tickSize(6))
        .call((axis) => axis.selectAll("text")
            .attr("fill", "#5f4a39")
            .style("font-size", "12px")
            .style("text-anchor", "start")
            .attr("x", -130))
        .call((axis) => axis.select(".domain").attr("stroke", "#9a8c7f"));

    yAxis.selectAll(".tick").each(function (eventLabel) {
        const eventName = EVENT_ORDER.find((name) => EVENT_LABEL[name] === eventLabel);
        const iconInfo = eventName ? getEventIcon(eventName) : null;

        if (!iconInfo) {
            return;
        }

        const iconBox = d3.select(this)
            .insert("foreignObject", ":first-child")
            .attr("class", "poc-yaxis-icon")
            .attr("x", -160)
            .attr("y", -14)
            .attr("width", 28)
            .attr("height", 28)
            .style("overflow", "visible")
            .style("pointer-events", "none");

        appendFaIcon(iconBox, iconInfo, 18);
    });

    root
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "#000")
        .attr("fill-opacity", 0.001)
        .attr("pointer-events", "all")
        .on("click", () => {
            if (state.selectedRouteKey) {
                state.selectedRouteKey = null;
                onStateChange();
            }
        });

    const lineGenerator = d3
        .line()
        .x((d) => x(d.t))
        .y((d) => y(EVENT_LABEL[d.event]))
        .curve(d3.curveLinear);

    const routeGroup = root
        .append("g")
        .attr("class", "routes-layer")
        .selectAll(".route-group")
        .data(routesForChart, (d) => d.routeKey)
        .join("g")
        .attr("class", "route-group");

    const selectedRoute = state.selectedRouteKey
        ? routesForChart.find((d) => d.routeKey === state.selectedRouteKey) || null
        : null;

    function isHighlighted(routeData) {
        return selectedRoute ? routeData.routeKey === selectedRoute.routeKey : true;
    }

    function getRouteColor(routeData) {
        if (state.selectedRouteKey && !isHighlighted(routeData)) {
            return routeHasSubmission(routeData.route) ? "#b9d6ff" : "#f2c3c3";
        }

        return routeHasSubmission(routeData.route)
            ? d3.interpolateRgb("#dbeafe", "#1d4ed8")(0.78)
            : d3.interpolateRgb("#fee2e2", "#b91c1c")(0.78);
    }

    function getRouteOpacity(routeData) {
        if (state.selectedRouteKey && !isHighlighted(routeData)) {
            return denseMode ? 0.04 : 0.08;
        }

        return routeHasSubmission(routeData.route)
            ? (denseMode ? 0.18 : 0.34)
            : (denseMode ? 0.16 : 0.3);
    }

    routeGroup.each(function (routeData) {
        const group = d3.select(this);
        const points = routeData.route;
        const terminalPoint = points[points.length - 1];
        const submissionIndex = routeData.route.findIndex(r => r.event === "assignment_sub");
        const submissionPoint = submissionIndex >= 0 ? points[submissionIndex] : null;

        group
            .append("path")
            .attr("class", "route-path")
            .attr("d", lineGenerator(points))
            .attr("fill", "none")
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round")
            .attr("stroke", getRouteColor(routeData))
            .attr("opacity", getRouteOpacity(routeData))
            .attr("stroke-width", widthScale(routeData.totalStudents))
            .on("mouseover", () => {
                if (!state.selectedRouteKey) {
                    renderDetailPanel(detailPanel, routeData, groupedRoutes, { preview: true });
                }
            })
            .on("mouseout", () => {
                if (state.selectedRouteKey) {
                    const selected = routesForChart.find((d) => d.routeKey === state.selectedRouteKey) || null;
                    renderDetailPanel(detailPanel, selected, groupedRoutes);
                } else {
                    renderDetailPanel(detailPanel, null, groupedRoutes);
                }
            })
            .on("click", (event) => {
                event.stopPropagation();
                state.selectedRouteKey = state.selectedRouteKey === routeData.routeKey ? null : routeData.routeKey;
                onStateChange();
            });

        group
            .selectAll(".route-dot")
            .data(points)
            .join("foreignObject")
            .attr("class", "route-dot")
            .attr("x", (d) => x(d.t) - 9)
            .attr("y", (d) => y(EVENT_LABEL[d.event]) - 9)
            .attr("width", 18)
            .attr("height", 18)
            .style("overflow", "visible")
            .style("pointer-events", "none")
            .style("opacity", Math.min(1, getRouteOpacity(routeData) + 0.22));

        group
            .selectAll(".route-dot")
            .each(function (d) {
                const iconInfo = getEventIcon(d.event);

                if (!iconInfo) {
                    return;
                }

                appendFaIcon(d3.select(this), iconInfo, 16);
            });

        if (!submissionPoint && terminalPoint) {
            group
                .append("circle")
                .attr("class", "route-terminal")
                .attr("cx", x(terminalPoint.t))
                .attr("cy", y(EVENT_LABEL[terminalPoint.event]))
                .attr("r", 6)
                .attr("fill", "#ffffff")
                .attr("stroke", "#c85a5a")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "4 3")
                .attr("opacity", isHighlighted(routeData) ? 1 : 0.7)
                .style("pointer-events", "none");
        }
    });

    const navigatorHeight = 20;
    const navigatorY = innerHeight + 24;
    
    const maxHour = Math.ceil(maxTime);
    const stepLoad = Array.from({ length: maxHour + 1 }, () => 0);

    routesForChart.forEach((routeData) => {
        routeData.route.forEach((step) => {
            const h = Math.round(step.t);
            if (h >= 0 && h <= maxHour) {
                stepLoad[h] += routeData.totalStudents;
            }
        });
    });

    if (hiddenRoutesCount > 0) {
        renderDetailPanel(
            detailPanel,
            selectedRoute,
            groupedRoutes,
            { preview: false }
        );
    }

    let lastStepWithData = 0;
    for (let i = stepLoad.length - 1; i >= 0; i--) {
        if (stepLoad[i] > 0) {
            lastStepWithData = i;
            break;
        }
    }
    const effectiveMaxSteps = lastStepWithData > 0 ? lastStepWithData : maxHour;
    const effectiveMaxTime = effectiveMaxSteps || 1;

    const xNavigator = d3.scaleLinear().domain([0, effectiveMaxTime]).range([0, innerWidth]);
    const maxLoad = d3.max(stepLoad) || 1;
    const yNavigator = d3
        .scaleLinear()
        .domain([0, maxLoad])
        .range([navigatorHeight, 0]);
    const navigatorArea = d3
        .area()
        .x((_, index) => xNavigator(index))
        .y0(navigatorHeight)
        .y1((value) => yNavigator(value))
        .curve(d3.curveMonotoneX);
    const navigatorLine = d3
        .line()
        .x((_, index) => xNavigator(index))
        .y((value) => yNavigator(value))
        .curve(d3.curveMonotoneX);

    const navigator = root
        .append("g")
        .attr("class", "poc-navigator")
        .attr("transform", `translate(0,${navigatorY})`);

    const navigatorClipId = `poc-navigator-clip-${Math.random().toString(36).slice(2, 10)}`;

    navigator
        .append("defs")
        .append("clipPath")
        .attr("id", navigatorClipId)
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", innerWidth)
        .attr("height", navigatorHeight)
        .attr("rx", 7)
        .attr("ry", 7);

    navigator
        .append("rect")
        .attr("class", "poc-navigator-frame")
        .attr("x", 0)
        .attr("y", -10)
        .attr("width", innerWidth)
        .attr("height", navigatorHeight + 16)
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("fill", "#f6f0e8")
        .attr("stroke", "#ddd1c2")
        .attr("stroke-width", 1);

    navigator
        .append("rect")
        .attr("class", "poc-navigator-track")
        .attr("width", innerWidth)
        .attr("height", navigatorHeight)
        .attr("rx", 7)
        .attr("ry", 7)
        .attr("fill", "#fcf8f1")
        .attr("stroke", "#e3d8ca")
        .attr("stroke-width", 1);

    const miniBarWidth = Math.max(2, (innerWidth / Math.max(effectiveMaxTime, 1)) * 0.72);

    navigator
        .append("g")
        .attr("class", "poc-navigator-mini-bars")
        .attr("clip-path", `url(#${navigatorClipId})`)
        .selectAll("rect")
        .data(stepLoad)
        .enter()
        .append("rect")
        .attr("class", "poc-navigator-mini-bar")
        .attr("x", (_, index) => xNavigator(index) - miniBarWidth / 2)
        .attr("y", (value) => yNavigator(value))
        .attr("width", miniBarWidth)
        .attr("height", (value) => Math.max(1, navigatorHeight - yNavigator(value)))
        .attr("rx", 1.5)
        .attr("ry", 1.5);

    navigator
        .append("path")
        .datum(stepLoad)
        .attr("class", "poc-navigator-overview")
        .attr("clip-path", `url(#${navigatorClipId})`)
        .attr("d", navigatorArea);

    navigator
        .append("path")
        .datum(stepLoad)
        .attr("class", "poc-navigator-overview-line")
        .attr("clip-path", `url(#${navigatorClipId})`)
        .attr("d", navigatorLine);

    function getViewportFromSelection(selection) {
        if (!selection) {
            return { start: 0, end: effectiveMaxTime };
        }

        const [x0, x1] = selection;
        let nextStart = Math.max(0, xNavigator.invert(x0));
        let nextEnd = Math.min(effectiveMaxTime, xNavigator.invert(x1));
        
        // Ensure at least 1 hour visible
        if (nextEnd - nextStart < 1) {
            nextEnd = Math.min(effectiveMaxTime, nextStart + 1);
            nextStart = Math.max(0, nextEnd - 1);
        }

        return { start: nextStart, end: nextEnd };
    }

    function toSelectionPixels(viewport) {
        return [xNavigator(viewport.start), xNavigator(viewport.end)];
    }

    const brush = d3
        .brushX()
        .extent([[0, 0], [innerWidth, navigatorHeight]])
        .handleSize(14)
        .on("end", (event) => {
            if (!event.sourceEvent) {
                return;
            }

            const nextViewport = getViewportFromSelection(event.selection);
            const snappedSelection = toSelectionPixels(nextViewport);

            const hasChanged = nextViewport.start !== state.viewport.start || nextViewport.end !== state.viewport.end;
            if (!hasChanged) {
                return;
            }

            state.viewport = nextViewport;
            onStateChange();
        });

    const brushGroup = navigator
        .append("g")
        .attr("class", "poc-navigator-brush")
        .call(brush)
        .call(brush.move, toSelectionPixels(state.viewport));

    brushGroup.call(brush.move, [xNavigator(state.viewport.start), xNavigator(state.viewport.end)]);

    brushGroup
        .selectAll(".overlay")
        .attr("fill", "#000")
        .attr("fill-opacity", 0.001)
        .attr("pointer-events", "all");

    brushGroup
        .selectAll(".selection")
        .attr("fill", "none")
        .attr("stroke", "#5b86c5")
        .attr("stroke-width", 2)
        .attr("rx", 6)
        .attr("ry", 6);

    brushGroup
        .selectAll(".handle")
        .attr("fill", "#5b86c5")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2);

    renderDetailPanel(detailPanel, selectedRoute, groupedRoutes);
    detailPanelContainer.style("display", "block");
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
    const panelCloseButton = d3.select("#poc-panel-close");

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

    if (!panelCloseButton.empty()) {
        panelCloseButton.on("click", () => {
            detailPanelContainer.style("display", "none");
        });
    }

    try {
        const dataStore = await loadDashboardData();
        const eventMap = buildEventMap(dataStore.eventMapping);

        if (!eventMap.size) {
            throw new Error("Event mapping is empty");
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
            viewport: null
        };

        let currentGroupedRoutes = [];

        function getGroupedRoutesForCurrentActivity() {
            const parsedIndex = Number(state.activityIndex);
            const safeIndex = Number.isNaN(parsedIndex) ? 0 : parsedIndex;
            const selectedActivity = dataStore.quizList[safeIndex] || dataStore.quizList[0];

            const filteredLogs = filterLogsByActivity(dataStore.logs, selectedActivity);
            const filteredGrades = dataStore.quizGrades.filter((row) => String(row.id) === String(selectedActivity.id));
            const gradeByUser = buildGradeByUser(filteredGrades);
            const userRoutes = buildUserRoutes(filteredLogs, eventMap, gradeByUser);

            return {
                selectedActivity,
                groupedRoutes: groupRoutes(userRoutes)
            };
        }

        function refreshChart() {
            const activityData = getGroupedRoutesForCurrentActivity();
            currentGroupedRoutes = activityData.groupedRoutes;

            const visibleRoutes = buildNarrativeRoutes(currentGroupedRoutes, state.narrativeMode, state.minVolume);
            if (state.selectedRouteKey && !visibleRoutes.some((route) => route.routeKey === state.selectedRouteKey)) {
                state.selectedRouteKey = null;
            }

            renderTrajectoryChart({
                chartContainer,
                titleNode,
                detailPanel,
                detailPanelContainer,
                btnAll,
                btnDrop,
                groupedRoutes: currentGroupedRoutes,
                activityName: activityData.selectedActivity.name,
                state,
                onStateChange: refreshChart
            });

            const maxVolume = d3.max(currentGroupedRoutes, (routeData) => routeData.totalStudents) || 1;
            minVolumeSlider
                .attr("max", Math.max(10, Math.min(50, maxVolume)))
                .property("value", state.minVolume);
            minVolumeValue.text(state.minVolume);
            activitySelect.property("value", String(state.activityIndex));
        }

        activitySelect.on("change", function () {
            state.activityIndex = Number(this.value) || 0;
            state.minVolume = 10;
            state.narrativeMode = "finished";
            state.selectedRouteKey = null;
            state.viewport = null;
            refreshChart();
        });

        minVolumeSlider.on("input", function () {
            state.minVolume = Number(this.value) || 10;
            minVolumeValue.text(state.minVolume);
            refreshChart();
        });

        btnAll.on("click", () => {
            state.narrativeMode = "finished";
            state.selectedRouteKey = null;
            refreshChart();
        });

        btnDrop.on("click", () => {
            state.narrativeMode = "unfinished";
            state.selectedRouteKey = null;
            refreshChart();
        });

        refreshChart();
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
