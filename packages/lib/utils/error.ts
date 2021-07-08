const errorTypes = ["unhandledRejection", "uncaughtException"];
const signalTraps = ["SIGTERM", "SIGINT", "SIGUSR2"];

errorTypes.map((type) => {
    process.on(type, async () => {
        try {
            console.log(`process.on ${type}`);
            // await producer.disconnect()
            process.exit(0);
        } catch (_) {
            process.exit(1);
        }
    });
});

signalTraps.map((type: any): void => {
    process.once(type, async () => {
        try {
            // await producer.disconnect()
        } finally {
            process.kill(process.pid, type);
        }
    });
});
