import * as express from "express";
import * as _ from "lodash";
import buildJwt from "@magda/typescript-common/dist/session/buildJwt";
import * as joi from "joi";

const validate = require("express-validation");
const chrono = require("chrono-node");

import ElasticSearchQueryer from "./search/elasticsearch/ElasticSearchQueryer";
import { Query, QueryRegion } from "./model";

// import {
//     installStatusRouter,
//     createServiceProbe
// } from "@magda/typescript-common/dist/express/status";

export interface ApiRouterOptions {
    jwtSecret: string;
    datasetsIndexId: string;
    regionsIndexId: string;
    publishersIndexId: string;
}

export default function createApiRouter(options: ApiRouterOptions) {
    const router: express.Router = express.Router();
    const searchQueryer = new ElasticSearchQueryer(
        options.datasetsIndexId,
        options.regionsIndexId,
        options.publishersIndexId
    );

    // const status = {
    //     probes: {
    //         database: database.check.bind(database),
    //         auth: createServiceProbe(options.authApiUrl)
    //     }
    // };
    // installStatusRouter(router, status);

    const baseValidators = {
        start: joi.number().default(0),
        limit: joi.number().default(10),
        publisher: joi
            .array()
            .items(joi.string())
            .optional(),
        dateFrom: joi.string().optional(),
        dateTo: joi.string().optional(),
        region: joi
            .array()
            .items(joi.string())
            .optional(),
        format: joi
            .array()
            .items(joi.string())
            .optional(),
        publishingState: joi
            .array()
            .items(joi.string())
            .optional()
    };

    const facetQueryValidation = {
        query: {
            facetQuery: joi.string().optional(),
            generalQuery: joi.string().optional(),
            ...baseValidators
        }
    };

    function parseBaseQuery(queryStringObj: any): Query {
        return {
            freeText: queryStringObj.generalQuery,
            publishers: queryStringObj.publisher,
            dateFrom:
                queryStringObj.dateFrom &&
                chrono.en_GB.parse(queryStringObj.dateFrom)[0].end.date(),
            dateTo:
                queryStringObj.dateTo &&
                chrono.en_GB.parse(queryStringObj.dateTo)[0].end.date(),
            regions: processRegions(queryStringObj.region),
            formats: queryStringObj.format,
            publishingState: queryStringObj.publishingState
        };
    }

    router.get(
        "/facets/:facetId/options",
        validate(facetQueryValidation),
        async (req, res) => {
            const queryString = req.query;

            const processedQuery: Query = {
                ...parseBaseQuery(queryString),
                freeText: queryString.generalQuery
            };

            try {
                const results = await searchQueryer.searchFacets(
                    req.params.facetId,
                    processedQuery,
                    queryString.start,
                    queryString.limit,
                    queryString.facetQuery
                );

                res.status(200).send(results);
            } catch (e) {
                console.error(e);
                console.log(JSON.stringify(e.meta && e.meta.body));
                res.status(500).send("Error");
            }
        }
    );

    const datasetQueryValidation = {
        query: {
            ...baseValidators,

            query: joi.string().optional(),
            facetSize: joi
                .number()
                .optional()
                .default(10)
        }
    };

    router.get(
        "/datasets",
        validate(datasetQueryValidation),
        async (req, res) => {
            const queryString = req.query;

            const processedQuery: Query = {
                ...parseBaseQuery(queryString),
                freeText: queryString.query
            };

            try {
                const results = await searchQueryer.search(
                    processedQuery,
                    queryString.start,
                    queryString.limit,
                    queryString.facetQuery
                );

                res.status(200).send(results);
            } catch (e) {
                console.error(e);
                console.log(JSON.stringify(e.meta && e.meta.body));
                res.status(500).send("Error");
            }
        }
    );

    // This is for getting a JWT in development so you can do fake authenticated requests to a local server.
    if (process.env.NODE_ENV !== "production") {
        router.get("/public/jwt", function(req, res) {
            res.status(200);
            res.write(
                "X-Magda-Session: " +
                    buildJwt(
                        options.jwtSecret,
                        "00000000-0000-4000-8000-000000000000"
                    )
            );
            res.send();
        });
    }

    return router;
}

function processRegions(regions: string[] = []): QueryRegion[] {
    return regions.map(regionString => {
        const [regionType, regionId] = regionString.split(":");
        return {
            regionType,
            regionId
        };
    });
}