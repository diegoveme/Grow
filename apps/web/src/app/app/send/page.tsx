"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { BatchSend } from "@/components/send/batch-send";
import { RecurringSend } from "@/components/send/recurring-send";
import { SingleSend } from "@/components/send/single-send";
import { Segmented } from "@/components/ui/segmented";
import { useWallet } from "@/lib/wallet";

type Mode = "one" | "many" | "recurring";

export default function SendPage() {
  const { address } = useWallet();
  const [mode, setMode] = useState<Mode>("one");

  if (!address) return null;

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <PageHeader
        eyebrow="Send"
        title="Send money"
        subtitle="USDC goes through Grow and is split by each recipient's choice. XLM is sent directly. Everything settles in seconds."
      />

      <Segmented
        className="mb-4"
        value={mode}
        onChange={setMode}
        options={[
          { value: "one", label: "One person" },
          { value: "many", label: "Several people" },
          { value: "recurring", label: "Recurring" },
        ]}
      />

      {mode === "one" && <SingleSend />}
      {mode === "many" && <BatchSend />}
      {mode === "recurring" && <RecurringSend />}

      <p className="mt-4 text-center text-xs opacity-40">
        Don&apos;t have funds yet?{" "}
        <Link href="/app/receive" className="text-agua/70 hover:text-agua">
          Fund your wallet →
        </Link>
      </p>
    </div>
  );
}
