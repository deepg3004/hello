import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your InvoxAI account</CardTitle>
        <CardDescription>
          Start taking payments in minutes. No setup fee.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Signup form placeholder. Wire to Supabase auth next.
        </p>
      </CardContent>
    </Card>
  );
}
