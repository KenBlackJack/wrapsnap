import ScanClient from "./scan-client";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ScanClient token={token} />;
}
