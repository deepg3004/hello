import { CategoryDashboardRoute } from "@/components/dashboard/pages/CategoryDashboardRoute";

export const metadata = { title: "Landing Pages" };

export default function LandingPagesPage() {
  return <CategoryDashboardRoute categoryKey="landing" />;
}
