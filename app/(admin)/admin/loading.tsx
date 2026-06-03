import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

// Instant skeleton for any /admin/* navigation while server data loads.
export default function AdminLoading() {
  return <DashboardSkeleton />;
}
