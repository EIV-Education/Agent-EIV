import { config, assertCoreConfig } from "./config";
import { logger } from "./logger";

// Validate required env vars before loading any module that talks to Lark:
// the Lark SDK client is constructed at module-load time, so a plain static
// import here would crash with a raw SDK error instead of this clear one.
assertCoreConfig();

const { createServer, startLarkConnection } = require("./server") as typeof import("./server");

const app = createServer();

app.listen(config.port, () => {
  logger.info(`Health check server dang chay tren port ${config.port} (khong can public de Lark hoat dong)`);
});

startLarkConnection();
