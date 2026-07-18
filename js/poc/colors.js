const DashboardTheme = {
    system: {
        bgOverlay: "rgba(248, 250, 252, 0.98)",
        bgSurface: "#f8fafc",
        bgWhite: "#ffffff",
        borderSoft: "#dbe3ed",
        borderMuted: "#cbd5e1",
        borderStrong: "#94a3b8",
        textMain: "#1f2937",
        textSoft: "#64748b",
        textStrong: "#334155",
        textEmphasis: "#475569",
        contextLine: "#94a3b8",
        neutralHighlight: "#475569",
        axisGrid: "#e2e8f0",
        zebraStripe: "rgba(0, 0, 0, 0.03)",
        selectionFallback: "#2563eb",
        terminalAlert: "#ef4444",
        dangerText: "#c44",
        dropShadowSoft: "0 12px 28px rgba(15, 23, 42, 0.14)",
        dropShadowRoute: "drop-shadow(0 0 4px rgba(0,0,0,0.12))",
        pillBg: "rgba(248, 250, 252, 0.94)"
    },
    status: {
        risk: {
            strong: "#c44",
            soft: "rgba(196, 68, 68, 0.12)"
        },
        attention: {
            strong: "#b46f12",
            stroke: "#c58a1a",
            soft: "rgba(180, 111, 18, 0.12)"
        },
        good: {
            strong: "#2f8f5b",
            soft: "rgba(47, 143, 91, 0.12)"
        }
    },
    events: {
        resource_vis: "#e64a19",
        forum_vis: "#ff94c2",
        forum_participation: "#00bcd4",
        assignment_vis: "#ceb130",
        assignment_try: "#6366f1",
        assignment_sub: "#10b981"
    },
    opacities: {
        declutter: 0.38,
        baseRoute: 0.8,
        highlight: 1,
        yStripe: 0.03,
        markerBoost: 0.26,
        iconBoost: 0.22,
        terminalMin: 0.3,
        terminalDefault: 0.7,
        hoverStrong: 0.95
    }
};

export { DashboardTheme };
