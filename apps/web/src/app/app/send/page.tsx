"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { BatchSend } from "@/components/send/batch-send";
import { RecurringSend } from "@/components/send/recurring-send";
import { SingleSend } from "@/components/send/single-send";
import { Segmented } from "@/components/ui/segmented";
import { useWallet } from "@/lib/wallet";
import { useT } from "@/lib/i18n";

type Mode = "one" | "many" | "recurring";

export default function SendPage() {
  const { address } = useWallet();
  const t = useT();
  const [mode, setMode] = useState<Mode>("one");

  if (!address) return null;

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <PageHeader
        eyebrow={t.send.eyebrow}
        title={t.send.title}
        subtitle={t.send.subtitle}
      />

      <Segmented
        className="mb-4"
        value={mode}
        onChange={setMode}
        options={[
          { value: "one", label: t.send.modeOne },
          { value: "many", label: t.send.modeMany },
          { value: "recurring", label: t.send.modeRecurring },
        ]}
      />

      {mode === "one" && <SingleSend />}
      {mode === "many" && <BatchSend />}
      {mode === "recurring" && <RecurringSend />}

      <p className="mt-4 text-center text-xs opacity-40">
        {t.send.noFunds}{" "}
        <Link href="/app/receive" className="text-agua/70 hover:text-agua">
          {t.send.fundWallet}
        </Link>
      </p>
    </div>
  );
}
