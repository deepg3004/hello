import { CategoryDashboardRoute } from "@/components/dashboard/pages/CategoryDashboardRoute";

export const metadata = { title: "Lead Pages" };

export default function LeadPagesPage() {
  return <CategoryDashboardRoute categoryKey="leads" />;
}
