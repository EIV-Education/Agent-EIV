import * as Lark from "@larksuiteoapi/node-sdk";
import { config } from "../config";

export const larkClient = new Lark.Client({
  appId: config.lark.appId,
  appSecret: config.lark.appSecret,
  domain: config.lark.domain === "feishu" ? Lark.Domain.Feishu : Lark.Domain.Lark,
});

export const larkEventDispatcher = new Lark.EventDispatcher({
  encryptKey: config.lark.encryptKey || undefined,
  verificationToken: config.lark.verificationToken || undefined,
});

// Persistent (WebSocket) connection to Lark: no public domain or webhook
// verification needed, unlike the Request URL / adaptExpress approach.
export const larkWSClient = new Lark.WSClient({
  appId: config.lark.appId,
  appSecret: config.lark.appSecret,
  domain: config.lark.domain === "feishu" ? Lark.Domain.Feishu : Lark.Domain.Lark,
});

export { Lark };
