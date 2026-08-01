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

export {
    formatStoryParameterValue,
    getStoryAffectedCount,
    getStoryAffectedPercentage
};
