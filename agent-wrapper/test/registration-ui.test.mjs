import test from "node:test";
import assert from "node:assert/strict";
import { setWalletConnectionControls } from "../src/registration-ui.mjs";

function fakeButton({ hidden = false, disabled = false } = {}) {
  const classes = new Set(hidden ? ["hidden"] : []);
  return {
    disabled,
    classList: {
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
  };
}

test("successful wallet connection enables the initially disabled review button", () => {
  const requestButton = fakeButton({ hidden: true, disabled: true });
  const disconnectButton = fakeButton({ hidden: true });

  setWalletConnectionControls(requestButton, disconnectButton, true);

  assert.equal(requestButton.disabled, false);
  assert.equal(requestButton.classList.contains("hidden"), false);
  assert.equal(disconnectButton.classList.contains("hidden"), false);
});

test("disconnect hides and disables the transaction review button", () => {
  const requestButton = fakeButton();
  const disconnectButton = fakeButton();

  setWalletConnectionControls(requestButton, disconnectButton, false);

  assert.equal(requestButton.disabled, true);
  assert.equal(requestButton.classList.contains("hidden"), true);
  assert.equal(disconnectButton.classList.contains("hidden"), true);
});
