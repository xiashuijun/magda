import { WebHook } from "magda-typescript-common/src/generated/registry/api";
import Registry from "magda-typescript-common/src/registry/AuthorizedRegistryClient";

import MinionOptions from "./MinionOptions";
import getWebhookUrl from "./getWebhookUrl";
import buildWebhookConfig from "./buildWebhookConfig";

export type NeedsCrawl = Promise<boolean>;

export default async function registerNewWebhook(
    options: MinionOptions,
    registry: Registry
) {
    console.info("Registering webhook");

    const webHookConfig = buildWebhookConfig(options);

    const userId = "b1fddd6f-e230-4068-bd2c-1a21844f1598";
    const newWebHook: WebHook = {
        id: options.id,
        userId,
        name: options.id,
        active: true,
        url: getWebhookUrl(options),
        eventTypes: [
            "CreateRecord",
            "CreateAspectDefinition",
            "CreateRecordAspect",
            "PatchRecord",
            "PatchAspectDefinition",
            "PatchRecordAspect"
        ],
        config: webHookConfig,
        lastEvent: null,
        isWaitingForResponse: false,
        enabled: true,
        lastRetryTime: null,
        retryCount: 0,
        isRunning: null,
        isProcessing: null
    };

    return registry.putHook(newWebHook);
}
