import { CdpWalletProvider } from "@coinbase/agentkit";
// import { AgentKit } from "@coinbase/agentkit";
import { approveWithdrawTransaction, getDeployedSafeClient } from "@/app/utils/agentHelper";

import { NextResponse } from "next/server";
// import { createWalletClient } from "viem";
// import { arbitrumSepolia } from "viem/chains";

const walletData = {
  walletId: "06be1f44-0b15-45a9-afd6-23d9a2817791",
  seed: process.env.CDP_WALLET_SEED,
  networkId: "base-sepolia",
};

export async function POST(request: Request) {
  try {
    const provider = await CdpWalletProvider.configureWithWallet({
      // Optional: Provide API key details. If not provided, it will attempt to configure from JSON.
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,

      networkId: "base-sepolia", // other options: "base-mainnet", "ethereum-mainnet", "arbitrum-mainnet", "polygon-mainnet".
      cdpWalletData: JSON.stringify(walletData),
    });

    // const agentKit = await AgentKit.from({
    //   walletProvider: provider,
    // });

    console.log("cdp provider", await provider.getAddress());

    const { safeAddress } = await request.json();

    if (!safeAddress) {
      return NextResponse.json({ error: "Safe address is required" });
    }

    const safeClient = await getDeployedSafeClient(safeAddress);
    // const safeClient = await getDeployedSafeClient_CDP(safeAddress, provider);
    // Create a new multisig agent in the database

    const result = await approveWithdrawTransaction(safeClient);

    return NextResponse.json({ success: result });
  } catch (error) {
    console.error("Error multisig agent:", error);
    return NextResponse.json({ error: "Failed to execute multisig txn." }, { status: 500 });
  }
}
