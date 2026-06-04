"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Loader2, Zap } from "lucide-react";

import { signUpAction } from "@/actions/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z
  .object({
    fullName: z.string().min(2, "Tell us your full name"),
    email: z.string().email("Enter a valid email address"),
    phone: z
      .string()
      .trim()
      .min(8, "Enter a valid phone number")
      .max(20, "Phone number is too long"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirm: z.string(),
    terms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the Terms of Service" }),
    }),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirm: "",
      terms: false as unknown as true, // schema validates the literal
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await signUpAction({
      email: values.email,
      password: values.password,
      fullName: values.fullName,
      phone: values.phone,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast({
        title: "Couldn't create your account",
        description: result.message ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }

    if (result.needsEmailConfirmation) {
      setSentEmail(values.email);
      return;
    }

    // Email confirmation disabled — go straight to onboarding (phone
    // verification is no longer a required step).
    window.location.href = "/dashboard/onboarding";
  }

  if (sentEmail) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            We sent a confirmation link to <strong>{sentEmail}</strong>. Click it
            to verify your email and finish setting up your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button
            type="button"
            className="text-foreground underline"
            onClick={() => setSentEmail(null)}
          >
            try a different email
          </button>
          .
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass shadow-card-lg">
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
          <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
        </span>
        <CardTitle className="font-sora text-xl">Create your InvoxAI account</CardTitle>
        <CardDescription>
          Start taking payments in minutes. No setup fee.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      autoComplete="tel"
                      placeholder="+91 98765 43210"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="terms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value as unknown as boolean}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="!mt-0 font-normal">
                      I agree to the{" "}
                      <Link href="/terms" className="underline">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="underline">
                        Privacy Policy
                      </Link>
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
