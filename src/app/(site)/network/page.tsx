import { NetworkHero } from "@/components/NetworkHero";
import { NetworkHow } from "@/components/NetworkHow";
import { WorkloadShowcase } from "@/components/WorkloadShowcase";
import { NetworkCustomers } from "@/components/NetworkCustomers";
import { LiveGpuPrices } from "@/components/LiveGpuPrices";

export default function NetworkPage() {
  return (
    <>
      <NetworkHero />
      <LiveGpuPrices />
      <NetworkHow />
      <WorkloadShowcase />
      <NetworkCustomers />
    </>
  );
}
