import { getBranding } from "@/lib/settings";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { LandingHero } from "@/components/marketing/LandingHero";
import { LandingFeatures } from "@/components/marketing/LandingFeatures";
import { LandingPricing } from "@/components/marketing/LandingPricing";
import { LandingCTA } from "@/components/marketing/LandingCTA";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default async function HomePage() {
  const branding = await getBranding();
  const { name, logoUrl } = branding;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingNav name={name} logoUrl={logoUrl} />
      <main className="flex-1">
        <LandingHero name={name} />
        <LandingFeatures />
        <LandingPricing />
        <LandingCTA name={name} />
      </main>
      <MarketingFooter name={name} logoUrl={logoUrl} />
    </div>
  );
}
