import { cloneLpBlock } from "@/components/mikkeos/page-builder/lp-canvas";
import type { LpBlock } from "@/components/mikkeos/page-builder/lp-design";
import type { SalesPlanDraft } from "./sales-plan-drafts";
import { reviewedAcademyPageTemplates } from './reviewed-page-templates';

export type AcademyPageTarget = "sales_page" | "headquarters_homepage" | "instructor_sales_page";
export type AcademyPageTemplate = {
  id: string;
  version: number;
  label: string;
  targets: AcademyPageTarget[];
  blocks: LpBlock[];
};
const targets: AcademyPageTarget[] = ["sales_page", "headquarters_homepage", "instructor_sales_page"];
const blockTypes = new Set(["paragraph", "heading", "image", "quote", "list", "divider", "link", "video", "links", "image-text", "gallery", "cta"]);

function validateTemplate(template: AcademyPageTemplate): void {
  if (!template.id?.trim() || !template.label?.trim() || !Number.isSafeInteger(template.version) || template.version < 1) throw new Error("Invalid template identity");
  if (!Array.isArray(template.targets) || !template.targets.length || template.targets.some(target => !targets.includes(target))) throw new Error("Invalid template target");
  const ids = new Set<string>();
  let count = 0;
  function visit(blocks: LpBlock[], depth: number): void {
    if (!Array.isArray(blocks) || depth > 32) throw new Error("Invalid template blocks");
    for (const block of blocks) {
      if (!block || !block.id || ids.has(block.id) || !blockTypes.has(block.type) || ++count > 2000) throw new Error("Invalid template block");
      ids.add(block.id);
      // Official references belong to an authorized page, never a reusable package.
      if (block.lp?.reference) throw new Error("Template cannot contain official page references");
      if (block.lp?.children) visit(block.lp.children, depth + 1);
    }
  }
  visit(template.blocks, 0);
}

/** Trusted, reviewed packages only. This is not an HTML importer or authorization boundary.
 * The UI06 choices are registered by default; caller-supplied packages stay isolated.
 */
export function createAcademyPageTemplateRegistry(packages: AcademyPageTemplate[] = reviewedAcademyPageTemplates) {
  const registry = new Map<string, AcademyPageTemplate>();
  for (const entry of packages) {
    validateTemplate(entry);
    const key = JSON.stringify([entry.id, entry.version]);
    if (registry.has(key)) throw new Error("Template version already registered");
    registry.set(key, structuredClone(entry));
  }
  return {
    list(target: AcademyPageTarget): Omit<AcademyPageTemplate, "blocks">[] {
      return [...registry.values()].filter(entry => entry.targets.includes(target)).map(({ blocks: _blocks, ...entry }) => structuredClone(entry));
    },
    prepare(input: {
      templateId: string;
      version: number;
      target: AcademyPageTarget;
      headquartersId: string;
      salesPlan?: SalesPlanDraft;
      existingBlocks: LpBlock[];
      mode: "new_page" | "append";
    }) {
      const entry = registry.get(JSON.stringify([input.templateId, input.version]));
      if (!entry || !entry.targets.includes(input.target)) throw new Error("Template unavailable for this page");
      if (!input.headquartersId) throw new Error("Headquarters required");
      if (input.mode !== "new_page" && input.mode !== "append") throw new Error("Unsupported application mode");
      if (input.mode === "new_page" && input.existingBlocks.length) throw new Error("Existing page content must be preserved");
      if (input.target !== "headquarters_homepage" && !input.salesPlan) throw new Error("Sales plan draft required");
      if (input.salesPlan && (input.salesPlan.headquarters_id !== input.headquartersId || input.salesPlan.status !== "draft" || !input.salesPlan.publication_hold)) throw new Error("Sales plan context mismatch");
      // Caller must authorize HQ/page access before loading or saving. Never persist here.
      return {
        blocks: [...structuredClone(input.existingBlocks), ...entry.blocks.map(cloneLpBlock)],
        template: { id: entry.id, version: entry.version },
        context: {
          headquarters_id: input.headquartersId,
          sales_plan_id: input.salesPlan?.id ?? null,
          sales_plan_revision: input.salesPlan?.revision ?? null,
        },
        status: "draft" as const,
        publication_hold: true as const,
      };
    },
  };
}
