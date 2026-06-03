import { redirect } from "next/navigation";

// KYC review queue retired. Route kept as a redirect so old links don't 404.
export default function AdminKycPage() {
  redirect("/admin");
}
