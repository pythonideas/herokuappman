import fetch from "node-fetch";
import fs from "fs";

export { fetch };

const API_BASE_URL = "https://api.heroku.com";
const DEFAULT_ACCEPT = "application/vnd.heroku+json; version=3";

const MAX_APPS = 5;

let VERBOSE = false;

function log(...args) {
  if (VERBOSE) console.log(...args);
}

//////////////////////////////////////////////////////////////////////
// API primitives

export function api(endpoint, method, payload, token, accept?) {
  const url = `${API_BASE_URL}/${endpoint}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: accept || DEFAULT_ACCEPT,
    "Content-Type": "application/json",
  };

  const body = payload ? JSON.stringify(payload) : undefined;

  if (require.main === module) {
    log({ endpoint, method, url, headers, payload, token, body });
  }

  return new Promise((resolve, reject) => {
    fetch(url, {
      method,
      headers,
      body,
    }).then(
      (resp) =>
        resp.json().then(
          (json) => {
            if (VERBOSE)
              fs.writeFileSync(
                `responsesamples/${endpoint.replace(/\//g, "_")}.json`,
                JSON.stringify(json, null, 2)
              );
            resolve(json);
          },
          (err) => {
            console.error(err);
            reject(err);
          }
        ),
      (err) => {
        console.error(err);
        reject(err);
      }
    );
  });
}

function get(endpoint, payload, token, accept?) {
  return api(endpoint, "GET", payload, token, accept);
}

function post(endpoint, payload, token, accept?) {
  return api(endpoint, "POST", payload, token, accept);
}

function del(endpoint, payload, token, accept?) {
  return api(endpoint, "DELETE", payload, token, accept);
}

function patch(endpoint, payload, token, accept?) {
  return api(endpoint, "PATCH", payload, token, accept);
}

//////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////

export class HerokuApp {
  id: string = "";
  name: string = "";
  stack: string = "";
  region: string = "";
  quotaUsed: number = 0;
  parentAccount: HerokuAccount = new HerokuAccount("");
  constructor(parentAccount: HerokuAccount, blob: any) {
    this.id = blob.id;
    this.name = blob.name;
    this.stack = blob.stack.name;
    this.region = blob.region.name;
  }
}

export class HerokuAccount {
  name: string = "";
  envTokenFullName: string = "";
  token: string = "";
  id: string = "";
  quotaTotal: number = 0;
  quotaUsed: number = 0;
  apps: HerokuApp[] = [];
  constructor(name: string) {
    this.name = name;
    this.envTokenFullName = "HEROKU_TOKEN_" + this.name;
    this.token = process.env[this.envTokenFullName];
  }
  getAccount() {
    return new Promise((resolve) => {
      get(`account`, undefined, this.token).then((json: any) => {
        this.id = json.id;
        resolve(json);
      });
    });
  }
  getQuota() {
    return new Promise((resolve) => {
      get(
        `accounts/${this.id}/actions/get-quota`,
        undefined,
        this.token,
        "application/vnd.heroku+json; version=3.account-quotas"
      ).then((json: any) => {
        resolve(json);
      });
    });
  }
  getAppById(id: string) {
    return this.apps.find((app) => app.id === id);
  }
  getApps() {
    return new Promise((resolve) => {
      get("apps", undefined, this.token).then((json: any) => {
        this.apps = json.map((app) => new HerokuApp(this, app));
        resolve(json);
      });
    });
  }
  init() {
    return new Promise(async (resolve) => {
      const account = await this.getAccount();
      const quota: any = await this.getQuota();
      const apps = await this.getApps();
      for (const qApp of quota.apps) {
        try {
          this.getAppById(qApp.app_uuid).quotaUsed = qApp.quota_used;
        } catch (err) {
          console.warn(
            `quota app not among account apps`,
            qApp,
            this.apps.map((app) => app.id)
          );
        }
      }
      this.quotaTotal = quota.account_quota;
      this.quotaUsed = quota.quota_used;
      resolve({ account, quota, apps });
    });
  }
}

function getAllEnvTokens() {
  const envTokenKeys = Object.keys(process.env).filter((key) =>
    key.match(/^HEROKU_TOKEN_/)
  );
  const envTokens = envTokenKeys.map((key) => ({
    key,
    name: key.split("_")[2],
    token: process.env[key],
  }));
  return envTokens;
}

async function test() {
  const accs = getAllEnvTokens().map((token) => new HerokuAccount(token.name));

  const initResult = await Promise.all(accs.map((acc) => acc.init()));

  console.log(JSON.stringify(accs, null, 2));
}

test();
