import {
    AspectDefinition,
    AspectDefinitionsApi,
    Record,
    RecordsApi,
    RecordAspectsApi,
    WebHooksApi,
    TenantsApi,
    Tenant
} from "../generated/registry/api";
import * as URI from "urijs";
import retry from "../retry";
import formatServiceError from "../formatServiceError";
import createServiceError from "../createServiceError";
import { MAGDA_ADMIN_PORTAL_ID } from "./TenantConsts";

export interface RegistryOptions {
    baseUrl: string;
    maxRetries?: number;
    secondsBetweenRetries?: number;
    tenantId?: number;
}

export interface PutResult {
    successfulPuts: number;
    errors: Error[];
}

export interface RecordsPage<I extends Record> {
    totalCount: number;
    hasMore: boolean;
    nextPageToken?: string;
    records: I[];
}

export default class RegistryClient {
    protected baseUri: uri.URI;
    protected aspectDefinitionsApi: AspectDefinitionsApi;
    protected recordsApi: RecordsApi;
    protected webHooksApi: WebHooksApi;
    protected recordAspectsApi: RecordAspectsApi;
    protected maxRetries: number;
    protected secondsBetweenRetries: number;
    protected tenantsApi: TenantsApi;
    protected tenantId: number;

    constructor({
        baseUrl,
        maxRetries = 10,
        secondsBetweenRetries = 10
    }: RegistryOptions) {
        const registryApiUrl = baseUrl;
        this.baseUri = new URI(baseUrl);
        this.maxRetries = maxRetries;
        this.secondsBetweenRetries = secondsBetweenRetries;

        this.aspectDefinitionsApi = new AspectDefinitionsApi(registryApiUrl);
        this.recordsApi = new RecordsApi(registryApiUrl);
        this.recordsApi.useQuerystring = true; // Use querystring instead of qs to construct URL
        this.recordAspectsApi = new RecordAspectsApi(registryApiUrl);
        this.webHooksApi = new WebHooksApi(registryApiUrl);
        this.tenantsApi = new TenantsApi(registryApiUrl);

        if (this.tenantId === undefined) this.tenantId = MAGDA_ADMIN_PORTAL_ID;
    }

    getRecordUrl(id: string): string {
        return this.baseUri
            .clone()
            .segment("records")
            .segment(id)
            .toString();
    }

    getAspectDefinitions(): Promise<AspectDefinition[] | Error> {
        const operation = () => () =>
            this.aspectDefinitionsApi.getAll(this.tenantId.toString());
        return <any>retry(
            operation(),
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        "Failed to GET aspect definitions.",
                        e,
                        retriesLeft
                    )
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    getRecord(
        id: string,
        aspect?: Array<string>,
        optionalAspect?: Array<string>,
        dereference?: boolean
    ): Promise<Record | Error> {
        const operation = (id: string) => () =>
            this.recordsApi.getById(
                this.tenantId.toString(),
                id,
                aspect,
                optionalAspect,
                dereference
            );
        return <any>retry(
            operation(id),
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError("Failed to GET records.", e, retriesLeft)
                ),
            e => e.response.statusCode !== 404
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    getRecords<I extends Record>(
        aspect?: Array<string>,
        optionalAspect?: Array<string>,
        pageToken?: string,
        dereference?: boolean,
        limit?: number
    ): Promise<RecordsPage<I> | Error> {
        const operation = (pageToken: string) => () =>
            this.recordsApi.getAll(
                this.tenantId.toString(),
                aspect,
                optionalAspect,
                pageToken,
                undefined,
                limit,
                dereference
            );
        return <any>retry(
            operation(pageToken),
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError("Failed to GET records.", e, retriesLeft)
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    getRecordsPageTokens(
        aspect?: Array<string>,
        limit?: number
    ): Promise<string[] | Error> {
        const operation = () =>
            this.recordsApi.getPageTokens(
                this.tenantId.toString(),
                aspect,
                limit
            );
        return <any>retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        "Failed to GET records page tokens.",
                        e,
                        retriesLeft
                    )
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    getTenants(): Promise<Array<Tenant> | Error> {
        // return this.tenantsApi.getAll().then(result => result.body);
        const operation = () =>
            this.tenantsApi.getAll(this.tenantId.toString());
        return <any>retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError("Failed to GET tenants.", e, retriesLeft)
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    getTenant(domainName: string): Promise<Tenant | Error> {
        // return this.tenantsApi.getByDomainName(domainName).then(result => result.body);
        const operation = () =>
            this.tenantsApi.getByDomainName(
                this.tenantId.toString(),
                domainName
            );
        return <any>retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError("Failed to GET tenants.", e, retriesLeft)
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }
}
