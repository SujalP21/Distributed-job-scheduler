import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  requestId: string;
  correlationId: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, callback: () => T) =>
  storage.run(context, callback);

export const getRequestContext = () => storage.getStore();
