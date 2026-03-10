const WORKER_ORIGIN = "https://personal-library.ronybd.workers.dev";

export const onRequest: PagesFunction = async (context) => {
  const incomingUrl = new URL(context.request.url);
  const targetUrl = new URL(`${WORKER_ORIGIN}${incomingUrl.pathname}${incomingUrl.search}`);

  return fetch(new Request(targetUrl.toString(), context.request));
};
