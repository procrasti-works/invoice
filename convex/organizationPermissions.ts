import { v } from "convex/values";

export const memberRoleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("finance"),
  v.literal("member"),
  v.literal("viewer"),
);

export const assignableMemberRoleValidator = v.union(
  v.literal("admin"),
  v.literal("finance"),
  v.literal("member"),
  v.literal("viewer"),
);

const deletionRoleValidator = v.union(v.literal("owner"), v.literal("admin"));

export const organizationPermissionPolicyValidator = v.object({
  manageSettings: memberRoleValidator,
  manageMembers: memberRoleValidator,
  manageRoles: memberRoleValidator,
  createInvoices: memberRoleValidator,
  sendInvoices: memberRoleValidator,
  voidInvoices: memberRoleValidator,
  manageClients: memberRoleValidator,
  recordPayments: memberRoleValidator,
  managePurchases: memberRoleValidator,
  manageVat: memberRoleValidator,
  exportReports: memberRoleValidator,
  deleteOrganization: deletionRoleValidator,
});

export type MemberRole = "owner" | "admin" | "finance" | "member" | "viewer";
export type AssignableMemberRole = Exclude<MemberRole, "owner">;

export type PermissionKey =
  | "manageSettings"
  | "manageMembers"
  | "manageRoles"
  | "createInvoices"
  | "sendInvoices"
  | "voidInvoices"
  | "manageClients"
  | "recordPayments"
  | "managePurchases"
  | "manageVat"
  | "exportReports"
  | "deleteOrganization";

export type OrganizationPermissionPolicy = {
  manageSettings: MemberRole;
  manageMembers: MemberRole;
  manageRoles: MemberRole;
  createInvoices: MemberRole;
  sendInvoices: MemberRole;
  voidInvoices: MemberRole;
  manageClients: MemberRole;
  recordPayments: MemberRole;
  managePurchases: MemberRole;
  manageVat: MemberRole;
  exportReports: MemberRole;
  deleteOrganization: "owner" | "admin";
};

export const defaultOrganizationPermissionPolicy: OrganizationPermissionPolicy = {
  manageSettings: "admin",
  manageMembers: "admin",
  manageRoles: "admin",
  createInvoices: "finance",
  sendInvoices: "finance",
  voidInvoices: "admin",
  manageClients: "member",
  recordPayments: "finance",
  managePurchases: "finance",
  manageVat: "finance",
  exportReports: "finance",
  deleteOrganization: "owner",
};

const roleRank: Record<MemberRole, number> = {
  viewer: 1,
  member: 2,
  finance: 3,
  admin: 4,
  owner: 5,
};

export function normalizeOrganizationPermissionPolicy(
  policy: Partial<OrganizationPermissionPolicy> | null | undefined,
): OrganizationPermissionPolicy {
  const deleteOrganization =
    policy?.deleteOrganization === "admin" ? "admin" : "owner";

  return {
    ...defaultOrganizationPermissionPolicy,
    ...policy,
    deleteOrganization,
  };
}

export function roleMeetsMinimum(role: MemberRole, minimumRole: MemberRole) {
  return roleRank[role] >= roleRank[minimumRole];
}

export function canRolePerform(
  role: MemberRole,
  policy: Partial<OrganizationPermissionPolicy> | null | undefined,
  permission: PermissionKey,
) {
  if (role === "owner") {
    return true;
  }

  const normalizedPolicy = normalizeOrganizationPermissionPolicy(policy);
  return roleMeetsMinimum(role, normalizedPolicy[permission]);
}
