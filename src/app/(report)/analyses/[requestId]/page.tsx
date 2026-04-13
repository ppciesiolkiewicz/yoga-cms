import { redirect, notFound } from "next/navigation";
import { getRepo } from "@/lib/repo-server";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ requestId: string }>;
}

export default async function RequestRedirectPage({ params }: Params) {
  const { requestId } = await params;
  const repo = getRepo();

  let request;
  try {
    request = await repo.getRequest(requestId);
  } catch {
    notFound();
  }

  const firstSite = request.sites[0];
  if (!firstSite) notFound();

  redirect(`/analyses/${requestId}/${firstSite.id}`);
}
