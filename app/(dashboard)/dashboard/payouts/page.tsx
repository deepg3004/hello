import { redirect } from "next/navigation";

// Payouts have been retired (sellers receive funds directly via their own
// gateway). Route kept as a redirect so old links don't 404.
export default function PayoutsPage() {
  redirect("/dashboard");
}
