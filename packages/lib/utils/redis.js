"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var ioredis_1 = __importDefault(require("ioredis"));
var log_1 = require("./log");
var log = log_1.getAppLogger('Redis', true);
var Rd;
(function (Rd_1) {
    var DBT;
    (function (DBT) {
        DBT[DBT["Account"] = 0] = "Account";
        DBT[DBT["Project"] = 1] = "Project";
        DBT[DBT["Stat"] = 2] = "Stat";
        DBT[DBT["Chain"] = 3] = "Chain";
        DBT[DBT["Cache"] = 4] = "Cache";
    })(DBT = Rd_1.DBT || (Rd_1.DBT = {}));
    Rd_1.newClient = function (db, arg) {
        var options = __assign(__assign({}, arg === null || arg === void 0 ? void 0 : arg.options), { db: db });
        return {
            client: new ioredis_1.default(arg === null || arg === void 0 ? void 0 : arg.port, arg === null || arg === void 0 ? void 0 : arg.host, options),
            db: db
        };
    };
    Rd_1.onConnect = function (Rd, cb) {
        Rd.client.once('connect', function () {
            log.info("Redis-" + Rd.db + " connect successfully.");
            cb && cb();
        });
    };
    Rd_1.onError = function (Rd, cb) {
        Rd.client.on('error', function (err) {
            log.error("Redis-" + Rd.db + " error: ", err);
            cb && cb(err);
        });
    };
    Rd_1.onMsg = function (Rd, cb) {
        Rd.client.on('message', function (topic, data) {
            log.info("Redis-" + Rd.db + " message event Topic[" + topic + "]: ", data);
            cb && cb(topic, data);
        });
    };
    Rd_1.onPMsg = function (Rd, cb) {
        Rd.client.on('pmessage', function (pat, topic, data) {
            log.info("Redis-" + Rd.db + " pattern message event Pat[" + pat + "] Topic[" + topic + "]: ", data);
            cb && cb(topic, data, pat);
        });
    };
})(Rd || (Rd = {}));
exports.default = Rd;
