import { IncompleteCard } from "./IncompleteCard";

export default {
  title: "Components/IncompleteCard",
  component: IncompleteCard,
  parameters: {
    topogram: {
      componentRef: "acme.incomplete.card",
      platform: "web",
      pattern: "summary_card",
      status: "contract_only"
    }
  }
};

export const Default = {};
