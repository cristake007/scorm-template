// src/scorm/scormClient.ts
// SCORM 2004 3rd Ed runtime adapter (API_1484_11) - STRICT (no mock).
// - Finds API safely through window/parent/opener chains
// - Guards Initialize/Terminate calls
// - Provides commit throttling helpers
// - Provides scoring helpers (cmi.score.*, success_status, completion_status)

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

export interface ScormClient {
  apiFound: boolean;
  initialized: boolean;

  initialize(): boolean;
  terminate(): boolean;

  get(key: string): string;
  set(key: string, value: string): boolean;
  commit(): boolean;

  getLastError(): ScormLastError;

  // JSON helpers
  setJson(key: string, value: unknown): boolean;
  getJson<T>(key: string): T | null;

  // Scoring helpers (course-level)
  setScore(params: {
    raw: number;
    max: number;
    min?: number;
    passed?: boolean; // sets cmi.success_status passed/failed if provided
  }): void;

  setCompletion(params: {
    completionStatus?: "completed" | "incomplete" | "not attempted" | "unknown";
    successStatus?: "passed" | "failed" | "unknown";
  }): void;
}

// ---------- utils ----------
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

/**
 * Finds SCORM 2004 API_1484_11 by walking window -> parent chain,
 * and also checks opener chain as fallback.
 */
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

function createLiveAdapter(maxSearchDepth: number) {
  const wrapper = getWrapper();
  const api = findApi2004(maxSearchDepth);

  const apiFound = !!wrapper || !!api;

  // unified calls (prefer wrapper if present)
  const call = {
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

// ---------- singleton ----------
let _scorm: ScormClient | null = null;

export function createScormClientStrict(options?: { maxSearchDepth?: number }): ScormClient {
  if (_scorm) return _scorm;

  const maxSearchDepth = options?.maxSearchDepth ?? 25;
  const adapter = createLiveAdapter(maxSearchDepth);
  let sessionStartedAtMs = 0;

  const client: ScormClient = {
    apiFound: adapter.apiFound,
    initialized: false,

    initialize(): boolean {
      if (!client.apiFound) return false;
      if (client.initialized) return true;

      const res = adapter.call.Initialize();
      client.initialized = ok(res);
      if (client.initialized) {
        sessionStartedAtMs = Date.now();

        // Allow resume by default; change to "normal" when course truly finished if you want.
        client.set("cmi.exit", "suspend");

        // Some LMS like explicit start state
        const cs = client.get("cmi.completion_status");
        if (!cs) client.set("cmi.completion_status", "incomplete");
      }
      return client.initialized;
    },

    terminate(): boolean {
      if (!client.apiFound) return false;
      if (!client.initialized) return true;

      // Best-effort: finalize attempt so LMS dashboards update
      try {
        // If you do NOT want resume, use "normal"
        client.set("cmi.exit", "normal");

        // SCORM 2004 session_time: HH:MM:SS (or HH:MM:SS.ss)
        const started = sessionStartedAtMs || Date.now();
        const sec = Math.max(0, Math.round((Date.now() - started) / 1000));
        const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
        const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
        const ss = String(sec % 60).padStart(2, "0");
        client.set("cmi.session_time", `${hh}:${mm}:${ss}`);

        client.commit();
      } catch {
        // ignore
      }

      const res = adapter.call.Terminate();
      const okRes = ok(res);
      if (okRes) client.initialized = false;
      return okRes;
    },

    get(key: string): string {
      if (!client.apiFound || !client.initialized) return "";
      return adapter.call.GetValue(key) ?? "";
    },

    set(key: string, value: string): boolean {
      if (!client.apiFound || !client.initialized) return false;
      const res = adapter.call.SetValue(key, value);
      return ok(res);
    },

    commit(): boolean {
      if (!client.apiFound || !client.initialized) return false;
      const res = adapter.call.Commit();
      return ok(res);
    },

    getLastError(): ScormLastError {
      const code = adapter.call.GetLastError() ?? "0";
      if (!code || code === "0") return { code: "0", message: "", diagnostic: "" };
      return {
        code,
        message: adapter.call.GetErrorString(code) ?? "",
        diagnostic: adapter.call.GetDiagnostic(code) ?? ""
      };
    },

    setJson(key: string, value: unknown): boolean {
      return client.set(key, safeJsonStringify(value));
    },

    getJson<T>(key: string): T | null {
      const s = client.get(key);
      if (!s) return null;
      return safeJsonParse<T>(s);
    },

    setScore({ raw, max, min = 0, passed }: { raw: number; max: number; min?: number; passed?: boolean }) {
      // SCORM expects strings; keep simple formatting
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

// ---------- helpers: throttle + router/exit wiring ----------
type ThrottleFn = () => void;

function throttle(ms: number, fn: () => void): ThrottleFn {
  let last = 0;
  let t: number | null = null;

  return () => {
    const now = Date.now();
    const remaining = ms - (now - last);

    if (remaining <= 0) {
      last = now;
      fn();
      return;
    }

    if (t != null) return;
    t = window.setTimeout(() => {
      t = null;
      last = Date.now();
      fn();
    }, remaining);
  };
}

/**
 * Router afterEach hook:
 * - writes cmi.location to route.fullPath (bookmark)
 * - commits throttled
 */
export function installScormRouterHooks(router: any, scorm: ScormClient, commitThrottleMs = 8000) {
  const commitThrottled = throttle(commitThrottleMs, () => scorm.commit());

  router.afterEach((to: any) => {
    if (!scorm.initialized) return;
    scorm.set("cmi.location", to.fullPath);
    commitThrottled();
  });
}

/**
 * Best-effort terminate on exit.
 * Use this plus an explicit "Exit" button in the UI.
 */
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