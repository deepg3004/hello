import { CategoryDashboardRoute } from "@/components/dashboard/pages/CategoryDashboardRoute";

export const metadata = { title: "Payment Pages" };

export default function PaymentPagesPage() {
  return <CategoryDashboardRoute categoryKey="payment" />;
}
