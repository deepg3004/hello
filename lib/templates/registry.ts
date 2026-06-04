import { courseTemplate } from "./payment/course";
import { coachingTemplate } from "./payment/coaching";
import { digitalProductTemplate } from "./payment/digital-product";
import { membershipTemplate } from "./payment/membership";
import { ebookTemplate } from "./payment/ebook";
import { serviceTemplate } from "./payment/service";
import { bundleTemplate } from "./payment/bundle";
import { pwylTemplate } from "./payment/pwyl";
import { lockContentTemplate } from "./payment/lock-content";
import { webinarTemplate } from "./landing/webinar";
import { freebieTemplate } from "./landing/freebie";
import { productLaunchTemplate } from "./landing/product-launch";
import { salesPromoTemplate } from "./landing/sales-promo";
import { saasTemplate } from "./landing/saas";
import { appDownloadTemplate } from "./landing/app-download";
import { newsletterTemplate } from "./landing/newsletter";
import { checklistTemplate } from "./landing/checklist";
import { waitlistTemplate } from "./landing/waitlist";
import { casestudyTemplate } from "./landing/casestudy";
import { customTemplate } from "./custom";
import { telegramVipTemplate } from "./telegram/vip";
import type { Template, PageDbType } from "./types";

export const TEMPLATES: Record<string, Template> = {
  [courseTemplate.definition.id]: courseTemplate,
  [coachingTemplate.definition.id]: coachingTemplate,
  [digitalProductTemplate.definition.id]: digitalProductTemplate,
  [membershipTemplate.definition.id]: membershipTemplate,
  [ebookTemplate.definition.id]: ebookTemplate,
  [serviceTemplate.definition.id]: serviceTemplate,
  [bundleTemplate.definition.id]: bundleTemplate,
  [pwylTemplate.definition.id]: pwylTemplate,
  [lockContentTemplate.definition.id]: lockContentTemplate,
  [webinarTemplate.definition.id]: webinarTemplate,
  [freebieTemplate.definition.id]: freebieTemplate,
  [productLaunchTemplate.definition.id]: productLaunchTemplate,
  [salesPromoTemplate.definition.id]: salesPromoTemplate,
  [saasTemplate.definition.id]: saasTemplate,
  [appDownloadTemplate.definition.id]: appDownloadTemplate,
  [newsletterTemplate.definition.id]: newsletterTemplate,
  [checklistTemplate.definition.id]: checklistTemplate,
  [waitlistTemplate.definition.id]: waitlistTemplate,
  [casestudyTemplate.definition.id]: casestudyTemplate,
  [customTemplate.definition.id]: customTemplate,
  [telegramVipTemplate.definition.id]: telegramVipTemplate,
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export function templatesForType(type: PageDbType): Template[] {
  return TEMPLATE_LIST.filter((t) => t.definition.dbType === type);
}

export function getTemplate(id: string): Template | null {
  return TEMPLATES[id] ?? null;
}
