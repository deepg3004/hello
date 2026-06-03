import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

// Route-segment loading UI — shown instantly on navigation to any /dashboard/*
// page while its server component fetches data. Makes clicks feel responsive.
export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
