import { createPublicClient, createWalletClient, custom, http } from "viem";
import { Address } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import Safe, { getSafeAddressFromDeploymentTx } from "@safe-global/protocol-kit";
import { CdpWalletProvider } from "@coinbase/agentkit";
import SafeApiKit from "@safe-global/api-kit";

const privateKey = process.env.AGENT_PRIVATE_KEY;

const RPC_URL = "https://sepolia.base.org";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

// forward standard eip1193 methods to CDP Wallet Provider
export const transformTransport = (cdpProvider: CdpWalletProvider) => {
  const transport = custom({
    async request({ method, params }) {
      switch (method) {
        case "eth_sendTransaction":
          console.log("eth_sendTransaction", params[0]);
          return cdpProvider.sendTransaction(params[0]);

        case "personal_sign":
        case "eth_sign":
          console.log("eth_sign", params[1]);
          return cdpProvider.signMessage(params[1]); // params[1] is the message, params[0] is address

        case "eth_signTypedData":
        case "eth_signTypedData_v4":
          console.log("eth_signTypedData", params[1]);
          return cdpProvider.signTypedData(params[1]); // params[1] is the data, params[0] is address

        case "eth_accounts":
        case "eth_requestAccounts":
          console.log("eth_accounts", await cdpProvider.getAddress());
          return [await cdpProvider.getAddress()];

        case "eth_chainId":
          console.log("eth_chainId", await publicClient.getChainId());
          return await publicClient.getChainId();

        case "eth_getBalance":
          console.log("eth_getBalance res", await cdpProvider.getBalance());
          return await cdpProvider.getBalance();

        case "eth_call":
          console.log("eth_call", params[0]);
          return await publicClient.readContract(params[0]);

        case "eth_getCode":
          console.log("eth_getCode", params[0]);
          console.log("eth_getCode res", await publicClient.getCode({ address: params[0] }));
          return await publicClient.getCode({ address: params[0] });

        default:
          throw new Error(`Method ${method} not supported`);
      }
    },
  });

  return transport;
};

// create a safe from agent account (cdp wallet provider)
export const createSafeFromAgent = async (agentAccount: CdpWalletProvider, employerAddress: Address, employeeAddress: Address) => {
  console.log(employerAddress);

  const client = createWalletClient({ chain: baseSepolia, transport: transformTransport(agentAccount) });

  const agentAddress = await agentAccount.getAddress();
  const safeClient = await Safe.init({
    provider: client.transport,
    signer: agentAddress,
    predictedSafe: {
      safeAccountConfig: {
        owners: [employerAddress, employeeAddress, agentAddress],
        threshold: 2,
      },
    },
  });

  if (await safeClient.isSafeDeployed()) {
    console.log("safe already deployed");
  }

  const deploymentTransaction = await safeClient.createSafeDeploymentTransaction();

  const transactionHash = await agentAccount.sendTransaction({
    to: deploymentTransaction.to,
    value: BigInt(deploymentTransaction.value),
    data: deploymentTransaction.data as `0x${string}`,
  });

  // wait for the transaction to be done
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
  });

  const safeAddress = getSafeAddressFromDeploymentTx(receipt, "1.4.1");

  console.log("safeclient", deploymentTransaction, await safeClient.isSafeDeployed(), await safeClient.getAddress(), safeClient.getPredictedSafe());

  return safeAddress;
};

export const getDeployedSafeClient = async (safeAddress: Address) => {
  const safeClient = await Safe.init({
    provider: publicClient.transport,
    safeAddress: safeAddress,
    signer: privateKey,
  });

  if (!(await safeClient.isSafeDeployed())) {
    throw new Error("Safe not deployed");
  }

  return safeClient;
};

// not able to complete end to end :(
export const getDeployedSafeClient_CDP = async (safeAddress: Address, cdpSigner: CdpWalletProvider) => {
  const client = createWalletClient({ transport: transformTransport(cdpSigner), chain: baseSepolia });

  console.log("client addresses, safeAddress", cdpSigner.getAddress(), safeAddress);
  const safeClient = await Safe.init({
    provider: client.transport,
    safeAddress: safeAddress,
    signer: cdpSigner.getAddress(),
  });

  if (!(await safeClient.isSafeDeployed())) {
    throw new Error("Safe not deployed");
  }

  return safeClient;
};

// approve a transaction to the safe (safeclient needs to be deployed safe)
export const approveWithdrawTransaction = async (safeClient: Safe) => {
  // safe api clients
  const apiKit = new SafeApiKit({
    chainId: BigInt(baseSepolia.id),
  });

  // check safe client deployed
  if (!(await safeClient.isSafeDeployed())) {
    throw new Error("Safe not deployed");
  }

  // Get pending transactions that need a signature
  const pendingTransactions = await apiKit.getPendingTransactions(await safeClient.getAddress());
  // We assume there is only one pending transaction for the safe address

  console.log("pendingTransactions", pendingTransactions);
  const transaction = pendingTransactions.results[0];

  console.log("transaction", transaction);
  // sign the transaction
  const signature = await safeClient.signHash(transaction.safeTxHash);
  // confirm the transaction

  console.log("signature", signature);

  await apiKit.confirmTransaction(transaction.safeTxHash, signature.data);
  // execute the transaction

  await safeClient.executeTransaction(transaction);
  // todo: better resp
  return true;
};
