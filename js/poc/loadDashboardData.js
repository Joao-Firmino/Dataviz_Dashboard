let dashboardDataPromise = null;

function cloneRows(rows) {
    return rows.map((row) => ({ ...row }));
}

async function loadDashboardData() {
    if (!dashboardDataPromise) {
        dashboardDataPromise = Promise.all([
            d3.csv("./data/see_course2060_quiz_list.csv"),
            d3.csv("./data/see_course2060_12-11_to_11-12_logs_filtered.csv"),
            d3.csv("./data/event_mapping.csv"),
            d3.csv("./data/see_course2060_quiz_grades.csv"),
            d3.csv("./data/user_list_see.csv")
        ]).then((filesRead) => ({
            quizList: filesRead[0],
            logs: filesRead[1],
            eventMapping: filesRead[2],
            quizGrades: filesRead[3],
            users: filesRead[4]
        }));
    }

    const data = await dashboardDataPromise;

    return {
        quizList: cloneRows(data.quizList),
        logs: cloneRows(data.logs),
        eventMapping: cloneRows(data.eventMapping),
        quizGrades: cloneRows(data.quizGrades),
        users: cloneRows(data.users)
    };
}

export default loadDashboardData;
