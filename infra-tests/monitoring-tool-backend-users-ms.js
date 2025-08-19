import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// 📊 Métricas personalizadas
let authTrend = new Trend("auth_response_time", true);
let usersTrend = new Trend("users_response_time", true);

// ⚙️ Configuración de prueba
export let options = {
    vus: 20,
    duration: "60s",
    thresholds: {
        http_req_duration: ["p(95)<500"],
        http_req_failed: ["rate<0.01"],
        auth_response_time: ["p(95)<1000"],
        users_response_time: ["p(95)<400"],
    },
};

export function setup() {
    return group("Login", function () {
        const loginPayload = JSON.stringify({
            username: __ENV.API_USERNAME,
            password: __ENV.API_PASSWORD,
        });

        const loginHeaders = { "Content-Type": "application/json" };

        let loginRes = http.post(
            `http://${__ENV.API_HOST}:8090/monitoring-tool-users-ms/user/authenticate`,
            loginPayload,
            { headers: loginHeaders, tags: { endpoint: "auth" } }
        );

        authTrend.add(loginRes.timings.duration);

        check(loginRes, {
            "login status is 200": (r) => r.status === 200,
            "login returned token": (r) => r.json("data.token") !== undefined,
        });

        return { token: loginRes.json("data.token") };
    });
}

export default function (data) {
    group("Get Users", function () {
        const USERS_ENDPOINT = "/monitoring-tool-users-ms/user?page=0&size=10&sort=email";

        const headers = {
            Authorization: `Bearer ${data.token}`,
        };

        let res = http.get(
            `http://${__ENV.API_HOST}:8090${USERS_ENDPOINT}`,
            { headers, tags: { endpoint: "users" } }
        );

        usersTrend.add(res.timings.duration);
        check(res, {
            "users status is 200": (r) => r.status === 200,
            "users body not empty": (r) => r.body && r.body.length > 10,
        });

        sleep(1); // pacing
    });
}

export function handleSummary(data) {
    return {
        stdout: textSummary(data, { indent: " ", enableColors: true }),
        "results.json": JSON.stringify(data), // JSON crudo para dashboards
    };
}
