import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const appSource = await readFile(new URL("../public/route-lab/app.js", import.meta.url), "utf8");

function loadApp(fetchImpl) {
  const elements = new Map();
  const makeElement = () => ({
    hidden: true,
    disabled: false,
    textContent: "",
    value: "",
    classList: { toggle() {} },
    querySelector() { return { textContent: "" }; },
    addEventListener(_event, handler) { this.submitHandler = handler; },
    requestSubmit() {},
  });
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
  };
  const context = { document, fetch: fetchImpl, Intl, Date, encodeURIComponent };
  vm.runInNewContext(appSource, context);
  elements.get("#pair").value = "wARS";
  elements.get("#amount").value = "10";
  return { form: elements.get("#quote-form"), elements };
}

function submit(form) {
  return form.submitHandler({ preventDefault() {} });
}

test("keeps quote errors visible after loading ends and clears them on retry", async () => {
  let calls = 0;
  const app = loadApp(async () => {
    calls += 1;
    if (calls === 1) throw new Error("quote service unavailable");
    return {
      ok: true,
      json: async () => ({
        amount: "10",
        intermediate: "20",
        returnAmount: "9.99",
        delta: "-0.01",
        roiPct: "-0.1",
        sampledAt: "2026-11-02T00:00:00Z",
        levelsAsOf: null,
        disclaimer: "Indicative only.",
      }),
    };
  });
  const error = app.elements.get("#error");
  const loading = app.elements.get("#loading");
  const result = app.elements.get("#result");

  await submit(app.form);
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /quote service unavailable/);
  assert.equal(loading.hidden, true);

  const retry = submit(app.form);
  assert.equal(error.hidden, true, "a new request clears the previous error");
  await retry;
  assert.equal(error.hidden, true);
  assert.equal(result.hidden, false);
});
