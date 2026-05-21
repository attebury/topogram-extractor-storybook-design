import { ReviewQueueGrid } from "./ReviewQueueGrid";

export default {
  title: "Components/ReviewQueueGrid",
  component: ReviewQueueGrid,
  parameters: {
    topogram: {
      widget: "widget_review_queue",
      designLanguage: "design_acme_product_ui",
      componentMap: "component_map_review_queue",
      componentRef: "acme.reviewQueue.grid",
      platform: "web",
      viewport: "wide",
      pattern: "resource_table",
      status: "rendered",
      density: "comfortable",
      stateCoverage: ["empty", "loading", "populated"],
      roleContexts: ["reviewer"],
      themeContexts: ["light", "dark"],
      localeContexts: ["en"],
      behaviorsRendered: ["selection", "sorting"],
      behaviorsContractOnly: ["bulk_action"]
    }
  }
};

export const Default = {
  args: {
    rows: []
  }
};
