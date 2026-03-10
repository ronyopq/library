const WORKER_ORIGIN = "https://personal-library.ronybd.workers.dev";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/i/") || url.pathname.startsWith("/b/")) {
      const target = new URL(`${WORKER_ORIGIN}${url.pathname}${url.search}`);
      return fetch(new Request(target.toString(), request));
    }

    return env.ASSETS.fetch(request);
  }
};
