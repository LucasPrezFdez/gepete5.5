type Level = "debug" | "info" | "warn" | "error";

const isProd = process.env.NODE_ENV === "production";
const minLevel: Level = (process.env.LOG_LEVEL as Level) ?? (isProd ? "info" : "debug");

const levelWeight: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function shouldLog(level: Level) {
  return levelWeight[level] >= levelWeight[minLevel];
}

function format(level: Level, scope: string, message: string, context?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg: message,
    ...(context && Object.keys(context).length ? { ctx: serialize(context) } : {})
  };
  return isProd ? JSON.stringify(payload) : `[${level}] ${scope} :: ${message}${context ? " " + JSON.stringify(serialize(context)) : ""}`;
}

function serialize(context: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message, stack: isProd ? undefined : value.stack };
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function createLogger(scope: string) {
  return {
    debug(message: string, context?: Record<string, unknown>) {
      if (shouldLog("debug")) console.debug(format("debug", scope, message, context));
    },
    info(message: string, context?: Record<string, unknown>) {
      if (shouldLog("info")) console.info(format("info", scope, message, context));
    },
    warn(message: string, context?: Record<string, unknown>) {
      if (shouldLog("warn")) console.warn(format("warn", scope, message, context));
    },
    error(message: string, context?: Record<string, unknown>) {
      if (shouldLog("error")) console.error(format("error", scope, message, context));
    }
  };
}

export const logger = createLogger("app");
