import express from "express";
import utils from "@browsercapturesalt/config/server/utils";
import { appMan, gitMan } from "./index";

const PORT = utils.envIntElse("PORT", 3000);
const API_BASE_URL = "/api";

const APP_NAME = process.env.APP_NAME || "herokuappman";

const app = express();

const api = express.Router();

api.use(express.json());

api.use((req, res, next) => {
  req.isAdmin = false;
  if (req.body) {
    if (req.body.ADMIN_PASS === process.env.ADMIN_PASS) {
      req.isAdmin = true;
    }
  }
  next();
});

app.use(API_BASE_URL, api);

const SERVER_STARTED_AT = Date.now();
const INDEX_TITLE = "Heroku App Manager";

api.get("/init", (req, res) => {
  utils.sendJson(res, { SERVER_STARTED_AT, INDEX_TITLE });
});

api.post("/appman", (req, res) => {
  if (req.isAdmin) {
    appMan.init().then((result) => {
      utils.sendJson(res, appMan.serialize());
    });
  } else {
    utils.sendJson(res, { error: "Not Authorized" });
  }
});

api.post("/gitman", (req, res) => {
  if (req.isAdmin) {
    gitMan.init().then((result) => {
      utils.sendJson(res, gitMan.serialize());
    });
  } else {
    utils.sendJson(res, { error: "Not Authorized" });
  }
});

api.post("/allman", (req, res) => {
  if (req.isAdmin) {
    Promise.all([appMan.init(), gitMan.init()]).then((result) => {
      utils.sendJson(res, {
        appMan: appMan.serialize(),
        gitMan: gitMan.serialize(),
      });
    });
  } else {
    utils.sendJson(res, { error: "Not Authorized" });
  }
});

api.post("/getlogs", (req, res) => {
  if (req.isAdmin) {
    appMan.getLogs(req.body.app.name).then((result) => {
      utils.sendJson(res, result);
    });
  } else {
    utils.sendJson(res, { error: "Not Authorized" });
  }
});

api.post("/getbuilds", (req, res) => {
  if (req.isAdmin) {
    appMan.getBuilds(req.body.name).then((result) => {
      utils.sendJson(res, result);
    });
  } else {
    utils.sendJson(res, { error: "Not Authorized" });
  }
});

api.post("/getconfig", (req, res) => {
  if (req.isAdmin) {
    appMan.getConfig(req.body.name).then((result) => {
      utils.sendJson(res, result);
    });
  } else {
    utils.sendJson(res, { error: "Not Authorized" });
  }
});

api.post("/setconfig", (req, res) => {
  if (req.isAdmin) {
    appMan.setConfig(req.body.name, req.body.config).then((result) => {
      utils.sendJson(res, result);
    });
  } else {
    utils.sendJson(res, { error: "Not Authorized" });
  }
});

app.get("/", (req, res) => {
  utils.sendView(res, "index.html");
});

app.get("/favicon.ico", (req, res) => {
  utils.sendView(res, "favicon.ico");
});

app.get("/vue.js", (req, res) => {
  utils.sendModule(res, "vue/dist/vue.global.prod.js");
});

app.get("/utils.js", (req, res) => {
  utils.sendView(res, "utils.js");
});

export function startServer() {
  return new Promise((resolve) => {
    Promise.all([utils.init(), appMan.init()]).then((initResults) => {
      console.log({ initResults });

      app.listen(PORT, () => {
        console.log(`${APP_NAME} listening at ${PORT}`);

        resolve({ initResults, APP_NAME, PORT });
      });
    });
  });
}
