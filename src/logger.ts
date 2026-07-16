/* eslint-disable no-console */
function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (...args: unknown[]) => console.log(`[${ts()}] INFO`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${ts()}] WARN`, ...args),
  error: (...args: unknown[]) => console.error(`[${ts()}] ERROR`, ...args),
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) console.debug(`[${ts()}] DEBUG`, ...args);
  },
};
