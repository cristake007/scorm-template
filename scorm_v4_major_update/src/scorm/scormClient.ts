// src/scorm/scormClient.ts
// SCORM 2004 3rd Ed runtime adapter (API_1484_11) with offline fallback.

export type ScormLastError = {
  code: string;
  message: string;
  diagnostic: string;
};

type Api2004 = {
  Initialize: (arg: string) => string;
  Terminate: (arg: string) => string;
  GetValue: (key: string) => string;
  SetValue: (key: string, value: string) => string;
  Commit: (arg: string) => string;
  GetLastError: () => string;
  GetErrorString: (code: string) => string;
  GetDiagnostic: (code: string) => string;
};

type AdlWrapper = {
  doInitialize: () => string;
  doTerminate: () => string;
  doGetValue: (key: string) => string;
  doSetValue: (key: string, value: string) => string;
  doCommit: () => string;
  doGetLastError: () => string;
  doGetErrorString: (code: string) => string;
  doGetDiagnostic: (code: string) => string;
};

type RuntimeCall = {
  Initialize: () => string;
  Terminate: () => string;
  GetValue: (key: string) => string;
  SetValue: (key: string, value: string) => string;
  Commit: () => string;
  GetLastError: () => string;
  GetErrorString: (code: string) => string;
  GetDiagnostic: (code: string) => string;
};

export interface ScormClient {
  apiFound: boolean;
  initialized: boolean;
  mode: "lms" | "offline";

  initialize(): boolean;
  terminate(options?: { exit?: "normal" | "suspend" | "logout" | "time-out" }): boolean;

  get(key: string): string;
  set(key: string, value: string): boolean;
  commit(): boolean;

  getLastError(): ScormLastError;

  setJson(key: string, value: unknown): boolean;
  getJson<T = any>(key: string): T | null;

  setScore(params: { raw: number; max: number; min?: number; passed?: boolean }): void;

  setCompletion(params: {
    completionStatus?: "completed" | "incomplete" | "not attempted" | "unknown";
    successStatus?: "passed" | "failed" | "unknown";
  }): void;
}

const SUSPEND_DATA_MAX_CHARS = 64000;

function ok(res: string): boolean {
  return res === "true" || res === "1";
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function safeJsonStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

function safeGetWindowParent(win: Window): Window | null {
  try {
    if (win.parent && win.parent !== win) return win.parent;
  } catch {
    // ignore cross-origin
  }
  return null;
}

function safeGetWindowOpener(win: Window): Window | null {
  try {
    if (win.opener && win.opener !== win) return win.opener;
  } catch {
    // ignore
  }
  return null;
}

function findApi2004(maxDepth: number): Api2004 | null {
  const seen = new Set<Window>();
  const candidates: Window[] = [window];

  const opener = safeGetWindowOpener(window);
  if (opener) candidates.push(opener);

  for (const start of candidates) {
    let w: Window | null = start;
    for (let i = 0; i < maxDepth && w; i++) {
      if (seen.has(w)) break;
      seen.add(w);

      try {
        const anyW = w as any;
        if (anyW.API_1484_11) return anyW.API_1484_11 as Api2004;
      } catch {
        // ignore
      }

      w = safeGetWindowParent(w);
    }
  }

  return null;
}

function getWrapper(): AdlWrapper | null {
  try {
    return (window as any).ADL_SCORM_2004 ?? null;
  } catch {
    return null;
  }
}

function createOfflineCall(storageKeyPrefix: string): RuntimeCall {
  const read = (key: string): string => {
    try {
      return window.localStorage.getItem(`${storageKeyPrefix}:${key}`) ?? "";
    } catch {
      return "";
    }
  };

  const write = (key: string, value: string): boolean => {
    try {
      window.localStorage.setItem(`${storageKeyPrefix}:${key}`, value);
      return true;
    } catch {
      return false;
    }
  };

  return {
    Initialize: () => "true",
    Terminate: () => "true",
    GetValue: (key: string) => read(key),
    SetValue: (key: string, value: string) => (write(key, value) ? "true" : "false"),
    Commit: () => "true",
    GetLastError: () => "0",
    GetErrorString: () => "",
    GetDiagnostic: () => ""
  };
}

function createLiveAdapter(maxSearchDepth: number) {
  const wrapper = getWrapper();
  const api = findApi2004(maxSearchDepth);

  const apiFound = !!wrapper || !!api;

  const call: RuntimeCall = {
    Initialize(): string {
      if (wrapper) return wrapper.doInitialize();
      if (api) return api.Initialize("");
      return "false";
    },
    Terminate(): string {
      if (wrapper) return wrapper.doTerminate();
      if (api) return api.Terminate("");
      return "false";
    },
    GetValue(key: string): string {
      if (wrapper) return wrapper.doGetValue(key) ?? "";
      if (api) return api.GetValue(key) ?? "";
      return "";
    },
    SetValue(key: string, value: string): string {
      if (wrapper) return wrapper.doSetValue(key, value);
      if (api) return api.SetValue(key, value);
      return "false";
    },
    Commit(): string {
      if (wrapper) return wrapper.doCommit();
      if (api) return api.Commit("");
      return "false";
    },
    GetLastError(): string {
      if (wrapper) return wrapper.doGetLastError() ?? "0";
      if (api) return api.GetLastError() ?? "0";
      return "0";
    },
    GetErrorString(code: string): string {
      if (wrapper) return wrapper.doGetErrorString(code) ?? "";
      if (api) return api.GetErrorString(code) ?? "";
      return "";
    },
    GetDiagnostic(code: string): string {
      if (wrapper) return wrapper.doGetDiagnostic(code) ?? "";
      if (api) return api.GetDiagnostic(code) ?? "";
      return "";
    }
  };

  return { apiFound, call };
}

let _scorm: ScormClient | null = null;

function toScorm2004Duration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `PT${hours}H${minutes}M${seconds}S`;
}

export function createScormClientStrict(options?: {
  maxSearchDepth?: number;
  allowOffline?: boolean;
  offlineStoragePrefix?: string;
}): ScormClient {
  if (_scorm) return _scorm;

  const maxSearchDepth = options?.maxSearchDepth ?? 25;
  const allowOffline = options?.allowOffline ?? true;
  const offlineStoragePrefix = options?.offlineStoragePrefix ?? "scorm-offline";

  const adapter = createLiveAdapter(maxSearchDepth);
  const runtimeCall = adapter.apiFound ? adapter.call : createOfflineCall(offlineStoragePrefix);

  let sessionStartedAtMs = 0;

  const client: ScormClient = {
    apiFound: adapter.apiFound,
    initialized: false,
    mode: adapter.apiFound ? "lms" : "offline",

    initialize(): boolean {
      if (!adapter.apiFound && !allowOffline) return false;
      if (client.initialized) return true;

      const res = runtimeCall.Initialize();
      client.initialized = ok(res);

      if (client.initialized) {
        sessionStartedAtMs = Date.now();
        client.set("cmi.exit", "suspend");

        const cs = client.get("cmi.completion_status");
        if (!cs) client.set("cmi.completion_status", "incomplete");
      }

      return client.initialized;
    },

    terminate(options?: { exit?: "normal" | "suspend" | "logout" | "time-out" }): boolean {
      if (!client.initialized) return true;

      try {
        const exitValue = options?.exit ?? "suspend";
        client.set("cmi.exit", exitValue);
        const started = sessionStartedAtMs || Date.now();
        client.set("cmi.session_time", toScorm2004Duration(Date.now() - started));
        client.commit();
      } catch {
        // ignore
      }

      const res = runtimeCall.Terminate();
      const okRes = ok(res);
      if (okRes) client.initialized = false;
      return okRes;
    },

    get(key: string): string {
      if (!client.initialized) return "";
      return runtimeCall.GetValue(key) ?? "";
    },

    set(key: string, value: string): boolean {
      if (!client.initialized) return false;
      if (key === "cmi.suspend_data" && value.length > SUSPEND_DATA_MAX_CHARS) {
        // eslint-disable-next-line no-console
        console.warn(`SCORM: cmi.suspend_data length ${value.length} exceeds ${SUSPEND_DATA_MAX_CHARS}.`);
      }
      return ok(runtimeCall.SetValue(key, value));
    },

    commit(): boolean {
      if (!client.initialized) return false;
      return ok(runtimeCall.Commit());
    },

    getLastError(): ScormLastError {
      if (!adapter.apiFound) {
        return {
          code: "0",
          message: "offline mode",
          diagnostic: "SCORM API_1484_11 not found. Using localStorage fallback."
        };
      }

      const code = runtimeCall.GetLastError() ?? "0";
      if (!code || code === "0") return { code: "0", message: "", diagnostic: "" };

      return {
        code,
        message: runtimeCall.GetErrorString(code) ?? "",
        diagnostic: runtimeCall.GetDiagnostic(code) ?? ""
      };
    },

    setJson(key: string, value: unknown): boolean {
      return client.set(key, safeJsonStringify(value));
    },

    getJson<T = any>(key: string): T | null {
      const s = client.get(key);
      if (!s) return null;
      return safeJsonParse<T>(s);
    },

    setScore({ raw, max, min = 0, passed }: { raw: number; max: number; min?: number; passed?: boolean }) {
      const rawStr = Number.isFinite(raw) ? String(raw) : "0";
      const maxStr = Number.isFinite(max) ? String(max) : "100";
      const minStr = Number.isFinite(min) ? String(min) : "0";

      client.set("cmi.score.raw", rawStr);
      client.set("cmi.score.max", maxStr);
      client.set("cmi.score.min", minStr);

      if (passed === true) client.set("cmi.success_status", "passed");
      if (passed === false) client.set("cmi.success_status", "failed");
    },

    setCompletion({
      completionStatus,
      successStatus
    }: {
      completionStatus?: "completed" | "incomplete" | "not attempted" | "unknown";
      successStatus?: "passed" | "failed" | "unknown";
    }) {
      if (completionStatus) client.set("cmi.completion_status", completionStatus);
      if (successStatus) client.set("cmi.success_status", successStatus);
    }
  };

  _scorm = client;
  return client;
}

export function installScormExitHandlers(scorm: ScormClient) {
  const onExit = () => {
    try {
      if (scorm.initialized) scorm.commit();
      scorm.terminate();
    } catch {
      // ignore
    }
  };

  window.addEventListener("pagehide", onExit);
  window.addEventListener("beforeunload", onExit);

  return () => {
    window.removeEventListener("pagehide", onExit);
    window.removeEventListener("beforeunload", onExit);
  };
}

export function installScormAutoCommit(scorm: ScormClient, intervalMs = 60000) {
  const t = window.setInterval(() => {
    try {
      if (scorm.initialized) scorm.commit();
    } catch {
      // ignore
    }
  }, intervalMs);

  const onVis = () => {
    if (document.visibilityState === "hidden") {
      try {
        if (scorm.initialized) scorm.commit();
      } catch {
        // ignore
      }
    }
  };

  document.addEventListener("visibilitychange", onVis);

  return () => {
    window.clearInterval(t);
    document.removeEventListener("visibilitychange", onVis);
  };
}
