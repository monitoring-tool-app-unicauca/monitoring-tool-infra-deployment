import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

let authTrend = new Trend("tracking_auth_response_time");
let healthTrend = new Trend("tracking_health_response_time");
let projectsTrend = new Trend("tracking_projects_response_time");
let errorRate = new Rate("tracking_errors");

export let options = {
    vus: 20,
    duration: "60s",
    thresholds: {
        http_req_duration: ["p(95)<500"], // todas las requests deben responder < 500ms en 95%
        http_req_failed: ["rate<0.01"],   // < 1% de fallos permitidos
        "tracking_auth_response_time": ["p(95)<300"],
        "tracking_health_response_time": ["p(95)<200"],
        "tracking_projects_response_time": ["p(95)<400"],
        "tracking_errors": ["rate<0.01"],
    },
};

export function setup() {
    const loginPayload = JSON.stringify({
        username: __ENV.API_USERNAME,
        password: __ENV.API_PASSWORD,
    });

    const loginHeaders = {
        "Content-Type": "application/json",
    };

    let loginRes = http.post(
        `http://${__ENV.API_HOST}:8090/monitoring-tool-users-ms/user/authenticate`,
        loginPayload,
        { headers: loginHeaders }
    );

    authTrend.add(loginRes.timings.duration);

    check(loginRes, {
        "login status is 200": (r) => r.status === 200,
        "login returned token": (r) => r.json("data.token") !== undefined,
    }) || errorRate.add(1);

    let token = loginRes.json("data.token");
    return { token };
}

export default function (data) {
    const BASE_URL = `http://${__ENV.API_HOST}:8092/monitoring-tool-tracking-ms`;

    const headers = {
        Authorization: `Bearer ${data.token}`,
    };

    let healthRes = http.get(`${BASE_URL}/actuator/health`, { headers });
    healthTrend.add(healthRes.timings.duration);

    check(healthRes, {
        "health status is 200": (r) => r.status === 200,
        "health reports UP": (r) => r.body.includes("UP"),
    }) || errorRate.add(1);

    let projectsRes = http.get(`${BASE_URL}/project?page=0&size=10&sort=projectId`, { headers });
    projectsTrend.add(projectsRes.timings.duration);

    check(projectsRes, {
        "projects status is 200": (r) => r.status === 200,
        "projects body not empty": (r) => r.body && r.body.length > 10,
    }) || errorRate.add(1);

    sleep(1);
}
