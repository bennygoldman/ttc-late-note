import { createRequestHandler } from "react-router";
import { syncAlerts } from "../app/server/alerts";
import { syncOpenData } from "../app/server/opendata";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request) {
    // One address for the site, so every shared link looks the same.
    const url = new URL(request.url);
    if (url.hostname === "www.latenote.to") {
      url.hostname = "latenote.to";
      return Response.redirect(url.toString(), 301);
    }
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
