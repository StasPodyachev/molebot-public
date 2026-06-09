import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { MANTLE_SEPOLIA } from "@/lib/mantle-chain";
import App from "./App";
import "./index.css";

const privyConfig: PrivyClientConfig = {
  loginMethods: ["email", "google"],
  appearance: {
    theme: "dark",
    walletChainType: "ethereum-only",
    logo: undefined,
  },
  embeddedWallets: {
    ethereum: { createOnLogin: "users-without-wallets" },
  },
  defaultChain: MANTLE_SEPOLIA,
  supportedChains: [MANTLE_SEPOLIA],
};

const appId = import.meta.env.VITE_PRIVY_APP_ID ?? import.meta.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

function Root() {
  if (!appId) {
    return (
      <main className="mx-auto max-w-xl p-8 text-[#e8e5e0]">
        <h1 className="mb-4 text-2xl font-semibold">Molebot.Mantle</h1>
        <p className="text-amber-300">
          Не настроен <code>VITE_PRIVY_APP_ID</code>.
        </p>
      </main>
    );
  }

  return (
    <PrivyProvider appId={appId} config={privyConfig}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PrivyProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
