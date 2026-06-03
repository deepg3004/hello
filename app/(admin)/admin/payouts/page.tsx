import { redirect } from "next/navigation";

// Payouts queue retired. Route kept as a redirect so old links don't 404.
export default function AdminPayoutsPage() {
  redirect("/admin");
}
