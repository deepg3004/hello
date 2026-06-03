// "Build from scratch" — a blank template the seller composes from reorderable
// blocks (Hero, Features, Testimonials, FAQ, CTA). Blocks live in
// page_config.blocks and are edited with the BlockEditor in the page builder.

import { CustomBuilderPage } from "@/components/templates/CustomBuilderPage";
import { BLOCKS } from "@/components/templates/blocks/registry";
import { designSection } from "@/lib/templates/design";
import { extractDefaults, readField } from "@/lib/templates/utils";
import type { Template, TemplateDefinition, TemplateRender } from "@/lib/templates/types";

const DEFAULT_BLOCKS = [
  { id: "b_hero", type: "hero", data: { ...BLOCKS.hero!.defaultData } },
  { id: "b_features", type: "features", data: { ...BLOCKS.features!.defaultData } },
  { id: "b_cta", type: "cta", data: { ...BLOCKS.cta!.defaultData } },
];

const definition: TemplateDefinition = {
  id: "custom",
  name: "Build from scratch",
  description: "A blank canvas — add, reorder and edit your own page blocks.",
  category: "landing",
  dbType: "landing",
  thumbnail: "",
  theme: { name: "Midnight", primary: "#3b82f6", background: "#0A1628" },
  sections: [designSection("midnight")],
};

const Render: TemplateRender = ({ values, pageId, slug, isPreview }) => (
  <CustomBuilderPage
    pageId={pageId}
    slug={slug}
    isPreview={isPreview}
    theme_key={readField(values, "theme", "midnight")}
    bg_animation={readField(values, "bg_animation", "none")}
    blocks={readField(values, "blocks", DEFAULT_BLOCKS)}
  />
);

export const customTemplate: Template = {
  definition,
  Render,
  defaultValues: { ...extractDefaults(definition), blocks: DEFAULT_BLOCKS },
};
