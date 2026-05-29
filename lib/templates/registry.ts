import { courseTemplate } from "./payment/course";
import { coachingTemplate } from "./payment/coaching";
import { digitalProductTemplate } from "./payment/digital-product";
import { webinarTemplate } from "./landing/webinar";
import { freebieTemplate } from "./landing/freebie";
import { telegramVipTemplate } from "./telegram/vip";
import type { Template, PageDbType } from "./types";

export const TEMPLATES: Record<string, Template> = {
  [courseTemplate.definition.id]: courseTemplate,
  [coachingTemplate.definition.id]: coachingTemplate,
  [digitalProductTemplate.definition.id]: digitalProductTemplate,
  [webinarTemplate.definition.id]: webinarTemplate,
  [freebieTemplate.definition.id]: freebieTemplate,
  [telegramVipTemplate.definition.id]: telegramVipTemplate,
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export function templatesForType(type: PageDbType): Template[] {
  return TEMPLATE_LIST.filter((t) => t.definition.dbType === type);
}

export function getTemplate(id: string): Template | null {
  return TEMPLATES[id] ?? null;
}
