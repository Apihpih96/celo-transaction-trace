# Owner-reviewed Concordium token update

The `/set-agent-uri` page is a review flow for updating existing Concordium Testnet token 1308. It does not install an app or register another token. It checks the hosted Agent Card bytes and serialized update payload, then waits for the owner to connect the listed Testnet account, tick the confirmation box, and tap **Review this update in wallet**. The wallet's own review is the only signing/submission step; compare its network, account, contract, entrypoint, token, URI, hash, and current fee before approving.

Once this change is intentionally published and the app's start hook has built the client bundle, open `https://celo-agent-wrapper.onrender.com/set-agent-uri` in the Android browser with Concordium Wallet available for WalletConnect. This URL will not work until publication. The route and bundle must be deployed together with the API endpoint and current card/schema. No transaction has been signed or submitted by this page's implementation.

The wallet-calculated fee is intentionally not hard-coded: the prepared update carries 0 CCD amount and an energy limit of 30,000; the fee is displayed by the wallet at review time and can change. If the live card hash or payload check fails, no wallet transaction is requested.
