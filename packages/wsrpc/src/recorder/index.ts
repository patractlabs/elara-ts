// import crypto from 'crypto'
import { Sequelize, DataTypes } from "sequelize";
import { getAppLogger } from "elara-lib";

const log = getAppLogger("recorder", true);

const Sq = new Sequelize({
    host: "127.0.0.1",
    port: 9002,
    dialect: "postgres",
    pool: {
        max: 5,
        min: 1,
        idle: 30000,
    },
});
log.info();

// Sq.define("blocks", {
//     id: {
//         type: DataTypes.INTEGER,
//         primaryKey: true
//     },
//     parent_hash: DataTypes.STRING,
//     hash: DataTypes.STRING.BINARY,
//     block_num: DataTypes.INTEGER,
//     state_root: DataTypes.STRING.BINARY,
//     extrinsics_root: DataTypes.STRING.BINARY,
//     digest: DataTypes.STRING.BINARY,
//     ext: DataTypes.STRING.BINARY,
//     spec: DataTypes.INTEGER
// })

Sq.define("storage", {
    id: {
        type: DataTypes.INTEGER,
    },
});

namespace Recorder {
    export const Rpcs = [
        "chain_getHeader", // block hash   0x*********** 64 length
        "chain_getBlockHash", // block number 0x*
        "chain_getBlock", // block hash   0x*********** 64 length
        "state_getStorage",
        "state_queryStorageAt",
    ];

    export const send = (chain: string, method: string, params: any[]) => {
        log.info(
            `new history request chain ${chain} method ${method} params ${params}`
        );
    };
}
export default Recorder;
