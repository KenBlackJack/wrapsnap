import ScanClient from "./scan-client";

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const isAE = sp.ae === "1";
  return <ScanClient token={token} isAE={isAE} />;
}
