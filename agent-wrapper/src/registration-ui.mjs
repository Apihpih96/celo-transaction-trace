export function setWalletConnectionControls(requestButton, disconnectButton, connected) {
  requestButton.disabled = !connected;
  requestButton.classList.toggle("hidden", !connected);
  disconnectButton.classList.toggle("hidden", !connected);
}
