import { createRequestHandler } from "react-router";
import { syncAlerts } from "../app/server/alerts";
import { syncOpenData } from "../app/server/opendata";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request) {
    return requestHandler(request);
  },

  // Cron schedules are defined in wrangler.jsonc.
  async scheduled(controller, env) {
    if (controller.cron === "*/5 * * * *") {
      console.log(await syncAlerts(env.DB));
    } else {
      console.log(await syncOpenData(env.DB));
    }
  },
} satisfies ExportedHandler<Env>;
