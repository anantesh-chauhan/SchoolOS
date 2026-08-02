import { AsyncLocalStorage } from 'node:async_hooks';

const requestStorage = new AsyncLocalStorage();

export const runWithRequestContext = (context, callback) => requestStorage.run(context, callback);

export const getRequestContext = () => requestStorage.getStore();

export const markCacheStatus = (status) => {
  const context = getRequestContext();
  if (context) context.cacheStatus = status;
};

