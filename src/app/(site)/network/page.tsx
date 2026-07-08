import { NetworkHero } from "@/components/NetworkHero";
import { NetworkHow } from "@/components/NetworkHow";
import { WorkloadShowcase } from "@/components/WorkloadShowcase";
import { NetworkCustomers } from "@/components/NetworkCustomers";

export default function NetworkPage() {
  return (
    <>
      <NetworkHero />
      <WorkloadShowcase />
      <NetworkCustomers />
      <NetworkHow />
    </>
  );
}
