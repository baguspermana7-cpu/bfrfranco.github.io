// Browser-global stubs so the repo-root rz-engine.js IIFE loads inside the
// Worker (no window/document/localStorage). Imported for SIDE EFFECTS BEFORE
// rz-engine.js — ES module imports run in source order, so these globals exist
// when the engine evaluates. The engine models are pure math; only its ui/auth
// helpers touch the DOM, and those are never called server-side.
const noop = function () {};
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
}
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    createElement: () => ({ style: {}, appendChild: noop, setAttribute: noop, addEventListener: noop }),
    body: { appendChild: noop },
    head: { appendChild: noop },
    getElementById: () => null,
    addEventListener: noop,
  };
}
if (typeof globalThis.CustomEvent === "undefined") globalThis.CustomEvent = function () {};
if (typeof globalThis.addEventListener === "undefined") globalThis.addEventListener = noop;
if (typeof globalThis.dispatchEvent === "undefined") globalThis.dispatchEvent = noop;
export const shimReady = true;
