import { config, assertCoreConfig } from "./config";
import { logger } from "./logger";

// Validate required env vars before loading any module that talks to Lark:
// the Lark SDK client is constructed at module-load time, so a plain static
// import here would crash with a raw SDK error instead of this clear one.
assertCoreConfig();

const { createServer } = require("./server") as typeof import("./server");

const app = createServer();

app.listen(config.port, () => {
  logger.info(`Lark AI Agent dang chay tren port ${config.port}`);
  logger.info(`Webhook URL can khai bao trong Lark app: http://<domain-cong-khai>/webhook/event`);
});
