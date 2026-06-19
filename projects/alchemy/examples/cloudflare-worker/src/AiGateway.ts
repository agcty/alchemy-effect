import * as Cloudflare from "@oddlynew/alchemy/Cloudflare";

export const Gateway = Cloudflare.AiGateway("Gateway", {
  cacheTtl: 60,
  collectLogs: true,
});
