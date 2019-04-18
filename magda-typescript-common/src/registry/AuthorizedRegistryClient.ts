import {
    AspectDefinition,
    Record,
    WebHook,
    Operation,
    WebHookAcknowledgementResponse,
    MultipleDeleteResult
} from "../generated/registry/api";
import RegistryClient, { RegistryOptions } from "./RegistryClient";
import retry from "../retry";
import formatServiceError from "../formatServiceError";
import createServiceError from "../createServiceError";
import buildJwt from "../session/buildJwt";
import { IncomingMessage } from "http";
import { Maybe } from "tsmonad";
import { MAGDA_ADMIN_PORTAL_ID } from "./TenantConsts";

export interface AuthorizedRegistryOptions extends RegistryOptions {
    jwtSecret: string;
    userId: string;
    tenantId: number;
}

export default class AuthorizedRegistryClient extends RegistryClient {
    protected options: AuthorizedRegistryOptions;
    protected jwt: string;
    protected tenantId: number;

    constructor(options: AuthorizedRegistryOptions) {
        super(options);

        this.options = options;
        this.jwt = buildJwt(options.jwtSecret, options.userId);
        if (options.tenantId === undefined) {
            this.tenantId = MAGDA_ADMIN_PORTAL_ID;
        } else {
            this.tenantId = options.tenantId;
        }
    }

    putAspectDefinition(
        aspectDefinition: AspectDefinition,
        tenantId: number = this.tenantId
    ): Promise<AspectDefinition | Error> {
        const operation = () =>
            this.aspectDefinitionsApi.putById(
                tenantId.toString(),
                encodeURIComponent(aspectDefinition.id),
                aspectDefinition,
                this.jwt
            );
        return retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to create aspect definition "${
                            aspectDefinition.id
                        }".`,
                        e,
                        retriesLeft
                    )
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    postHook(hook: WebHook): Promise<WebHook | Error> {
        const operation = () => this.webHooksApi.create(hook, this.jwt);

        return retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to PUT hook record.`,
                        e,
                        retriesLeft
                    )
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    putHook(hook: WebHook): Promise<WebHook | Error> {
        const operation = () =>
            this.webHooksApi.putById(
                encodeURIComponent(hook.id),
                hook,
                this.jwt
            );
        return retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to PUT hook record.`,
                        e,
                        retriesLeft
                    )
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    getHook(hookId: string): Promise<Maybe<WebHook> | Error> {
        const operation = () =>
            this.webHooksApi
                .getById(encodeURIComponent(hookId), this.jwt)
                .then(result => Maybe.just(result.body))
                .catch(
                    (e: { response?: IncomingMessage; message?: string }) => {
                        if (e.response && e.response.statusCode === 404) {
                            return Maybe.nothing();
                        } else {
                            throw new Error(
                                "Failed to get hook, status was " +
                                    (e.response && e.response.statusCode) +
                                    "\n" +
                                    e.message
                            );
                        }
                    }
                );
        return <any>(
            retry(
                operation,
                this.secondsBetweenRetries,
                this.maxRetries,
                (e, retriesLeft) =>
                    console.log(
                        formatServiceError(
                            `Failed to GET hook ${hookId}`,
                            e,
                            retriesLeft
                        )
                    )
            ).catch(createServiceError)
        );
    }

    getHooks(): Promise<WebHook[] | Error> {
        const operation = () => () => this.webHooksApi.getAll(this.jwt);
        return <any>retry(
            operation(),
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError("Failed to GET hooks.", e, retriesLeft)
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    resumeHook(
        webhookId: string,
        succeeded: boolean = false,
        lastEventIdReceived: string = null,
        active?: boolean
    ): Promise<WebHookAcknowledgementResponse | Error> {
        const operation = () =>
            this.webHooksApi.ack(
                encodeURIComponent(webhookId),
                { succeeded, lastEventIdReceived, active },
                this.jwt
            );

        return retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to resume webhook ${webhookId}`,
                        e,
                        retriesLeft
                    )
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    putRecord(
        record: Record,
        tenantId: number = this.tenantId
    ): Promise<Record | Error> {
        const operation = () =>
            this.recordsApi.putById(
                tenantId.toString(),
                encodeURIComponent(record.id),
                record,
                this.jwt
            );
        return retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to PUT data registry record with ID "${
                            record.id
                        }".`,
                        e,
                        retriesLeft
                    )
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    putRecordAspect(
        recordId: string,
        aspectId: string,
        aspect: any,
        tenantId: number = this.tenantId
    ): Promise<Record | Error> {
        const operation = () =>
            this.recordAspectsApi.putById(
                tenantId.toString(),
                encodeURIComponent(recordId),
                aspectId,
                aspect,
                this.jwt
            );
        return retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to PUT data registry aspect ${aspectId} for record with ID "${recordId}".`,
                        e,
                        retriesLeft
                    )
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    patchRecordAspect(
        recordId: string,
        aspectId: string,
        aspectPatch: Operation[],
        tenantId: number = this.tenantId
    ): Promise<Record | Error> {
        const operation = () =>
            this.recordAspectsApi.patchById(
                tenantId.toString(),
                encodeURIComponent(recordId),
                aspectId,
                aspectPatch,
                this.jwt
            );
        return retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to PUT data registry aspect ${aspectId} for record with ID "${recordId}".`,
                        e,
                        retriesLeft
                    )
                )
        )
            .then(result => result.body)
            .catch(createServiceError);
    }

    deleteBySource(
        sourceTagToPreserve: string,
        sourceId: string,
        tenantId: number = this.tenantId
    ): Promise<MultipleDeleteResult | "Processing" | Error> {
        const operation = () =>
            this.recordsApi
                .trimBySourceTag(
                    tenantId.toString(),
                    sourceTagToPreserve,
                    sourceId,
                    this.jwt
                )
                .then(result => {
                    if (result.response.statusCode === 202) {
                        return "Processing" as "Processing";
                    } else {
                        return result.body as MultipleDeleteResult;
                    }
                });

        return retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to DELETE with sourceTagToPreserve ${sourceTagToPreserve} and sourceId ${sourceId}`,
                        e,
                        retriesLeft
                    )
                )
        ).catch(createServiceError);
    }
}
