"use client";
import { useState, useEffect } from "react";

import { getNewSafeClient } from "@/app/utils/safeHelper";
import { useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, Hex } from "viem";
import { arbitrum } from "viem/chains";

interface ResignationChecklist {
  resignation_checklist: {
    notice_period: {
      duration: string;
      clause_reference: string;
      exceptions: string;
    };
    resignation_letter: {
      required: string;
      format: string;
      deadline: string;
      submission_method: string;
      recipient: {
        primary: string;
        alternate: string;
      };
    };
    special_requirements: Array<{
      requirement: string;
      deadline: string;
      clause_reference: string;
    }>;
    post_resignation_obligations: Array<{
      obligation: string;
      duration: string;
      clause_reference: string;
    }>;
    compliance_consequences: string[];
  };
}

export default function Page() {
  const { wallets } = useWallets();
  const [file, setFile] = useState<File | null>(null);
  const [employeeAddress, setEmployeeAddress] = useState<string | null>(null);
  const [resignationChecklist, setResignationChecklist] = useState<ResignationChecklist | null>(null);
  const [safeWalletAddr, setSafeWalletAddr] = useState<string | null>(null);

  useEffect(() => {
    console.log("State updated - resignationChecklist:", resignationChecklist);
  }, [resignationChecklist]);

  async function handleContractAnalysis(selectedFile: File) {
    console.log(file);
    console.log("Starting contract analysis...");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("https://judge-judy-fastapi.vercel.app/api/analyze-contract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Raw API Response:", JSON.stringify(data, null, 2));

      // Get the checklist data directly from the response
      const checklist = data.resignationChecklist || data.data || data;

      if (!checklist) {
        console.error("Checklist is undefined or null");
        return;
      }

      // Set the checklist data directly
      setResignationChecklist(checklist);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  }

  const handleCreateNewSafe = async () => {
    if (!employeeAddress) return;
    const employerPrivyWallet = wallets[0] || null;

    await employerPrivyWallet.switchChain(arbitrum.id);

    const provider = await employerPrivyWallet.getEthereumProvider();
    const walletClient = createWalletClient({
      account: employerPrivyWallet.address as Hex,
      chain: arbitrum,
      transport: custom(provider),
    });

    const safeClient = await getNewSafeClient(walletClient, employeeAddress);
    const contractAddr = await safeClient.getAddress();
    setSafeWalletAddr(contractAddr);
    console.log(safeClient);

    const storeObj = {
      createdAt: new Date().toUTCString(),
      safeWalletAddress: contractAddr,
      employerAddress: employerPrivyWallet.address,
      employeeAddress,
    };
    const existingTx = localStorage.getItem("transactions") || "[]";
    const newTx = JSON.parse(existingTx);
    localStorage.setItem("transactions", JSON.stringify([...newTx, storeObj]));
    console.log({ newTx });
  };

  return (
    <>
      <div className="flex flex-col w-full mx-auto px-10 py-10 items-center gap-10">
        <h1 className="font-bold text-2xl bg-slate-300 w-full text-center">Create Contract</h1>
        <div className="flex gap-4 w-full justify-start items-center">
          <p className="font-bold text-lg w-20">Step 1:</p>
          <label className="bg-blue-300 rounded-lg p-2 text-xs text-center cursor-pointer" htmlFor="employmentContract">
            Upload Employment Contract
          </label>
          <input
            hidden
            type="file"
            accept="application/pdf"
            id="employmentContract"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0] || null;
              setFile(selectedFile);
              if (selectedFile) {
                handleContractAnalysis(selectedFile);
              }
            }}
          />
        </div>
        {resignationChecklist ? (
          <>
            <div className="flex w-full gap-4">
              <p className="font-bold text-lg w-20">Step 2:</p>
              <div className="flex flex-col gap-4 justify-end items-start w-full">
                <p>Review Resignation Checklist</p>
                <p className="text-xl font-bold border-b-2 border-gray-500">Notice Period</p>
                <div className="w-full">
                  <div className="flex gap-4">
                    <p className="font-bold">Duration:</p>
                    <p>{resignationChecklist?.resignation_checklist?.notice_period?.duration}</p>
                  </div>
                  <div className="flex gap-4">
                    <p className="font-bold">Clause Reference:</p>
                    <p>{resignationChecklist?.resignation_checklist?.notice_period?.clause_reference}</p>
                  </div>
                  <div className="flex gap-4">
                    <p className="font-bold">Exceptions:</p>
                    <p>{resignationChecklist?.resignation_checklist?.notice_period?.exceptions}</p>
                  </div>
                  <div className="flex gap-4">
                    <p className="font-bold">Clause Reference:</p>
                    <p>{resignationChecklist?.resignation_checklist?.notice_period?.clause_reference}</p>
                  </div>
                </div>
                <p className="text-xl font-bold border-b-2 border-gray-500">Resignation Letter</p>
                <div className="w-full">
                  <div className="flex gap-4">
                    <p className="font-bold">Required:</p>
                    <p>{resignationChecklist?.resignation_checklist?.resignation_letter?.required}</p>
                  </div>
                  <div className="flex gap-4">
                    <p className="font-bold">Format:</p>
                    <p>{resignationChecklist?.resignation_checklist?.resignation_letter?.format}</p>
                  </div>
                  <div className="flex gap-4">
                    <p className="font-bold">Deadline:</p>
                    <p>{resignationChecklist?.resignation_checklist?.resignation_letter?.deadline}</p>
                  </div>
                  <div className="flex gap-4">
                    <p className="font-bold">Submission Method:</p>
                    <p>{resignationChecklist?.resignation_checklist?.resignation_letter?.submission_method}</p>
                  </div>
                  <div className="flex gap-4">
                    <p className="font-bold">Recipients:</p>
                    <div className="flex flex-col px-5">
                      <div className="flex">
                        <p>Primary:</p>
                        <p>{resignationChecklist?.resignation_checklist?.resignation_letter?.recipient?.primary}</p>
                      </div>
                      <div className="flex">
                        <p>Alternative:</p>
                        <p>{resignationChecklist?.resignation_checklist?.resignation_letter?.recipient?.alternate}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xl font-bold border-b-2 border-gray-500">Special Requirements</p>
                <div className="w-full">
                  {resignationChecklist?.resignation_checklist?.special_requirements?.map((req, i) => (
                    <div className="py-3" key={i}>
                      <p className="font-bold text-lg italic">Requirement {i + 1}</p>
                      <div className="flex gap-4">
                        <p className="font-bold">Requirement:</p>
                        <p>{req.requirement}</p>
                      </div>
                      <div className="flex gap-4">
                        <p className="font-bold">Deadline:</p>
                        <p>{req.deadline}</p>
                      </div>
                      <div className="flex gap-4">
                        <p className="font-bold">Clause Reference:</p>
                        <p>{req.clause_reference}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xl font-bold border-b-2 border-gray-500">Post Resignation Requirements</p>
                <div className="w-full">
                  {resignationChecklist?.resignation_checklist?.post_resignation_obligations?.map((postOb, i) => (
                    <div className="py-3" key={i}>
                      <p className="font-bold text-lg italic">Obligation {i + 1}</p>
                      <div className="flex gap-4">
                        <p className="font-bold">Obligation:</p>
                        <p>{postOb.obligation}</p>
                      </div>
                      <div className="flex gap-4">
                        <p className="font-bold">Duration:</p>
                        <p>{postOb.duration}</p>
                      </div>
                      <div className="flex gap-4">
                        <p className="font-bold">Clause Reference:</p>
                        <p>{postOb.clause_reference}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xl font-bold border-b-2 border-gray-500">Compliance Consequences</p>
                <div className="w-full">
                  <ul>
                    {resignationChecklist?.resignation_checklist?.compliance_consequences?.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex w-full gap-4">
              <p className="font-bold text-lg w-20">Step 3:</p>
              <div className="flex flex-col w-[50%]">
                <label htmlFor="employeeWalletAdd">Enter Employee&apos;s Wallet Address</label>
                <input
                  id="employeeWalletAdd"
                  type="text"
                  className="border-black border-solid border-2 w-full"
                  onChange={(e) => setEmployeeAddress(e.target.value)}
                />
              </div>
            </div>
            <div className="flex w-full gap-4">
              <p className="font-bold text-lg w-20">Step 4:</p>
              <div className="flex flex-col">
                <p>Sign Transaction to confirm the contract</p>
                <button className="bg-blue-300 rounded-lg p-2 w-[50%] text-xs" onClick={handleCreateNewSafe}>
                  Sign Transaction
                </button>
              </div>
            </div>
            {safeWalletAddr ? (
              <div className="flex w-full gap-4">
                <p className="font-bold text-lg w-20">Step 5:</p>
                <div className="flex flex-col">
                  <p className="font-bold">Deposit ETH to this Safe Wallet Address:</p>
                  <p>{safeWalletAddr}</p>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
