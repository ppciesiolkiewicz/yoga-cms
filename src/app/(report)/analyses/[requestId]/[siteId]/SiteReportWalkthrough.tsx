"use client";

import { useMemo } from "react";
import { Walkthrough, WalkthroughButton } from "@/components/Walkthrough";
import { makeSiteTour } from "./walkthrough";

type Props = {
  requestId: string;
  siteId: string;
};

export function SiteReportWalkthrough({ requestId, siteId }: Props) {
  const tour = useMemo(() => makeSiteTour({ requestId, siteId }), [requestId, siteId]);
  return (
    <>
      <Walkthrough tour={tour} />
      <WalkthroughButton tour={tour} />
    </>
  );
}
