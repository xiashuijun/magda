import React, { Component } from "react";
import { connect } from "react-redux";
import DataPreviewMap from "../../UI/DataPreviewMap";
import DataPreviewTable from "../../UI/DataPreviewTable";
import DataPreviewTextBox from "../../UI/DataPreviewTextBox";
import DataPreviewGoogleViewer from "../../UI/DataPreviewGoogleViewer";
import DataPreviewJson from "../../UI/DataPreviewJson";
import DataPreviewVega from "../../UI/DataPreviewVega";
import DataPreviewNews from "../../UI/DataPreviewNews";
import ProgressBar from "../../UI/ProgressBar";

const DataPreviewHtml = ({ distribution }) => (
    <iframe
        title="preview"
        width="100%"
        height="600px"
        src={distribution.downloadURL || distribution.accessURL}
    />
);

const DataPreviewNone = () => "This distribution cannot be previewed";

class DistributionPreview extends Component {
    renderByState() {
        // Decide which visualisation to use using visualization-info
        // Compatibility is decided by backend "visualization sleuther"
        const compatiblePreviews = {
            // TESTING
            map: false,
            chart: false,
            table: false,
            json: true, // Continue from here
            html: true,
            text: true,
            rss: true,
            google: true
        }; //this.props.distribution.compatiblePreviews;
        let DataPreviewComponent = DataPreviewNone;
        if (compatiblePreviews.map) {
            DataPreviewComponent = DataPreviewMap;
        } else if (compatiblePreviews.chart) {
            DataPreviewComponent = DataPreviewVega;
        } else if (compatiblePreviews.table) {
            DataPreviewComponent = DataPreviewTable;
        } else if (compatiblePreviews.json) {
            DataPreviewComponent = DataPreviewJson;
        } else if (compatiblePreviews.html) {
            DataPreviewComponent = DataPreviewHtml;
        } else if (compatiblePreviews.text) {
            DataPreviewComponent = DataPreviewTextBox;
        } else if (compatiblePreviews.rss) {
            DataPreviewComponent = DataPreviewNews;
        } else if (compatiblePreviews.google) {
            DataPreviewComponent = DataPreviewGoogleViewer;
        }
        return <DataPreviewComponent distribution={this.props.distribution} />;
    }

    render() {
        const url = this.props.distribution.downloadURL;
        return (
            <div className="data-previewer">
                <h3 className="section-heading">
                    <a href={url} target="_blank">
                        {url && url.substring(url.lastIndexOf("/") + 1)}
                    </a>
                </h3>
                {this.props.error && <div>{this.props.error}</div>}
                {this.props.isFetching && <ProgressBar />}
                {this.props.distribution.identifier && this.renderByState()}
            </div>
        );
    }
}

function mapStateToProps(state) {
    const distribution = state.record.distribution;
    return {
        distribution
    };
}

export default connect(mapStateToProps)(DistributionPreview);
