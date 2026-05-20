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
    const firstSubIdx = normalizedRoute.indexOf("assignment_sub");

    if (firstSubIdx >= 0) {
        return normalizedRoute.slice(0, firstSubIdx + 1);
    }

    return normalizedRoute;
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

function getRouteLabel(route) {
    return route.map((step) => EVENT_LABEL[step] || step).join(" → ");
}

function createTooltip(container) {
    container.selectAll(".poc-tooltip").remove();

    return container
        .append("div")
        .attr("class", "poc-tooltip")
        .style("opacity", 0);
}

function buildInsights(routeData, allRoutes) {
    const insights = [];
    const totalStudentsInScope = d3.sum(allRoutes, (d) => d.totalStudents) || 1;
    const participation = ((routeData.totalStudents / totalStudentsInScope) * 100).toFixed(1);

    insights.push(`<strong>${participation}%</strong> dos estudantes seguem esta rota`);

    if (routeData.totalStudents === 1) {
        insights.push("Esta é uma rota <strong>única</strong>.");
    } else if (routeData.totalStudents > 10) {
        insights.push(`Esta é uma rota <strong>frequente</strong> com ${routeData.totalStudents} estudantes.`);
    }

    if (!routeHasSubmission(routeData.route)) {
        insights.push("Os alunos desta rota <strong>não entregaram</strong> a atividade, então isso é <strong>evasão</strong>.");
    } else if (routeData.avgGrade >= 7) {
        insights.push(`Alunos desta rota tiveram <strong>bom desempenho</strong> (média ${routeData.avgGrade.toFixed(1)}).`);
    } else if (routeData.avgGrade < 5) {
        insights.push(`Alunos desta rota tiveram <strong>dificuldade</strong> (média ${routeData.avgGrade.toFixed(1)}).`);
    }

    if (routeData.route.length >= 6) {
        insights.push("A trajetória tem <strong>mais passos</strong> e tende a ser mais longa.");
    }

    return insights;
}

function renderDetailPanel(detailPanelSelection, routeData, allRoutes) {
    if (!routeData) {
        detailPanelSelection.html('<p style="color: #999;">Clique em uma rota para ver detalhes</p>');
        return;
    }

    const routeLabel = getRouteLabel(routeData.route);
    const insights = buildInsights(routeData, allRoutes);
    const studentsPreview = routeData.students.slice(0, 8).join(", ");
    const moreStudents = routeData.students.length > 8 ? ` +${routeData.students.length - 8}` : "";

    let html = `<div class="poc-route-detail">`;
    html += `<div class="poc-route-detail-item">`;
    html += `<div class="poc-detail-label">Trajetória</div>`;
    html += `<div class="poc-detail-value">${routeLabel}</div>`;
    html += `</div>`;

    html += `<div class="poc-route-detail-item">`;
    html += `<div class="poc-detail-label">Estudantes</div>`;
    html += `<div class="poc-detail-value">${routeData.totalStudents}</div>`;
    html += `</div>`;

    html += `<div class="poc-route-detail-item">`;
    html += `<div class="poc-detail-label">Resultado</div>`;
    html += `<div class="poc-detail-value">${routeHasSubmission(routeData.route) ? "✓ Com entrega" : "✗ Evasão"}</div>`;
    html += `</div>`;

    html += `<div class="poc-route-detail-item">`;
    html += `<div class="poc-detail-label">Leitura da rota</div>`;
    html += `<div class="poc-detail-value">${routeHasSubmission(routeData.route) ? "A trajetória chega até a entrega." : "A trajetória não chega à entrega, então é evasão."}</div>`;
    html += `</div>`;

    html += `<div class="poc-route-detail-item">`;
    html += `<div class="poc-detail-label">Média da nota</div>`;
    html += `<div class="poc-detail-value">${routeData.avgGrade.toFixed(2)}</div>`;
    html += `</div>`;

    html += `<div class="poc-route-detail-item">`;
    html += `<div class="poc-detail-label">Amostra de estudantes</div>`;
    html += `<div class="poc-detail-value">${studentsPreview}${moreStudents}</div>`;
    html += `</div>`;

    html += `<div class="poc-route-detail-item">`;
    html += `<div class="poc-detail-label">Insights</div>`;
    insights.forEach((insight) => {
        html += `<div class="poc-insight">${insight}</div>`;
    });
    html += `</div>`;
    html += `</div>`;

    detailPanelSelection.html(html);
}

function buildNarrativeRoutes(groupedRoutes, narrativeMode, minVolume) {
    const volumeFiltered = groupedRoutes.filter((routeData) => routeData.totalStudents >= minVolume);

    if (narrativeMode === "dropout") {
        return volumeFiltered.filter((routeData) => !routeHasSubmission(routeData.route));
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
    const MAX_RENDER_ROUTES = 240;
    const routesForChart = routesToRender.slice(0, MAX_RENDER_ROUTES);
    const hiddenRoutesCount = Math.max(0, routesToRender.length - routesForChart.length);
    const allVisibleKeys = new Set(routesForChart.map((d) => d.routeKey));

    if (state.selectedRouteKey && !allVisibleKeys.has(state.selectedRouteKey)) {
        state.selectedRouteKey = null;
    }

    const totalRoutes = routesToRender.length;

    titleNode.text(
        totalRoutes > 0
            ? (state.narrativeMode === "dropout"
                ? `Onde os alunos abandonam ${activityName}? (${totalRoutes} rotas)`
                : `Como os estudantes percorrem ${activityName}? (${totalRoutes} rotas)`)
            : `Sem rotas suficientes em ${activityName}.`
    );
    btnAll.classed("is-active", state.narrativeMode === "all");
    btnDrop.classed("is-active", state.narrativeMode === "dropout");

    if (totalRoutes === 0) {
        renderDetailPanel(detailPanel, null, groupedRoutes);
        detailPanelContainer.style("display", "block");

        chartContainer
            .append("div")
            .attr("class", "poc-empty-state")
            .style("padding", "24px")
            .style("color", "#5f4a39")
            .text("Nenhuma rota corresponde aos filtros atuais.");

        tooltip.style("opacity", 0);
        return;
    }

    const width = chartContainer.node().clientWidth || 1100;
    const height = Math.max(520, Math.round(width * 0.46));
    const margin = { top: 24, right: 28, bottom: 80, left: 170 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const maxSteps = d3.max(groupedRoutes, (d) => d.route.length) || 1;
    const minVisibleSteps = Math.min(2, maxSteps);

    if (!state.viewport) {
        const initialEnd = Math.min(maxSteps, 5);
        state.viewport = { start: 1, end: initialEnd };
    }

    const clampedStart = Math.max(1, Math.min(maxSteps, Math.round(state.viewport.start || 1)));
    const clampedEnd = Math.max(clampedStart, Math.min(maxSteps, Math.round(state.viewport.end || maxSteps)));
    const span = clampedEnd - clampedStart + 1;

    if (span < minVisibleSteps) {
        state.viewport.start = Math.max(1, clampedEnd - minVisibleSteps + 1);
        state.viewport.end = Math.min(maxSteps, state.viewport.start + minVisibleSteps - 1);
    } else {
        state.viewport.start = clampedStart;
        state.viewport.end = clampedEnd;
    }

    const visibleSteps = d3.range(state.viewport.start, state.viewport.end + 1);
    const stepStride = Math.max(1, Math.ceil(visibleSteps.length / 12));
    const xTicks = visibleSteps.filter((step, index) => index % stepStride === 0 || step === state.viewport.end);
    const yDomain = EVENT_ORDER.map((eventName) => EVENT_LABEL[eventName]);
    const denseMode = routesForChart.length > 120;

    const x = d3.scaleLinear().domain([state.viewport.start, state.viewport.end]).range([0, innerWidth]);
    const y = d3.scalePoint().domain(yDomain).range([innerHeight, 0]).padding(0.5);
    const widthScale = d3
        .scaleLinear()
        .domain(d3.extent(routesForChart, (d) => d.totalStudents))
        .range(denseMode ? [1.4, 5.2] : [4, 14])
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
        .call(d3.axisBottom(x).tickValues(xTicks).tickSize(-innerHeight).tickFormat(""))
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
        .call(d3.axisBottom(x).tickValues(xTicks).tickFormat((step) => `${step}`))
        .call((axis) => axis.selectAll("text").attr("fill", "#5f4a39").style("font-size", "12px"))
        .call((axis) => axis.select(".domain").attr("stroke", "#9a8c7f"));

    root
        .append("g")
        .call(d3.axisLeft(y))
        .call((axis) => axis.selectAll("text").attr("fill", "#5f4a39").style("font-size", "12px"))
        .call((axis) => axis.select(".domain").attr("stroke", "#9a8c7f"));

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
            return denseMode ? 0.08 : 0.14;
        }

        return routeHasSubmission(routeData.route)
            ? (denseMode ? 0.38 : 0.78)
            : (denseMode ? 0.34 : 0.72);
    }

    routeGroup.each(function (routeData) {
        const group = d3.select(this);
        const points = routeData.route.map((eventName, step) => ({ event: eventName, step }));
        const terminalPoint = points[points.length - 1];
        const submissionIndex = routeData.route.indexOf("assignment_sub");
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
            .on("mouseover", (event) => {
                tooltip
                    .style("opacity", 1)
                    .html(`<strong>${getRouteLabel(routeData.route)}</strong><br><br>Estudantes: ${routeData.totalStudents}<br>Média: ${routeData.avgGrade.toFixed(2)}`);

                const bounds = chartContainer.node().getBoundingClientRect();
                tooltip
                    .style("left", `${event.clientX - bounds.left + 14}px`)
                    .style("top", `${event.clientY - bounds.top + 14}px`);
            })
            .on("mousemove", (event) => {
                const bounds = chartContainer.node().getBoundingClientRect();
                tooltip
                    .style("left", `${event.clientX - bounds.left + 14}px`)
                    .style("top", `${event.clientY - bounds.top + 14}px`);
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
            })
            .on("click", (event) => {
                event.stopPropagation();
                state.selectedRouteKey = state.selectedRouteKey === routeData.routeKey ? null : routeData.routeKey;
                onStateChange();
            });

        group
            .selectAll(".route-dot")
            .data(points)
            .join("circle")
            .attr("class", "route-dot")
            .attr("cx", (d) => x(d.step + 1))
            .attr("cy", (d) => y(EVENT_LABEL[d.event]))
            .attr("r", 3)
            .attr("fill", (d) => EVENT_COLOR[d.event] || getRouteColor(routeData))
            .attr("opacity", Math.min(1, getRouteOpacity(routeData) + 0.18))
            .attr("stroke", "#f6f2eb")
            .attr("stroke-width", 0.8)
            .style("pointer-events", "none");

        if (submissionPoint) {
            group
                .append("circle")
                .attr("class", "route-submission-marker")
                .attr("cx", x(submissionPoint.step + 1))
                .attr("cy", y(EVENT_LABEL[submissionPoint.event]))
                .attr("r", 9)
                .attr("fill", "#fffce6")
                .attr("stroke", EVENT_COLOR.assignment_sub)
                .attr("stroke-width", 3)
                .attr("opacity", isHighlighted(routeData) ? 1 : 0.85)
                .style("pointer-events", "none");
        } else {
            group
                .append("circle")
                .attr("class", "route-terminal")
                .attr("cx", x(terminalPoint.step + 1))
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

    const navigatorHeight = 32;
    const navigatorY = innerHeight + 36;
    const stepLoad = Array.from({ length: maxSteps }, () => 0);

    routesForChart.forEach((routeData) => {
        routeData.route.forEach((_, index) => {
            if (stepLoad[index] !== undefined) {
                stepLoad[index] += routeData.totalStudents;
            }
        });
    });

    if (hiddenRoutesCount > 0) {
        chartContainer
            .append("div")
            .attr("class", "poc-render-note")
            .text(`Exibindo as ${routesForChart.length} rotas mais frequentes de ${routesToRender.length}. Ajuste o filtro mínimo para reduzir o volume.`);
    }

    let lastStepWithData = 0;
    for (let i = stepLoad.length - 1; i >= 0; i--) {
        if (stepLoad[i] > 0) {
            lastStepWithData = i + 1;
            break;
        }
    }
    const effectiveMaxSteps = lastStepWithData > 0 ? lastStepWithData : maxSteps;

    const xNavigator = d3.scaleLinear().domain([1, effectiveMaxSteps]).range([0, innerWidth]);
    const maxLoad = d3.max(stepLoad) || 1;
    const yNavigator = d3
        .scaleLinear()
        .domain([0, maxLoad])
        .range([navigatorHeight, 0]);
    const navigatorArea = d3
        .area()
        .x((_, index) => xNavigator(index + 1))
        .y0(navigatorHeight)
        .y1((value) => yNavigator(value))
        .curve(d3.curveMonotoneX);
    const navigatorLine = d3
        .line()
        .x((_, index) => xNavigator(index + 1))
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

    const miniBarWidth = Math.max(2, (innerWidth / Math.max(effectiveMaxSteps, 1)) * 0.72);

    navigator
        .append("g")
        .attr("class", "poc-navigator-mini-bars")
        .attr("clip-path", `url(#${navigatorClipId})`)
        .selectAll("rect")
        .data(stepLoad)
        .enter()
        .append("rect")
        .attr("class", "poc-navigator-mini-bar")
        .attr("x", (_, index) => xNavigator(index + 1) - miniBarWidth / 2)
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
            return { start: 1, end: effectiveMaxSteps };
        }

        const [x0, x1] = selection;
        let nextStart = Math.max(1, Math.round(xNavigator.invert(x0)));
        let nextEnd = Math.min(effectiveMaxSteps, Math.round(xNavigator.invert(x1)));

        if ((nextEnd - nextStart + 1) < minVisibleSteps) {
            nextEnd = Math.min(effectiveMaxSteps, nextStart + minVisibleSteps - 1);
            nextStart = Math.max(1, nextEnd - minVisibleSteps + 1);
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
            const selectionChanged = !event.selection
                || Math.abs(event.selection[0] - snappedSelection[0]) > 0.5
                || Math.abs(event.selection[1] - snappedSelection[1]) > 0.5;

            if (selectionChanged) {
                brushGroup.call(brush.move, snappedSelection);
            }

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
        .call(brush);

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
    tooltip.style("opacity", 0);
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
            narrativeMode: "all",
            selectedRouteKey: null,
            viewport: null
        };

        let currentGroupedRoutes = [];
        const tooltip = createTooltip(chartContainer);

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
                tooltip,
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
            state.narrativeMode = "all";
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
            state.narrativeMode = "all";
            state.selectedRouteKey = null;
            refreshChart();
        });

        btnDrop.on("click", () => {
            state.narrativeMode = "dropout";
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
