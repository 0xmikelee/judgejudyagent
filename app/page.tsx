"use client";
import Transaction from "@/app/_components/Transaction";
import Link from "next/link";
import { useWallets } from "@privy-io/react-auth";
// import {
//   listRecordsForEmployee,
//   listRecordsForEmployer,
// } from "./utils/safeHelper";
import { useEffect, useState } from "react";

interface EmployerTransaction {
  createdAt: string;
  employeeAddress: string;
  safeWalletAddress: string;
}
interface EmployeeTransaction {
  createdAt: string;
  employerAddress: string;
  safeWalletAddress: string;
}

export default function Home() {
  const { wallets } = useWallets();
  const wallet = wallets[0] || null;
  const [employerTx, setEmployerTx] = useState<EmployerTransaction[]>([]);
  const [employeeTx, setEmployeeTx] = useState<EmployeeTransaction[]>([]);
  const [walletAddr, setWalletAddr] = useState<string>();

  console.log("connected: ", wallet);

  const handleGetEmployerTransactions = async () => {
    console.log("Run Employer Txs");
    // if (!walletAddr) return;
    console.log("Run Employer Txs -- start");
    // console.log({ walletAddr });
    // const transactions = await listRecordsForEmployer(walletAddr);
    // if (!transactions.error) setEmployerTx(transactions);

    // console.log({ transactions });
    const txns = JSON.parse(localStorage.getItem("transactions") || "[]");
    const temp = txns.filter((tx: EmployerTransaction) => {
      if (txns.employerAddress === walletAddr) return tx;
    });
    console.log("Employer", { temp });
    setEmployerTx(temp);
  };

  const handleGetEmployeeTransactions = async () => {
    console.log("Run Employee Txs");
    // if (!walletAddr) return;
    console.log("Run Employee Txs -- start");
    // const transactions = await listRecordsForEmployee(walletAddr);
    // if (!transactions.error) setEmployeeTx(transactions);

    const txns = JSON.parse(localStorage.getItem("transactions") || "[]");
    const temp = txns.filter((tx: EmployeeTransaction) => {
      console.log({ walletAddr });
      if (txns.employeeAddress === walletAddr) return tx;
    });
    console.log("Employee", { temp });
    setEmployeeTx(temp);
  };

  useEffect(() => {
    if (wallet?.address) {
      setWalletAddr(wallet.address);
      handleGetEmployerTransactions();
      handleGetEmployeeTransactions();
    }
  }, [wallet]);

  return (
    <>
      <section className="item-center mx-auto flex flex-col justify-between p-10">
        <div className="item-center flex w-full justify-between">
          <h2 className="text-xl font-bold">Employer</h2>
          <Link href="/create">
            <button className="bg-gray-500 rounded-lg text-white text-xs p-4">
              Create Contract
            </button>
          </Link>
        </div>
        {wallet ? (
          employerTx?.map((tx, i) => (
            <Transaction
              key={i}
              createdDate={tx.createdAt}
              walletAddress={tx.employeeAddress}
              safeWalletAddress={tx.safeWalletAddress}
            />
          ))
        ) : (
          <p>No transactions</p>
        )}
      </section>
      <section className="item-center mx-auto flex flex-col justify-between p-10">
        <div className="item-center flex w-full justify-between">
          <h2 className="text-xl font-bold">Employee</h2>
        </div>
        {wallet ? (
          employeeTx?.map((tx, i) => (
            <Transaction
              key={i}
              createdDate={tx.createdAt}
              walletAddress={tx.employerAddress}
              safeWalletAddress={tx.safeWalletAddress}
            />
          ))
        ) : (
          <p>No transactions</p>
        )}
      </section>
    </>
  );
}
