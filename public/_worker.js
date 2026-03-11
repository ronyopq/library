const DEFAULT_WORKER_ORIGIN = "https://personal-library.ronybd.workers.dev";

const workerByHost = [
  {
    suffix: ".praanbook.pages.dev",
    origin: "https://praanbook-worker.ronybd.workers.dev"
  },
  {
    suffix: ".ronybook.pages.dev",
    origin: "https://ronybook-worker.ronybd.workers.dev"
  },
  {
    suffix: ".library-6ny.pages.dev",
    origin: "https://personal-library.ronybd.workers.dev"
  }
];

const resolveWorkerOrigin = (hostname) => {
  const normalized = String(hostname || "").toLowerCase();
  const matched = workerByHost.find((item) => normalized === item.suffix.slice(1) || normalized.endsWith(item.suffix));
  return matched?.origin || DEFAULT_WORKER_ORIGIN;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const workerOrigin = resolveWorkerOrigin(url.hostname);

    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/i/") || url.pathname.startsWith("/b/")) {
      const target = new URL(`${workerOrigin}${url.pathname}${url.search}`);
      return fetch(new Request(target.toString(), request));
    }

    return env.ASSETS.fetch(request);
  }
};
