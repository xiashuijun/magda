require("isomorphic-fetch");
import { Tenant } from "@magda/typescript-common/dist/generated/registry/api";
import { registryApi } from "./setupTenantMode";
import { MAGDA_ADMIN_PORTAL_ID } from "@magda/typescript-common/dist/registry/TenantConsts";

export const tenantsTable = new Map<String, Tenant>();

export default function reloadTenants(): Promise<void> {
    return fetch(`${registryApi}/tenants`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-Magda-Tenant-Id": `${MAGDA_ADMIN_PORTAL_ID}` // Warning: The fetch will automatically make the header name into lowercases.
        }
    })
    .then( res => 
        <Promise<Tenant[]>> res.json())
    .then( (tenants: Tenant[]) => {
        tenantsTable.clear();
        tenants.forEach( t => {
            if (t.enabled === true) {
                tenantsTable.set(t.domainName.toLowerCase(), t);
                console.debug(`${t.domainName.toLowerCase()} : ${t.id}`);
            }
        });
    })
}
