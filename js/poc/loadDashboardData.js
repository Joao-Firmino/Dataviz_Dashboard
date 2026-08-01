const DEFAULT_API_BASE = "http://localhost:8000";

const DEFAULT_TIMELINE_REQUEST = {
    scenario: 7,
    thresholds: {
        low_grade: 0.5,
        high_grade: 0.75,
        delta_drop: 0.2,
        delta_rise: 0.15,
        late_try_hours: 24,
        inactivity_days: 5,
        resource_prep_days: 7
    },
    declutter_mode: "first_class",
    max_users: 300,
    hide_rare_classes: true,
    compare_mode: "team"
};

function getApiBase() {
    if (typeof window !== "undefined" && window.DATAVIZ_API_URL) {
        return window.DATAVIZ_API_URL;
    }

    return DEFAULT_API_BASE;
}

async function fetchJson(path, init = {}) {
    const response = await fetch(`${getApiBase()}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init.headers || {})
        }
    });

    if (!response.ok) {
        throw new Error(`API ${response.status}: ${await response.text()}`);
    }

    return response.json();
}

function buildTimelineRequest(assignmentId, overrides = {}) {
    const scenarioOverride = Number.isInteger(overrides.scenario)
        ? overrides.scenario
        : Number.isInteger(overrides.simplification)
            ? overrides.simplification
            : DEFAULT_TIMELINE_REQUEST.scenario;

    const requestPayload = {
        assignment_id: assignmentId,
        t_start: overrides.t_start ?? null,
        t_end: overrides.t_end ?? null,
        user_ids: overrides.user_ids ?? null,
        cities: overrides.cities ?? null,
        event_classes: overrides.event_classes ?? null,
        stories_respect_event_filter: overrides.stories_respect_event_filter ?? false,
        segment: overrides.segment ?? null,
        scenario: scenarioOverride,
        thresholds: {
            ...DEFAULT_TIMELINE_REQUEST.thresholds,
            ...(overrides.thresholds || {})
        },
        declutter_mode: overrides.declutter_mode ?? DEFAULT_TIMELINE_REQUEST.declutter_mode,
        max_users: overrides.max_users ?? DEFAULT_TIMELINE_REQUEST.max_users,
        hide_rare_classes: overrides.hide_rare_classes ?? DEFAULT_TIMELINE_REQUEST.hide_rare_classes,
        compare_mode: overrides.compare_mode ?? DEFAULT_TIMELINE_REQUEST.compare_mode
    };

    if (overrides.story_params && typeof overrides.story_params === "object") {
        requestPayload.story_params = overrides.story_params;
    }

    return requestPayload;
}

async function loadDashboardData() {
    const meta = await fetchJson("/api/meta");
    const quizList = Array.isArray(meta.quizzes) ? meta.quizzes.slice() : [];

    const timelines = await Promise.all(
        quizList.map(async (quiz) => {
            const timeline = await fetchJson("/api/timeline", {
                method: "POST",
                body: JSON.stringify(buildTimelineRequest(quiz.id))
            });

            return [quiz.id, timeline];
        })
    );

    return {
        meta,
        quizList,
        timelinesByQuizId: Object.fromEntries(timelines)
    };
}

export { buildTimelineRequest };
export { fetchJson };
export default loadDashboardData;
