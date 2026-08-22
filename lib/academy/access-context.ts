import { supabase } from "@/lib/supabase/client";
import { ACADEMY_PREVIEW_IDS, academyPreviewHeadquarters, isAcademyLocalReview } from "@/lib/academy/preview";
import type { AcademyAccessContext } from "@/types/database";

export type AcademyRoutePortal = "manage" | "teach";

const PUBLIC_ACADEMY_PREFIXES = [
  "/academy/site",
  "/academy/c/",
  "/academy/i/",
  "/academy/apply/",
  "/academy/graduate/",
  "/academy/select"
];

export function parseAcademyContextPath(pathname: string) {
  const match = pathname.match(/^\/academy\/h\/([0-9a-f-]{36})\/(manage|teach)(?:\/|$)/i);
  if (!match) return null;
  return {
    academyId: match[1].toLowerCase(),
    portal: match[2].toLowerCase() as AcademyRoutePortal
  };
}

export function getAcademyRouteContext() {
  if (typeof globalThis.location === "undefined") return null;
  return parseAcademyContextPath(globalThis.location.pathname);
}

export function toAcademyContextHref(
  href: string,
  academyId: string,
  portal?: AcademyRoutePortal
) {
  if (!href.startsWith("/academy") || href.startsWith("/academy/h/")) return href;
  if (PUBLIC_ACADEMY_PREFIXES.some((prefix) => href === prefix || href.startsWith(prefix))) return href;

  const [pathname, suffix = ""] = href.split(/(?=[?#])/u, 2);
  if (pathname === "/academy/portal" || pathname.startsWith("/academy/portal/")) {
    const rest = pathname.slice("/academy/portal".length);
    return `/academy/h/${academyId}/teach${rest}${suffix}`;
  }

  const rest = pathname.slice("/academy".length);
  return `/academy/h/${academyId}/${portal ?? "manage"}${rest}${suffix}`;
}

export function toCurrentAcademyContextHref(href: string) {
  const context = getAcademyRouteContext();
  const contextualHref = context ? toAcademyContextHref(href, context.academyId, context.portal) : href;
  if (
    process.env.NODE_ENV === "development" &&
    typeof globalThis.location !== "undefined" &&
    new URLSearchParams(globalThis.location.search).get("preview") === "readonly" &&
    contextualHref.startsWith("/academy") &&
    !contextualHref.includes("preview=readonly")
  ) {
    return `${contextualHref}${contextualHref.includes("?") ? "&" : "?"}preview=readonly`;
  }
  return contextualHref;
}

function isReadonlyLocalPreview() {
  return (
    process.env.NODE_ENV === "development" &&
    typeof globalThis.location !== "undefined" &&
    new URLSearchParams(globalThis.location.search).get("preview") === "readonly"
  );
}

function capabilitiesForManageRole(role: "owner" | "administrator" | "course_editor") {
  if (role === "course_editor") return ["academy:headquarters:view", "academy:courses:manage"];
  return [
    "academy:headquarters:view",
    "academy:headquarters:manage",
    "academy:courses:manage",
    "academy:instructors:manage",
    "academy:applications:manage",
    "academy:settings:manage"
  ];
}

async function listLegacyReadonlyContexts() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return [];

  const contexts = new Map<string, AcademyAccessContext>();
  const { data: manageable, error: manageableError } = await supabase.rpc(
    "academy_get_my_manageable_headquarters"
  );
  if (manageableError && manageableError.code !== "PGRST202" && manageableError.code !== "42883") {
    throw manageableError;
  }

  for (const headquarters of (manageable ?? []) as Array<{ id: string; name: string; handle: string }>) {
    const { data: roleData, error: roleError } = await supabase.rpc(
      "academy_get_my_headquarters_role",
      { p_headquarters_id: headquarters.id }
    );
    if (roleError) throw roleError;
    const role = roleData as "owner" | "administrator" | "course_editor" | null;
    if (!role) continue;
    contexts.set(headquarters.id, {
      academy_id: headquarters.id,
      academy_name: headquarters.name,
      academy_handle: headquarters.handle,
      roles: [role],
      portals: ["manage"],
      capabilities: capabilitiesForManageRole(role)
    });
  }

  const { data: instructorRows, error: instructorError } = await supabase
    .from("academy_instructors")
    .select("headquarters_id")
    .eq("user_id", userData.user.id)
    .eq("is_active", true);
  if (instructorError) throw instructorError;
  const instructorHeadquartersIds = [...new Set((instructorRows ?? []).map((row) => row.headquarters_id))];
  if (instructorHeadquartersIds.length > 0) {
    const { data: instructorHeadquarters, error: headquartersError } = await supabase
      .from("academy_headquarters")
      .select("id,name,handle")
      .in("id", instructorHeadquartersIds);
    if (headquartersError) throw headquartersError;
    for (const headquarters of instructorHeadquarters ?? []) {
      const current = contexts.get(headquarters.id);
      if (current) {
        if (!current.roles.includes("instructor")) current.roles.push("instructor");
        if (!current.portals.includes("teach")) current.portals.push("teach");
      } else {
        contexts.set(headquarters.id, {
          academy_id: headquarters.id,
          academy_name: headquarters.name,
          academy_handle: headquarters.handle,
          roles: ["instructor"],
          portals: ["teach"],
          capabilities: ["academy:instructor:use"]
        });
      }
    }
  }

  return [...contexts.values()];
}

export async function listMyAcademyContexts() {
  if (isAcademyLocalReview()) {
    return [{
      academy_id: ACADEMY_PREVIEW_IDS.headquarters,
      academy_name: academyPreviewHeadquarters.name,
      academy_handle: academyPreviewHeadquarters.handle,
      roles: ["owner", "instructor"],
      portals: ["manage", "teach"],
      capabilities: [
        "academy:headquarters:view",
        "academy:headquarters:manage",
        "academy:courses:manage",
        "academy:instructors:manage",
        "academy:applications:manage",
        "academy:settings:manage"
      ]
    }] satisfies AcademyAccessContext[];
  }
  const { data, error } = await supabase.rpc("academy_list_my_contexts");
  if (error) {
    if (isReadonlyLocalPreview() && (error.code === "PGRST202" || error.code === "42883")) {
      return listLegacyReadonlyContexts();
    }
    throw error;
  }
  return (data ?? []) as AcademyAccessContext[];
}

export async function canCreateAcademyHeadquarters() {
  if (isAcademyLocalReview()) return false;
  const { data, error } = await supabase.rpc("academy_can_create_headquarters");
  if (error) {
    if (isReadonlyLocalPreview() && (error.code === "PGRST202" || error.code === "42883")) return false;
    throw error;
  }
  return data === true;
}
