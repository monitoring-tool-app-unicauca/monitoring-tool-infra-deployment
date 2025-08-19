import http from "k6/http";
import { check, sleep } from "k6";

const ENDPOINT = "/monitoring-tool-tracking-ms/actuator/health";

export let options = {
    vus: 20,
    duration: "60s",
    thresholds: {
        http_req_duration: ["p(95)<500"],
        http_req_failed: ["rate<0.01"],
    },
};

export default function () {
    let res = http.get(`${__ENV.API_HOST}${ENDPOINT}`);
    check(res, {
        "status is 200": (r) => r.status === 200,
        "body not empty": (r) => r.body && r.body.length > 10,
    });
    sleep(1);
}
