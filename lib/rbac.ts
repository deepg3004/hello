// Team & Roles / RBAC (Session 15) — single source of truth for seller-team
// roles and what each can do. Roles are PRESETS (no custom per-member tweaks):
//
//   owner   — the account holder (implicit, never a team_members row): everything
//   manager — runs the business: all modules except gateway / billing / team;
//             wallet view-only (spending money stays with the owner)
//   staff   — day-to-day fulfilment: manage pages, orders, customers, leads;
//             analytics view-only; nothing else
//   viewer  — read-only across the business; no settings, no money, no team
//
// A "capability" is `${module}.${action}` where action is 'view' | 'manage'.
// can(role, cap) is the only check callers should use.

export type Role = "owner" | "manager" | "staff" | "viewer";

export const ASSIGNABLE_ROLES: Exclude<Role, "owner">[] = [
  "manager",
  "staff",
  "viewer",
];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Exclude<Role, "owner">, string> = {
  manager:
    "Runs the business — all modules except payment gateway, billing and team. Wallet is view-only.",
  staff:
    "Day-to-day work — manage pages, orders, customers and leads. Analytics is view-only.",
  viewer: "Read-only access across the business. No settings, money or team.",
};

// Every gated area of the seller dashboard. Settings is split so a manager can
// run domains / notifications / email but never touch the gateway or billing.
export const MODULES = [
  "pages",
  "courses",
  "store",
  "website",
  "booking",
  "transactions", // orders + transactions
  "customers",
  "leads",
  "analytics",
  "coupons",
  "affiliates",
  "marketing",
  "telegram",
  "discord",
  "wallet",
  "domains",
  "notifications",
  "email", // custom SMTP
  "gateway", // owner-only (holds secrets)
  "billing", // owner-only (tax/GST + subscription)
  "team", // owner-only (this feature)
] as const;

export type Module = (typeof MODULES)[number];
export type Action = "view" | "manage";
export type Capability = `${Module}.${Action}`;

type Access = "none" | "view" | "manage";

// Modules a manager fully runs (the rest are set explicitly below).
const MANAGER_MANAGE: Module[] = [
  "pages",
  "courses",
  "store",
  "website",
  "booking",
  "transactions",
  "customers",
  "leads",
  "analytics",
  "coupons",
  "affiliates",
  "marketing",
  "telegram",
  "discord",
  "domains",
  "notifications",
  "email",
];

const STAFF_MANAGE: Module[] = ["pages", "transactions", "customers", "leads"];

// Business modules a viewer can read.
const VIEWER_VIEW: Module[] = [
  "pages",
  "courses",
  "store",
  "website",
  "booking",
  "transactions",
  "customers",
  "leads",
  "analytics",
  "coupons",
  "affiliates",
  "marketing",
  "telegram",
  "discord",
  "wallet",
  "domains",
  "notifications",
  "email",
];

function matrixFor(role: Role): Record<Module, Access> {
  const m = {} as Record<Module, Access>;
  for (const mod of MODULES) m[mod] = "none";

  switch (role) {
    case "owner":
      for (const mod of MODULES) m[mod] = "manage";
      break;
    case "manager":
      for (const mod of MANAGER_MANAGE) m[mod] = "manage";
      m.wallet = "view";
      // gateway / billing / team stay "none"
      break;
    case "staff":
      for (const mod of STAFF_MANAGE) m[mod] = "manage";
      m.analytics = "view";
      break;
    case "viewer":
      for (const mod of VIEWER_VIEW) m[mod] = "view";
      break;
  }
  return m;
}

const ROLE_MATRIX: Record<Role, Record<Module, Access>> = {
  owner: matrixFor("owner"),
  manager: matrixFor("manager"),
  staff: matrixFor("staff"),
  viewer: matrixFor("viewer"),
};

const RANK: Record<Access, number> = { none: 0, view: 1, manage: 2 };

/** Does `role` have `capability` (e.g. "pages.manage", "wallet.view")? */
export function can(role: Role, capability: Capability): boolean {
  const dot = capability.lastIndexOf(".");
  const mod = capability.slice(0, dot) as Module;
  const action = capability.slice(dot + 1) as Action;
  const access = ROLE_MATRIX[role]?.[mod] ?? "none";
  return RANK[access] >= RANK[action === "manage" ? "manage" : "view"];
}

/** Modules the role can at least view — drives nav visibility. */
export function visibleModules(role: Role): Module[] {
  return MODULES.filter((mod) => can(role, `${mod}.view` as Capability));
}

export const DENIED_MESSAGE =
  "You don't have permission to do that. Ask the account owner for access.";
