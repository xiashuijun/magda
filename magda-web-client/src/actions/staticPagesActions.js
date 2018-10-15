import { actionTypes } from "../constants/ActionTypes";
import fetch from "isomorphic-fetch";
import GenericError from "@magda/typescript-common/dist/authorization-api/GenericError";
import { config } from "../config";

const contentBaseUrl = `${config.contentApiURL}staticPages/`;

export function fetchStaticPage(pageName) {
    return async (dispatch, getState) => {
        try {
            const { staticPages } = getState();
            if (
                staticPages[pageName] &&
                !staticPages[pageName].isFetching &&
                !staticPages[pageName].isError &&
                staticPages[pageName].content
            )
                return;

            dispatch(requestStaticPage(pageName));

            const url = contentBaseUrl + pageName;

            const response = await fetch(url, config.fetchOptions);
            if (response.status !== 200)
                throw new GenericError(
                    `Failed to load data. Status code: ${response.status}`,
                    response.status
                );
            const content = await response.text();

            dispatch(receiveStaticPage(pageName, content));
        } catch (e) {
            dispatch(requestStaticPageError(pageName, e));
        }
    };
}

export function requestStaticPage(pageName) {
    return {
        type: actionTypes.REQUEST_STATIC_PAGE,
        payload: {
            pageName
        }
    };
}

export function receiveStaticPage(pageName, content) {
    return {
        type: actionTypes.RECEIVE_STATIC_PAGE,
        payload: {
            pageName,
            content
        }
    };
}

export function requestStaticPageError(pageName, error) {
    return {
        type: actionTypes.REQUEST_STATIC_PAGE_ERROR,
        payload: {
            pageName,
            error
        }
    };
}
