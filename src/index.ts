import fetch from "node-fetch";
import fs from "fs";

import { getGitContentJsonDec } from "@browsercapturesalt/config/server/utils";

export { fetch };

const argv = require("minimist")(process.argv.slice(2));

const API_BASE_URL = "https://api.heroku.com";
const DEFAULT_ACCEPT = "application/vnd.heroku+json; version=3";

const MAX_APPS = 5;

const APP_CONF = JSON.parse(fs.readFileSync("appconf.json").toString());

function getAppConf(name) {
  return APP_CONF.apps[name];
}

let VERBOSE = false;

function log(...args) {
  if (VERBOSE) console.log(...args);
}

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const MONTH = 30 * DAY;
export const WEEK = 7 * DAY;
export const YEAR = 365 * DAY;

export function formatDurationMs(dur: number) {
  if (dur < SECOND) return `${dur} millisecond(s)`;
  if (dur < MINUTE) return `${Math.floor((dur / SECOND) * 10) / 10} second(s)`;
  if (dur < HOUR) return `${Math.floor((dur / MINUTE) * 10) / 10} minute(s)`;
  if (dur < DAY) return `${Math.floor((dur / HOUR) * 10) / 10} hour(s)`;
  if (dur < WEEK) return `${Math.floor((dur / DAY) * 10) / 10} day(s)`;
  if (dur < MONTH) return `${Math.floor((dur / WEEK) * 10) / 10} week(s)`;
  if (dur < YEAR) return `${Math.floor((dur / MONTH) * 10) / 10} month(s)`;
  return `${Math.floor((dur / YEAR) * 10) / 10} year(s)`;
}

export function formatDuration(sec: number) {
  return formatDurationMs(sec * SECOND);
}

export function getConfig() {
  return getGitContentJsonDec("config");
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

function awaitCompletion(resolve, func, triesLeft, stepOpt?) {
  const step = stepOpt || 0;
  if (triesLeft <= 0) {
    resolve({ error: "timed out" });
  } else {
    console.log("awaiting step", step, "tries left", triesLeft);
    func().then((result: any) => {
      if (result.done) {
        resolve(result);
      } else {
        setTimeout(
          () => awaitCompletion(resolve, func, triesLeft - 1, step + 1),
          10000
        );
      }
    });
  }
}

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
    this.parentAccount = parentAccount;
  }
  build(url) {
    console.log("starting build", this.name, this.parentAccount.name, url);
    return new Promise((resolve) => {
      post(
        `apps/${this.name}/builds`,
        {
          source_blob: {
            checksum: null,
            url,
            version: null,
          },
        },
        this.parentAccount.token
      ).then((result: any) => {
        resolve(result);
      });
    });
  }
  getBuild(id: string) {
    return new Promise((resolve) => {
      get(
        `apps/${this.name}/builds/${id}`,
        undefined,
        this.parentAccount.token
      ).then((result: any) => {
        resolve(result);
      });
    });
  }
  awaitBuild(url) {
    return new Promise((resolve) => {
      this.build(url).then((result: any) => {
        const id = result.id;

        awaitCompletion(
          resolve,
          () => {
            return new Promise((resolve) => {
              this.getBuild(id).then((result: any) => {
                if (result.status === "pending") {
                  resolve({ done: false });
                } else {
                  resolve({ done: result });
                }
              });
            });
          },
          30
        );
      });
    });
  }
  getBuilds() {
    return new Promise((resolve) => {
      get(`apps/${this.name}/builds`, undefined, this.parentAccount.token).then(
        (json) => {
          resolve(json);
        }
      );
    });
  }
  setConfig(config) {
    const numKeys = Object.keys(config).length;
    console.log("setting config", this.name, numKeys, "keys");
    return new Promise((resolve) => {
      patch(
        `apps/${this.name}/config-vars`,
        config,
        this.parentAccount.token
      ).then((result: any) => {
        if (typeof result === "object") {
          const setNumKeys = Object.keys(result).length;
          console.log(
            "set config result",
            this.name,
            setNumKeys,
            "keys",
            setNumKeys >= numKeys ? "ok" : "failed"
          );
        } else {
          console.error("set config result is not object", this.name, result);
        }
        resolve(result);
      });
    });
  }
  getConfig() {
    return new Promise((resolve) => {
      get(
        `apps/${this.name}/config-vars`,
        undefined,
        this.parentAccount.token
      ).then((result: any) => {
        resolve(result);
      });
    });
  }
  toString(pref: string) {
    return `${pref}HerokuApp < ${this.name} [ ${this.id} ] ${
      this.region
    } used: ${formatDuration(this.quotaUsed)} , remaining: ${formatDuration(
      this.parentAccount.quotaRemaining()
    )} >`;
  }
}

export type CreateAppParams = {
  name: string;
  region?: string;
  stack?: string;
};

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
  createApp(cap: CreateAppParams) {
    console.log("creating app", cap);
    return new Promise((resolve) => {
      post("apps", cap, this.token).then((result: any) => {
        if (result.id === "invalid_params") {
          console.warn("could not create app", cap, result.message);
          resolve({
            error: "invalid params",
            message: result.message,
          });
        } else {
          console.log("created app", cap);
          resolve(result);
        }
      });
    });
  }
  deleteApp(name: string) {
    return new Promise((resolve) => {
      del(`apps/${name}`, undefined, this.token).then((result: any) => {
        if (result.id === "not_found") {
          resolve({
            error: "not found",
            message: result.message,
          });
        } else {
          resolve(result);
        }
      });
    });
  }
  quotaRemaining() {
    return this.quotaTotal - this.quotaUsed;
  }
  toString(pref: string) {
    const apps = this.apps.length
      ? `\n${pref}  apps:\n${this.apps
          .map((app) => "    " + app.toString(pref))
          .join("\n")}`
      : "";
    return `${pref}HerokuAccount < ${this.name} [ ${this.id} , ${
      this.token
    } ]\n${pref}  used: ${formatDuration(
      this.quotaUsed
    )} , remaining: ${formatDuration(this.quotaRemaining())}${apps}\n${pref}>`;
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
          /*console.warn(
            `quota app not among account apps`,
            qApp,
            this.apps.map((app) => app.id)
          );*/
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

class HerokuAppManager {
  accounts: HerokuAccount[] = [];
  constructor() {}
  getAccountByName(name: string) {
    const acc = this.accounts.find((acc) => acc.name === name);
    return acc;
  }
  createApp(accountName: string, cap: CreateAppParams) {
    const acc = this.getAccountByName(accountName);
    return new Promise((resolve) => {
      if (acc) {
        acc.createApp(cap).then((result: any) => {
          resolve(result);
        });
      } else {
        resolve({
          error: "no such account",
        });
      }
    });
  }
  allApps() {
    const apps = this.accounts.map((acc) => acc.apps).flat();
    return apps;
  }
  getAppByName(name: string) {
    const app = this.allApps().find((app) => app.name === name);
    return app;
  }
  setConfig(name: string, config: any) {
    const app = this.getAppByName(name);
    return new Promise((resolve) => {
      if (app) {
        app.setConfig(config).then((result: any) => {
          resolve(result);
        });
      } else {
        resolve({
          error: "no such app",
        });
      }
    });
  }
  getConfig(name: string) {
    const app = this.getAppByName(name);
    return new Promise((resolve) => {
      if (app) {
        app.getConfig().then((result: any) => {
          resolve(result);
        });
      } else {
        resolve({
          error: "no such app",
        });
      }
    });
  }
  getBuilds(name: string) {
    const app = this.getAppByName(name);
    return new Promise((resolve) => {
      if (app) {
        app.getBuilds().then((result: any) => {
          resolve(result);
        });
      } else {
        resolve({
          error: "no such app",
        });
      }
    });
  }
  getAccountByAppName(name: string) {
    const app = this.allApps().find((app) => app.name === name);
    if (app) {
      return app.parentAccount;
    } else {
      return undefined;
    }
  }
  deleteApp(name: string) {
    const acc = this.getAccountByAppName(name);
    return new Promise((resolve) => {
      if (acc) {
        acc.deleteApp(name).then((result: any) => {
          resolve(result);
        });
      } else {
        resolve({
          error: "no such app",
        });
      }
    });
  }
  toString() {
    return `HerokuAppManager <\n${this.accounts
      .map((acc) => acc.toString("  "))
      .join("\n")}\n>`;
  }
  init() {
    return new Promise(async (resolve) => {
      this.accounts = getAllEnvTokens().map(
        (token) => new HerokuAccount(token.name)
      );

      const initResult = await Promise.all(
        this.accounts.map((acc) => acc.init())
      );

      resolve(initResult);
    });
  }
  deployApp(name) {
    return new Promise(async (resolve) => {
      const app = this.getAppByName(name);

      if (!app) {
        resolve({ error: "no such app" });
        return;
      }

      const appConf = getAppConf("appmandummyapp");

      if (!appConf) {
        resolve({ error: "no conf for app" });
        return;
      }

      const targzUrl = appConf.targzUrl;

      if (!targzUrl) {
        resolve({ error: "no targz url for app" });
        return;
      }

      const preferredAccount = appConf.preferredAccount;

      if (!preferredAccount) {
        resolve({ error: "no preferred account for app" });
        return;
      }

      const createAppResult = await this.createApp(preferredAccount, {
        name,
      });

      const initResult = await this.init();

      const getConfigResult = await getConfig();

      const config = getConfigResult.content;

      if (!config) {
        resolve({ error: "could not get config for app" });
        return;
      }

      const setConfigResult = await this.setConfig(name, config);

      const awaitBuildResult = await app.awaitBuild(targzUrl);

      resolve(awaitBuildResult);
    });
  }
}

function interpreter(argv) {
  const command = argv._[0];

  if (command === "config") {
    getConfig().then((result) => {
      const config = result.content;
      if (config) {
        const keys = Object.keys(config);
        APP_CONF["config"] = keys;
        fs.writeFileSync("appconf.json", JSON.stringify(APP_CONF, null, 2));
        console.log(keys);
        console.log("written", keys.length, "keys");
      } else {
        console.error("could not obtain config", result);
      }
    });
  }
}

async function test() {
  const appMan = new HerokuAppManager();

  await appMan.init();

  const deployResult = await appMan.deployApp("appmandummyapp");

  console.log(deployResult);
}

//test();

if (require.main === module) {
  interpreter(argv);
}
