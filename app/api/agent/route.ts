// import { AgentKit } from "@coinbase/agentkit";
import { approveWithdrawTransaction, getDeployedSafeClient } from "@/app/utils/agentHelper";

import { NextResponse } from "next/server";
// import { createWalletClient } from "viem";
// import { arbitrum } from "viem/chains";

export async function POST(request: Request) {
  try {
    // const agentKit = await AgentKit.from({
    //   walletProvider: provider,
    // });

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
