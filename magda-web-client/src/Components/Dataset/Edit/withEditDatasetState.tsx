import React, { useState } from "react";
import { RouterProps, withRouter } from "react-router-dom";
import { connect } from "react-redux";
import { useAsync } from "react-async-hook";
import { State, rawDatasetDataToState } from "../Add/DatasetAddCommon";
import { User } from "reducers/userManagementReducer";
import { config } from "config";
import { fetchRecord } from "api-clients/RegistryApis";

type Props = { initialState: State; user: User } & RouterProps;

function mapStateToProps(state: any) {
    return {
        user: state.userManagement && state.userManagement.user,
        isFetchingWhoAmI: state.userManagement.isFetchingWhoAmI
    };
}

export default <T extends Props>(Component: React.ComponentType<T>) => {
    const withEditDatasetState = (props: T) => {
        const [state, updateData] = useState<State | undefined>(undefined);
        const isDisabled =
            !config.featureFlags.previewAddDataset &&
            (!props.user ||
                props.user.id === "" ||
                props.user.isAdmin !== true);

        const { loading, error } = useAsync(async () => {
            if (isDisabled || !props.match.params.datasetId) {
                return;
            }
            const data = await fetchRecord(props.match.params.datasetId);
            const loadedStateData = await rawDatasetDataToState(data);

            updateData(loadedStateData);
        }, [isDisabled, props.match.params.datasetId]);

        if (props.isFetchingWhoAmI) {
            return <div>Loading...</div>;
        } else if (isDisabled) {
            return (
                <div
                    className="au-body au-page-alerts au-page-alerts--error"
                    style={{ marginTop: "50px" }}
                >
                    <span>
                        Only admin users are allowed to access this page.
                    </span>
                </div>
            );
        } else if ((!state || loading) && !error) {
            return <div>Loading...</div>;
        } else if (error) {
            return <div>Failed to load dataset data: {"" + error}</div>;
        } else {
            return <Component {...props} initialState={state} />;
        }
    };

    return connect(mapStateToProps)(withRouter(withEditDatasetState));
};
