import { config, assertCoreConfig } from "./config";
import { createServer } from "./server";
import { logger } from "./logger";

assertCoreConfig();

const app = createServer();

app.listen(config.port, () => {
  logger.info(`Lark AI Agent dang chay tren port ${config.port}`);
  logger.info(`Webhook URL can khai bao trong Lark app: http://<domain-cong-khai>/webhook/event`);
});
