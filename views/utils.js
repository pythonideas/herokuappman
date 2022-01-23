const API_BASE_URL = "/api";

function api(endpoint, method, payloadOpt) {
  const payload = payloadOpt || {};
  const url = `${API_BASE_URL}/${endpoint}`;
  payload.ADMIN_PASS = localStorage.getItem("ADMIN_PASS");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (endpoint !== "init")
    console.log("api", { endpoint, method, payload, url, headers });
  return new Promise((resolve) => {
    fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(payload),
    })
      .then((response) => {
        response
          .json()
          .then((json) => {
            if (endpoint !== "init") console.log(endpoint, "got", json);
            resolve(json);
          })
          .catch((error) => {
            resolve({ error });
          });
      })
      .catch((error) => {
        resolve({ error });
      });
  });
}

function get(endpoint, payload) {
  return api(endpoint, "GET", payload);
}

function post(endpoint, payload) {
  return api(endpoint, "POST", payload);
}

function hotReload() {
  get("init").then((json) => {
    const serverStartedAt = json.SERVER_STARTED_AT;
    document.title = json.INDEX_TITLE;

    setInterval(() => {
      get("init").then((json) => {
        if (json.SERVER_STARTED_AT !== serverStartedAt) {
          setTimeout(() => document.location.reload(), 3000);
        }
      });
    }, 1000);
  });
}
