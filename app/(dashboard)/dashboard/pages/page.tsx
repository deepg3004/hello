import { redirect } from "next/navigation";

export const metadata = { title: "Pages" };

// "All Pages" was removed as a tab — the Pages area now opens on the first
// category (Payment). Payment / Landing / Leads are the only three tabs.
export default function PagesListPage() {
  redirect("/dashboard/pages/payment");
}
