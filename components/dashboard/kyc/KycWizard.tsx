"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Check,
  CreditCard,
  FileText,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";

import {
  aadhaarStartAction,
  aadhaarVerifyAction,
  submitBankVerificationAction,
  submitPanVerificationAction,
  uploadKycDocumentAction,
  type DocumentType,
} from "@/actions/kyc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface KycInitial {
  email: string;
  phone: string | null;
  emailConfirmed: boolean;
  kycLevel: number;
  panVerified: boolean;
  panName: string | null;
  bankVerified: boolean;
  bankHolderName: string | null;
  selfieUploaded: boolean;
  idUploaded: boolean;
  aadhaarVerified: boolean;
  gstUploaded: boolean;
  status: "pending" | "approved" | "rejected" | "under_review";
  rejectionReason: string | null;
  riskFlags: string[];
}

interface KycWizardProps {
  initial: KycInitial;
}

export function KycWizard({ initial }: KycWizardProps) {
  return (
    <div className="space-y-6">
      <OverallStatus initial={initial} />
      <Level1Card initial={initial} />
      <Level2Card initial={initial} />
      <Level3Card initial={initial} />
    </div>
  );
}

// ============================================================================
// Top summary
// ============================================================================

function OverallStatus({ initial }: { initial: KycInitial }) {
  if (initial.status === "rejected") {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            KYC rejected
          </CardTitle>
          <CardDescription>
            {initial.rejectionReason ?? "Please re-submit the items below."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (initial.status === "under_review") {
    return (
      <Card className="border-amber-300 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-amber-900">
            <RefreshCcw className="h-4 w-4" /> Under review
          </CardTitle>
          <CardDescription className="text-amber-900">
            We&apos;ve received your details and they&apos;re being checked by our team.
            {initial.riskFlags.length > 0 && (
              <> Flags: {initial.riskFlags.join(", ")}</>
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (initial.kycLevel >= 2) {
    return (
      <Card className="border-emerald-300 bg-emerald-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-emerald-900">
            <ShieldCheck className="h-4 w-4" /> KYC level {initial.kycLevel} — payouts enabled
          </CardTitle>
          <CardDescription className="text-emerald-900">
            You&apos;re fully verified. Payouts can be requested from the Payouts page.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return null;
}

// ============================================================================
// Level 1
// ============================================================================

function Level1Card({ initial }: { initial: KycInitial }) {
  const emailOk = initial.emailConfirmed;
  const phoneOk = !!initial.phone;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Level 1 — Basics</span>
          {emailOk && phoneOk ? (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <Check className="mr-1 h-3 w-3" /> Done
            </Badge>
          ) : (
            <Badge variant="outline">In progress</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Set automatically when you sign up + confirm your email.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="Email confirmed" ok={emailOk} value={initial.email} />
        <Row label="Phone on file" ok={phoneOk} value={initial.phone ?? "—"} />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Level 2
// ============================================================================

function Level2Card({ initial }: { initial: KycInitial }) {
  const allDone = initial.panVerified && initial.bankVerified && initial.selfieUploaded;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Level 2 — Standard (required for payouts)</span>
          {allDone ? (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <Check className="mr-1 h-3 w-3" /> Done
            </Badge>
          ) : (
            <Badge variant="outline">3 items</Badge>
          )}
        </CardTitle>
        <CardDescription>
          PAN + bank account + selfie. Verified live with Surepass.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <PanForm initial={initial} />
        <BankForm initial={initial} />
        <SelfieUpload initial={initial} />
      </CardContent>
    </Card>
  );
}

// ----- PAN -------------------------------------------------------------------

function PanForm({ initial }: { initial: KycInitial }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pan, setPan] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pan) return;
    setBusy(true);
    const r = await submitPanVerificationAction(pan);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "PAN verification failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "PAN verified", description: r.message });
    setPan("");
    router.refresh();
  }

  if (initial.panVerified && initial.panName) {
    return (
      <DoneRow
        title="PAN verified"
        icon={<CreditCard className="h-4 w-4" />}
        description={`Holder: ${initial.panName}`}
      />
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <CreditCard className="h-4 w-4" /> PAN verification
      </div>
      <div className="flex gap-2">
        <Input
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase())}
          placeholder="ABCDE1234F"
          maxLength={10}
          className="font-mono uppercase"
        />
        <Button onClick={submit} disabled={busy || pan.length !== 10}>
          {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Verify
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).
      </p>
    </div>
  );
}

// ----- Bank ------------------------------------------------------------------

function BankForm({ initial }: { initial: KycInitial }) {
  const router = useRouter();
  const { toast } = useToast();
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const r = await submitBankVerificationAction(account, ifsc);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Bank verification failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Bank checked", description: r.message });
    setAccount("");
    setIfsc("");
    router.refresh();
  }

  if (initial.bankVerified && initial.bankHolderName) {
    return (
      <DoneRow
        title="Bank verified"
        icon={<ShieldCheck className="h-4 w-4" />}
        description={`Holder: ${initial.bankHolderName}`}
      />
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="h-4 w-4" /> Bank account verification
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <Label className="text-xs">Account number</Label>
          <Input
            value={account}
            onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))}
            placeholder="123456789012"
            className="font-mono"
          />
        </div>
        <div>
          <Label className="text-xs">IFSC code</Label>
          <Input
            value={ifsc}
            onChange={(e) => setIfsc(e.target.value.toUpperCase())}
            placeholder="HDFC0001234"
            maxLength={11}
            className="font-mono uppercase"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        We&apos;ll send ₹1 (penny drop) to confirm the account holder name matches your PAN.
      </p>
      <Button onClick={submit} disabled={busy || !account || ifsc.length !== 11} className="mt-2">
        {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
        Verify
      </Button>
    </div>
  );
}

// ----- Selfie ----------------------------------------------------------------

function SelfieUpload({ initial }: { initial: KycInitial }) {
  return (
    <DocumentUpload
      icon={<Camera className="h-4 w-4" />}
      title="Selfie photo"
      description="A clear photo of your face. PNG / JPEG up to 20 MB."
      documentType="selfie"
      done={initial.selfieUploaded}
      accept="image/png,image/jpeg,image/webp"
    />
  );
}

// ============================================================================
// Level 3
// ============================================================================

function Level3Card({ initial }: { initial: KycInitial }) {
  if (initial.kycLevel < 2) return null; // gate behind Level 2

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Level 3 — Advanced (high-volume sellers)</span>
          <Badge variant="outline">Optional</Badge>
        </CardTitle>
        <CardDescription>
          Required once you cross ₹1L/month in sales. Lowers your platform commission.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AadhaarFlow initial={initial} />
        <DocumentUpload
          icon={<FileText className="h-4 w-4" />}
          title="GST certificate"
          description="Upload your GST registration certificate. PDF / PNG / JPEG."
          documentType="gst_certificate"
          done={initial.gstUploaded}
          accept=".pdf,image/png,image/jpeg,image/webp"
        />
        <DocumentUpload
          icon={<FileText className="h-4 w-4" />}
          title="Business registration (optional)"
          description="LLP / Pvt Ltd / Partnership deed if applicable."
          documentType="business_registration"
          done={false}
          accept=".pdf,image/png,image/jpeg,image/webp"
        />
      </CardContent>
    </Card>
  );
}

function AadhaarFlow({ initial }: { initial: KycInitial }) {
  const router = useRouter();
  const { toast } = useToast();
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"start" | "otp">("start");
  const [busy, setBusy] = useState(false);

  if (initial.aadhaarVerified) {
    return (
      <DoneRow
        title="Aadhaar verified"
        icon={<ShieldCheck className="h-4 w-4" />}
        description="Live e-KYC confirmed."
      />
    );
  }

  async function start() {
    setBusy(true);
    const r = await aadhaarStartAction(aadhaar);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't send OTP", description: r.message, variant: "destructive" });
      return;
    }
    setStage("otp");
    toast({ title: "OTP sent", description: "Check your phone for the Aadhaar OTP." });
  }

  async function verify() {
    setBusy(true);
    const r = await aadhaarVerifyAction(otp);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "OTP verification failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Aadhaar verified" });
    setOtp("");
    setAadhaar("");
    setStage("start");
    router.refresh();
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="h-4 w-4" /> Aadhaar (OTP)
      </div>
      {stage === "start" ? (
        <>
          <Label className="text-xs">Aadhaar number</Label>
          <div className="flex gap-2">
            <Input
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))}
              placeholder="12-digit Aadhaar"
              maxLength={12}
              className="font-mono"
            />
            <Button onClick={start} disabled={busy || aadhaar.length !== 12}>
              {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Send OTP
            </Button>
          </div>
        </>
      ) : (
        <>
          <Label className="text-xs">OTP from SMS</Label>
          <div className="flex gap-2">
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit OTP"
              maxLength={8}
              className="font-mono"
            />
            <Button onClick={verify} disabled={busy || otp.length < 4}>
              {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Verify
            </Button>
            <Button variant="ghost" onClick={() => setStage("start")} disabled={busy}>
              Back
            </Button>
          </div>
        </>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Aadhaar is processed by Surepass via UIDAI&apos;s eKYC API. We store only the
        last 4 digits.
      </p>
    </div>
  );
}

// ============================================================================
// Shared sub-components
// ============================================================================

function Row({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full",
            ok ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
          )}
        >
          {ok ? <Check className="h-3 w-3" /> : "·"}
        </span>
        <span>{label}</span>
      </div>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

function DoneRow({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-emerald-50 p-3 text-sm">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-medium text-emerald-900">{title}</div>
        <div className="text-xs text-emerald-800">{description}</div>
      </div>
      <Check className="h-4 w-4 text-emerald-700" />
    </div>
  );
}

function DocumentUpload({
  icon,
  title,
  description,
  documentType,
  done,
  accept,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  documentType: DocumentType;
  done: boolean;
  accept: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (done) {
    return <DoneRow title={title} icon={icon} description="Uploaded" />;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("documentType", documentType);
    fd.append("file", f);
    const r = await uploadKycDocumentAction(fd);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!r.ok) {
      toast({ title: "Upload failed", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: `${title} uploaded` });
    router.refresh();
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {icon} {title}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{description}</p>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onFile} />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Upload
      </Button>
    </div>
  );
}
