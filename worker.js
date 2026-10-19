import { onRequest, onRequestPost } from "./functions/api/contact.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact") {
      return request.method === "POST"
        ? onRequestPost({ request, env })
        : onRequest({ request, env });
    }
    return env.ASSETS.fetch(request);
  }
};
