globalThis.window = {};
globalThis.document = {
  addEventListener() {},
  getElementById() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
};
globalThis.localStorage = {
  getItem() {
    return "{}";
  },
  setItem() {},
};
globalThis.confirm = () => true;

await import("../src/app.js");

console.log("smoke-check: ok");
