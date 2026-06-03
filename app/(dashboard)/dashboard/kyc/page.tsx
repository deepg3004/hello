import { redirect } from "next/navigation";

// KYC has been retired (sellers connect their own gateway; the platform no
// longer holds funds). Route kept as a redirect so old links don't 404.
export default function KycPage() {
  redirect("/dashboard");
}
