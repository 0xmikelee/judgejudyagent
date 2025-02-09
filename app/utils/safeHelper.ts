import Safe, {
  getSafeAddressFromDeploymentTx,
} from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { Address, createPublicClient, http, WalletClient } from "viem";
import { arbitrumSepolia } from "viem/chains";

export const getAgentSigner = async () => {
  return null;
};

// TODO: get the agent signer address from agentkit / env
const AGENT_SIGNER_ADDRESS = "0x1942cC7E232E8d89d2012Ea8267339419f2712a4";
// const AGENT_SIGNER_ADDRESS = "0x897A99e53440703eF4817215821926F6067091f7"; // CDP
// const RPC_URL = "https://sepolia.base.org";
const RPC_URL = "https://arbitrum-sepolia-rpc.publicnode.com";

const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL),
});

// safe api clients
const apiKit = new SafeApiKit({
  chainId: BigInt(arbitrumSepolia.id),
});

/**
 * Example employer workflow (happy case)
 *
 * 1. Listing safe addresses for employer
 * 2. if there's no safe address that's created with the specific employee
 * 3. create a new safe address with the specific employee [together with its own address as employer]
 *    - getNewSafeClient
 * 4. having the safe client (& its address), deposit $$ in it with normal txn (non included in this class)
 * 5. afterwards, propose a withdraw transaction to the safe to take money out
 * 6. another party (employee) will approve the transaction
 * 7. execute the transaction
 *
 *
 */

// internal functions, invoke during new safe account creation
const storeSafeRecord = async (
  safeAddress: string,
  employerAddress: string,
  employeeAddress: string
) => {
  try {
    // Get existing records from localStorage
    const existingRecords = JSON.parse(
      localStorage.getItem("safeWallets") || "[]"
    );

    // Add new record
    existingRecords.push({
      safeAddress,
      employerAddress,
      employeeAddress,
      createdAt: new Date().toISOString(),
    });

    // Store updated records
    localStorage.setItem("safeWallets", JSON.stringify(existingRecords));

    console.log("Stored safe wallet in localStorage:", safeAddress);
  } catch (error) {
    console.error("Error storing safe wallet in localStorage:", error);
  }
};

// Add these new helper functions for retrieving records
export const getRecordsFromLocalStorage = () => {
  try {
    return JSON.parse(localStorage.getItem("safeWallets") || "[]");
  } catch (error) {
    console.error("Error reading from localStorage:", error);
    return [];
  }
};

// Update the listing functions to use localStorage
export const listRecordsForEmployer = async (employerAddress: Address) => {
  const records = getRecordsFromLocalStorage();
  return records.filter(
    (record: any) =>
      record.employerAddress.toLowerCase() === employerAddress.toLowerCase()
  );
};

export const listRecordsForEmployee = async (employeeAddress: Address) => {
  const records = getRecordsFromLocalStorage();
  return records.filter(
    (record: any) =>
      record.employeeAddress.toLowerCase() === employeeAddress.toLowerCase()
  );
};

// get / create the safe clients
export const getDeployedSafeClient = async (
  safeAddress: Address,
  signer: WalletClient
) => {
  const safeClient = await Safe.init({
    provider: signer.transport,
    safeAddress: safeAddress,
    signer: (await signer.requestAddresses())[0],
  });

  if (!(await safeClient.isSafeDeployed())) {
    throw new Error("Safe not deployed");
  }

  return safeClient;
};

// assuming only employer will start this process, employer = signer.
export const getNewSafeClient = async (
  employerAccount: WalletClient,
  employeeAddress: Address
) => {
  console.log(employerAccount.transport);

  const employerAddress = (await employerAccount.requestAddresses())[0];
  console.log(employerAddress);

  const safeClient = await Safe.init({
    provider: employerAccount.transport,
    signer: employerAddress,
    predictedSafe: {
      safeAccountConfig: {
        owners: [employerAddress, employeeAddress, AGENT_SIGNER_ADDRESS],
        threshold: 2,
      },
    },
  });

  if (await safeClient.isSafeDeployed()) {
    console.log("safe already deployed");
    return safeClient;
  }

  const deploymentTransaction =
    await safeClient.createSafeDeploymentTransaction();

  const transactionHash = await employerAccount.sendTransaction({
    to: deploymentTransaction.to,
    value: BigInt(deploymentTransaction.value),
    data: deploymentTransaction.data as `0x${string}`,
    chain: arbitrumSepolia,
    account: employerAddress,
  });

  // wait for the transaction to be done
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
  });

  console.log("receipt", receipt);

  const version = await safeClient.getContractVersion();
  console.log("version", version);

  const safeAddress = getSafeAddressFromDeploymentTx(receipt, version);

  await storeSafeRecord(safeAddress, employerAddress, employeeAddress);

  console.log(
    "safeclient",
    deploymentTransaction,
    await safeClient.isSafeDeployed(),
    await safeClient.getAddress(),
    safeClient.getPredictedSafe()
  );

  return safeClient;
};

// propose a transaction to the safe
export const proposeWithdrawTransaction = async (
  safeClient: Safe,
  to: Address,
  value: bigint
) => {
  const tx = await safeClient.createTransaction({
    transactions: [
      {
        to: to,
        data: "0x",
        value: value.toString(),
      },
    ],
  });

  console.log("tx @ proposeWithdrawTransaction", tx);
  // Every transaction has a Safe (Smart Account) Transaction Hash different than the final transaction hash
  const safeTxHash = await safeClient.getTransactionHash(tx);

  const signature = await safeClient.signHash(safeTxHash);

  console.log("signature @ proposeWithdrawTransaction", signature);
  console.log(
    "safeclient.getAddress() @ proposeWithdrawTransaction",
    await safeClient.getAddress()
  );

  // Now the transaction with the signature is sent to the Transaction Service with the Api Kit:
  await apiKit.proposeTransaction({
    safeAddress: await safeClient.getAddress(),
    safeTransactionData: tx.data,
    safeTxHash,
    senderSignature: signature.data,
    senderAddress: to, // just assume to = sender now
  });

  return true;
};

// approve a transaction to the safe (safeclient needs to be deployed safe)
export const approveWithdrawTransaction = async (safeClient: Safe) => {
  // check safe client deployed
  if (!(await safeClient.isSafeDeployed())) {
    throw new Error("Safe not deployed");
  }

  // Get pending transactions that need a signature
  const pendingTransactions = await apiKit.getPendingTransactions(
    await safeClient.getAddress()
  );
  // We assume there is only one pending transaction for the safe address
  const transaction = pendingTransactions.results[0];
  // sign the transaction
  const signature = await safeClient.signHash(transaction.transactionHash);
  // confirm the transaction
  await apiKit.confirmTransaction(transaction.transactionHash, signature.data);
  // execute the transaction
  await safeClient.executeTransaction(transaction);
};

// agents related functions

export const clearSafeRecords = () => {
  localStorage.removeItem("safeWallets");
};
