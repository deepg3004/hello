"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CreditCard,
  FileText,
  Link2 as LinkIcon,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Upload,
  User2,
} from "lucide-react";

import {
  aadhaarStartAction,
  aadhaarVerifyAction,
  resetMyKycAction,
  setKycDocumentUrlAction,
  submitBankVerificationAction,
  submitManualKycAction,
  submitPanVerificationAction,
  uploadKycDocumentAction,
  type DocumentType,
} from "@/actions/kyc";
import { updatePhoneAction } from "@/actions/profile";
import { Button } from "@/components/ui/button";
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
  /** Manual-submission document slots (migration 036). */
  manualDocs: {
    panFront: boolean;
    panBack: boolean;
    aadhaarFront: boolean;
    aadhaarBack: boolean;
    bankStatement: boolean;
    cancelCheque: boolean;
  };
  aadhaarOnFile: boolean;
}

interface KycWizardProps {
  initial: KycInitial;
}

type StepKey = "basics" | "standard" | "advanced";

interface Step {
  key: StepKey;
  title: string;
  subtitle: string;
  done: boolean;
  available: boolean;
}

export function KycWizard({ initial }: KycWizardProps) {
  const basicsDone = initial.emailConfirmed && !!initial.phone;
  const standardDone =
    initial.panVerified && initial.bankVerified && initial.selfieUploaded;
  const advancedDone =
    initial.aadhaarVerified && initial.gstUploaded;

  const steps: Step[] = [
    {
      key: "basics",
      title: "Basics",
      subtitle: "Email + phone confirmation",
      done: basicsDone,
      available: true,
    },
    {
      key: "standard",
      title: "Standard",
      subtitle: "PAN · Bank · Selfie — required for payouts",
      done: standardDone,
      available: basicsDone,
    },
    {
      key: "advanced",
      title: "Advanced",
      subtitle: "Aadhaar + GST — optional, lower commission",
      done: advancedDone,
      available: standardDone,
    },
  ];

  // Pick the first unfinished step as the default active. If everything's
  // done, land on the last one so the user lands on something meaningful.
  const firstPending = steps.find((s) => !s.done && s.available) ?? steps[steps.length - 1]!;
  const [active, setActive] = useState<StepKey>(firstPending.key);

  return (
    <div className="space-y-5">
      {/* Top-level status banner (rejected / under-review / approved) */}
      <OverallStatus initial={initial} />

      {/* Start-over — only before approval, so a seller can clear a stuck or
          mistaken submission and re-do it. */}
      {initial.kycLevel < 2 && <ResetKycButton />}

      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
        {/* ── Vertical stepper (desktop) / horizontal tabs (mobile) ── */}
        <Stepper steps={steps} active={active} onPick={setActive} />

        {/* ── Active step content ──────────────────────────────────── */}
        <div key={active} className="min-w-0 animate-in-up">
          {active === "basics" && <BasicsStep initial={initial} />}
          {active === "standard" && <StandardStep initial={initial} />}
          {active === "advanced" && <AdvancedStep initial={initial} />}
        </div>
      </div>
    </div>
  );
}

// ── Start-over (reset my KYC) ───────────────────────────────────────────
function ResetKycButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function reset() {
    if (!confirm("Clear your current KYC details and start over?")) return;
    setBusy(true);
    const r = await resetMyKycAction();
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't reset", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "KYC reset", description: "Start fresh below." });
    router.refresh();
  }

  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="sm" onClick={reset} disabled={busy} className="text-muted-foreground">
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
        Start over
      </Button>
    </div>
  );
}

// ── Status banner (rejected / under review / approved) ──────────────────

function OverallStatus({ initial }: { initial: KycInitial }) {
  if (initial.status === "rejected") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">KYC rejected</p>
          <p className="mt-0.5">
            {initial.rejectionReason ??
              "Please re-submit the items below — see the highlighted fields."}
          </p>
        </div>
      </div>
    );
  }
  // (Reached only after the rejected-status check above returns.)
  const awaitingManual =
    initial.riskFlags.includes("manual_submission") &&
    initial.status !== "approved" &&
    initial.kycLevel < 2;
  if (initial.status === "under_review" || awaitingManual) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <RefreshCcw className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">
            Document under review — usually 24–48 hours
          </p>
          <p className="mt-0.5">
            We&apos;ve received your details and our team is checking them.
            You&apos;ll receive an email the moment we&apos;re done.
            {initial.riskFlags.length > 0 && (
              <> Flags: {initial.riskFlags.join(", ")}.</>
            )}
          </p>
        </div>
      </div>
    );
  }
  if (initial.kycLevel >= 2) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">
            KYC level {initial.kycLevel} — payouts enabled
          </p>
          <p className="mt-0.5">
            You&apos;re fully verified. Payouts can be requested from the
            Payouts page.
          </p>
        </div>
      </div>
    );
  }
  return null;
}

// ── Stepper ────────────────────────────────────────────────────────────

function Stepper({
  steps,
  active,
  onPick,
}: {
  steps: Step[];
  active: StepKey;
  onPick: (k: StepKey) => void;
}) {
  return (
    <nav aria-label="KYC steps">
      {/* Mobile: horizontal pill row */}
      <ol className="flex gap-2 overflow-x-auto pb-2 md:hidden">
        {steps.map((s, i) => (
          <li key={s.key} className="shrink-0">
            <button
              type="button"
              onClick={() => s.available && onPick(s.key)}
              disabled={!s.available}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active === s.key
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : s.done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : s.available
                      ? "border-border bg-card text-foreground"
                      : "border-border bg-muted text-muted-foreground",
              )}
            >
              <StepNumber index={i + 1} done={s.done} active={active === s.key} />
              {s.title}
            </button>
          </li>
        ))}
      </ol>

      {/* Desktop: vertical stepper */}
      <ol className="relative hidden md:block">
        {/* Trail line connecting circles */}
        <span
          aria-hidden
          className="absolute left-[15px] top-4 bottom-4 w-px bg-border"
        />
        {steps.map((s, i) => {
          const isActive = active === s.key;
          return (
            <li key={s.key} className="relative pl-12 pb-6 last:pb-0">
              <button
                type="button"
                onClick={() => s.available && onPick(s.key)}
                disabled={!s.available}
                className={cn(
                  "absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 transition",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-indigo-500/20"
                    : s.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : s.available
                        ? "border-border bg-card text-muted-foreground"
                        : "border-border bg-muted text-muted-foreground/50",
                )}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title}`}
              >
                {s.done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="text-xs font-semibold">{i + 1}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => s.available && onPick(s.key)}
                disabled={!s.available}
                className={cn(
                  "block text-left transition",
                  !s.available && "cursor-not-allowed opacity-50",
                )}
              >
                <p
                  className={cn(
                    "font-sora text-sm font-semibold",
                    isActive ? "text-foreground" : "text-foreground/80",
                  )}
                >
                  {s.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.subtitle}
                </p>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepNumber({
  index,
  done,
  active,
}: {
  index: number;
  done: boolean;
  active: boolean;
}) {
  if (done) return <Check className="h-3 w-3" />;
  return (
    <span
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
        active ? "bg-white/25 text-white" : "bg-foreground/10",
      )}
    >
      {index}
    </span>
  );
}

// ── Step bodies ────────────────────────────────────────────────────────

function BasicsStep({ initial }: { initial: KycInitial }) {
  const router = useRouter();
  const { toast } = useToast();
  const emailOk = initial.emailConfirmed;
  const phoneOk = !!initial.phone;
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [busy, setBusy] = useState(false);

  async function savePhone() {
    setBusy(true);
    const r = await updatePhoneAction(phone);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't save phone", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Phone saved" });
    router.refresh();
  }

  return (
    <SectionCard
      icon={User2}
      title="Basics"
      subtitle="Confirm your email and add a contact phone number."
      status={emailOk && phoneOk ? "verified" : "required"}
    >
      <Row label="Email confirmed" ok={emailOk} value={initial.email} />
      {phoneOk ? (
        <Row label="Phone on file" ok value={initial.phone ?? "—"} />
      ) : (
        <div className="space-y-1.5 pt-1">
          <Label className="text-xs">Phone number</Label>
          <div className="flex gap-2">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              inputMode="tel"
            />
            <PrimaryButton onClick={savePhone} disabled={busy || phone.trim().length < 6} busy={busy}>
              Save
            </PrimaryButton>
          </div>
          <p className="text-xs text-muted-foreground">
            Required before you can start the Standard step.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function StandardStep({ initial }: { initial: KycInitial }) {
  return (
    <div className="space-y-4">
      <PanForm initial={initial} />
      <BankForm initial={initial} />
      <SelfieUpload initial={initial} />
    </div>
  );
}

function AdvancedStep({ initial }: { initial: KycInitial }) {
  if (initial.kycLevel < 2) {
    return (
      <SectionCard
        icon={ShieldCheck}
        title="Finish Standard first"
        subtitle="Advanced KYC unlocks once Standard (PAN + Bank + Selfie) is complete."
        status="required"
      >
        <p className="text-sm text-muted-foreground">
          Once Standard is verified, return here to add Aadhaar e-KYC and your
          GST certificate. These lower your platform commission and let you
          take higher monthly volumes.
        </p>
      </SectionCard>
    );
  }
  return (
    <div className="space-y-4">
      <AadhaarFlow initial={initial} />
      <DocumentUpload
        icon={FileText}
        title="GST certificate"
        description="Your GST registration certificate. PDF / PNG / JPEG."
        documentType="gst_certificate"
        done={initial.gstUploaded}
        accept=".pdf,image/png,image/jpeg,image/webp"
      />
      <DocumentUpload
        icon={FileText}
        title="Business registration (optional)"
        description="LLP / Pvt Ltd / Partnership deed if applicable."
        documentType="business_registration"
        done={false}
        accept=".pdf,image/png,image/jpeg,image/webp"
      />
    </div>
  );
}

// ── Verification cards ─────────────────────────────────────────────────

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
      toast({
        title: "PAN verification failed",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "PAN verified", description: r.message });
    setPan("");
    router.refresh();
  }

  return (
    <SectionCard
      icon={CreditCard}
      title="PAN verification"
      subtitle={
        initial.panVerified && initial.panName
          ? `Holder name: ${initial.panName}`
          : "Verified live via Surepass — no manual review."
      }
      status={initial.panVerified ? "verified" : "required"}
    >
      {initial.panVerified ? (
        <VerifiedInput value={initial.panName ?? "PAN on file"} />
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">PAN number</Label>
            <Input
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              maxLength={10}
              className="font-mono uppercase"
            />
            <p className="text-xs text-muted-foreground">
              5 letters + 4 digits + 1 letter
            </p>
          </div>
          <PrimaryButton
            onClick={submit}
            disabled={busy || pan.length !== 10}
            busy={busy}
          >
            Verify PAN
          </PrimaryButton>

          <ManualKycForm initial={initial} />
        </>
      )}
    </SectionCard>
  );
}

/**
 * Fallback when instant verification is unavailable (e.g. Surepass not
 * configured) or keeps failing. Collects PAN + bank details and queues the
 * whole thing for manual admin review — no automated checks are run.
 */
function ManualKycForm({ initial }: { initial: KycInitial }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pan, setPan] = useState("");
  const [panName, setPanName] = useState(initial.panName ?? "");
  const [aadhaar, setAadhaar] = useState("");
  const [account, setAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [holder, setHolder] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const r = await submitManualKycAction({
      pan_number: pan,
      pan_name: panName,
      aadhaar_number: aadhaar,
      account_number: account,
      ifsc,
      bank_holder_name: holder,
    });
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't submit", description: r.message, variant: "destructive" });
      return;
    }
    toast({ title: "Submitted for review", description: r.message });
    router.refresh();
  }

  // Once a manual submission is in, don't keep offering the form — show status.
  const alreadySubmitted =
    initial.status === "under_review" ||
    initial.riskFlags.includes("manual_submission");
  if (alreadySubmitted) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <RefreshCcw className="h-3.5 w-3.5 shrink-0" />
        Submitted for manual review — our team is verifying your details.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-left text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        Can&apos;t verify automatically? Submit for manual review →
      </button>
    );
  }

  const valid =
    pan.length === 10 && panName.trim() && account.length >= 6 && ifsc.length === 11 && holder.trim();

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
      <p className="text-xs text-muted-foreground">
        Enter your details exactly as on your PAN card and bank passbook. Our team
        verifies manually within 1–2 business days.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">PAN number</Label>
          <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} className="font-mono uppercase" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Name on PAN</Label>
          <Input value={panName} onChange={(e) => setPanName(e.target.value)} placeholder="As printed on PAN" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Aadhaar number (optional)</Label>
          <Input value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="12-digit Aadhaar" maxLength={12} className="font-mono" inputMode="numeric" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bank account number</Label>
          <Input value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))} placeholder="123456789012" className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">IFSC code</Label>
          <Input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" maxLength={11} className="font-mono uppercase" />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs">Account holder name</Label>
          <Input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="As per bank records" />
        </div>
      </div>

      {/* Document images for manual review */}
      <div className="space-y-2 border-t border-border pt-3">
        <p className="text-xs font-medium text-foreground">Upload supporting images</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <MiniUpload label="PAN — front" documentType="pan_front" done={initial.manualDocs.panFront} />
          <MiniUpload label="PAN — back" documentType="pan_back" done={initial.manualDocs.panBack} />
          <MiniUpload label="Aadhaar — front" documentType="aadhaar_front" done={initial.manualDocs.aadhaarFront} />
          <MiniUpload label="Aadhaar — back" documentType="aadhaar_back" done={initial.manualDocs.aadhaarBack} />
          <MiniUpload label="Bank statement" documentType="bank_statement" done={initial.manualDocs.bankStatement} />
          <MiniUpload label="Cancelled cheque" documentType="cancel_cheque" done={initial.manualDocs.cancelCheque} />
        </div>
      </div>

      <PrimaryButton onClick={submit} disabled={busy || !valid} busy={busy}>
        Submit for manual review
      </PrimaryButton>
    </div>
  );
}

/** Compact single-file uploader for the manual KYC document slots. */
function MiniUpload({
  label,
  documentType,
  done,
}: {
  label: string;
  documentType: DocumentType;
  done: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(done);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("documentType", documentType);
    fd.append("file", f);
    const r = await uploadKycDocumentAction(fd);
    setBusy(false);
    if (ref.current) ref.current.value = "";
    if (!r.ok) {
      toast({ title: "Upload failed", description: r.message, variant: "destructive" });
      return;
    }
    setUploaded(true);
    toast({ title: `${label} uploaded` });
    router.refresh();
  }

  async function pasteUrl() {
    const url = window.prompt(`Paste an image URL for "${label}"`);
    if (!url) return;
    setBusy(true);
    const r = await setKycDocumentUrlAction(documentType, url);
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Couldn't save URL", description: r.message, variant: "destructive" });
      return;
    }
    setUploaded(true);
    toast({ title: `${label} saved` });
    router.refresh();
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition",
        uploaded
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-border bg-card",
      )}
    >
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-1.5">
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : uploaded ? (
          <Check className="h-3.5 w-3.5" />
        ) : null}
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="rounded p-1 hover:bg-muted" title="Upload file">
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button type="button" onClick={pasteUrl} disabled={busy} className="rounded p-1 hover:bg-muted" title="Paste image URL">
          <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </span>
    </div>
  );
}

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
      toast({
        title: "Bank verification failed",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Bank checked", description: r.message });
    setAccount("");
    setIfsc("");
    router.refresh();
  }

  return (
    <SectionCard
      icon={ShieldCheck}
      title="Bank account"
      subtitle={
        initial.bankVerified && initial.bankHolderName
          ? `Holder name: ${initial.bankHolderName}`
          : "Penny-drop of ₹1 confirms the account holder name matches your PAN."
      }
      status={initial.bankVerified ? "verified" : "required"}
    >
      {initial.bankVerified ? (
        <VerifiedInput value={initial.bankHolderName ?? "Account on file"} />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Account number</Label>
              <Input
                value={account}
                onChange={(e) =>
                  setAccount(e.target.value.replace(/\D/g, ""))
                }
                placeholder="123456789012"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
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
          <PrimaryButton
            onClick={submit}
            disabled={busy || !account || ifsc.length !== 11}
            busy={busy}
          >
            Verify bank account
          </PrimaryButton>
        </>
      )}
    </SectionCard>
  );
}

function SelfieUpload({ initial }: { initial: KycInitial }) {
  return (
    <DocumentUpload
      icon={Camera}
      title="Selfie photo"
      description="A clear photo of your face. PNG / JPEG up to 20 MB."
      documentType="selfie"
      done={initial.selfieUploaded}
      accept="image/png,image/jpeg,image/webp"
    />
  );
}

function AadhaarFlow({ initial }: { initial: KycInitial }) {
  const router = useRouter();
  const { toast } = useToast();
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"start" | "otp">("start");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const r = await aadhaarStartAction(aadhaar);
    setBusy(false);
    if (!r.ok) {
      toast({
        title: "Couldn't send OTP",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    setStage("otp");
    toast({
      title: "OTP sent",
      description: "Check your phone for the Aadhaar OTP.",
    });
  }

  async function verify() {
    setBusy(true);
    const r = await aadhaarVerifyAction(otp);
    setBusy(false);
    if (!r.ok) {
      toast({
        title: "OTP verification failed",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Aadhaar verified" });
    setOtp("");
    setAadhaar("");
    setStage("start");
    router.refresh();
  }

  return (
    <SectionCard
      icon={ShieldCheck}
      title="Aadhaar (OTP)"
      subtitle="UIDAI eKYC via Surepass. We store only the last 4 digits."
      status={initial.aadhaarVerified ? "verified" : "required"}
    >
      {initial.aadhaarVerified ? (
        <VerifiedInput value="Aadhaar verified" />
      ) : stage === "start" ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Aadhaar number</Label>
            <Input
              value={aadhaar}
              onChange={(e) =>
                setAadhaar(e.target.value.replace(/\D/g, ""))
              }
              placeholder="12-digit Aadhaar"
              maxLength={12}
              className="font-mono"
            />
          </div>
          <PrimaryButton
            onClick={start}
            disabled={busy || aadhaar.length !== 12}
            busy={busy}
          >
            Send OTP
          </PrimaryButton>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">OTP from SMS</Label>
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit OTP"
              maxLength={8}
              className="font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <PrimaryButton
              onClick={verify}
              disabled={busy || otp.length < 4}
              busy={busy}
            >
              Verify OTP
            </PrimaryButton>
            <Button
              variant="ghost"
              onClick={() => setStage("start")}
              disabled={busy}
            >
              Back
            </Button>
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────

type SectionStatus = "verified" | "required" | "review";

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  status,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  status: SectionStatus;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100/60 text-indigo-600 ring-1 ring-inset ring-indigo-200/70 dark:from-indigo-500/15 dark:to-indigo-500/5 dark:text-indigo-300 dark:ring-indigo-500/30">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="font-sora text-base font-semibold tracking-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <StatusPill status={status} />
      </header>

      <div className="space-y-3">{children}</div>
    </section>
  );
}

function StatusPill({ status }: { status: SectionStatus }) {
  if (status === "verified") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        <Check className="h-3 w-3" />
        Verified
      </span>
    );
  }
  if (status === "review") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        <RefreshCcw className="h-3 w-3" />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
      Required
    </span>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="w-full sm:w-auto"
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <ArrowRight className="mr-2 h-4 w-4" />
      )}
      {children}
    </Button>
  );
}

function Row({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full",
            ok
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {ok ? <Check className="h-3 w-3" /> : <span className="text-xs">·</span>}
        </span>
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

/**
 * Disabled input with a green checkmark overlay — used for fields that
 * are already verified (PAN holder name, bank holder name, etc).
 */
function VerifiedInput({ value }: { value: string }) {
  return (
    <div className="relative">
      <Input
        value={value}
        disabled
        readOnly
        className="bg-emerald-50/40 pr-9 font-medium text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"
      />
      <Check
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600 dark:text-emerald-300"
        aria-hidden
      />
    </div>
  );
}

function DocumentUpload({
  icon: Icon,
  title,
  description,
  documentType,
  done,
  accept,
}: {
  icon: React.ComponentType<{ className?: string }>;
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
      toast({
        title: "Upload failed",
        description: r.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: `${title} uploaded` });
    router.refresh();
  }

  return (
    <SectionCard
      icon={Icon}
      title={title}
      subtitle={description}
      status={done ? "verified" : "required"}
    >
      {done ? (
        <VerifiedInput value="Document uploaded" />
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={onFile}
          />
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload {title.toLowerCase()}
          </Button>
        </>
      )}
    </SectionCard>
  );
}
