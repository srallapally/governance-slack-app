import { DefineWorkflow, Schema } from "slack/manifest/mod.ts";
import { OpenRequestModalDefinition } from "../functions/open_request_modal.ts";

export const catalogRequestWorkflow = DefineWorkflow({
  callback_id: "catalog_request",
  title: "Ping IGA catalog request",
  description: "Launches the Ping IGA request modal",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
      },
      user_id: {
        type: Schema.slack.types.user_id,
      },
      channel_id: {
        type: Schema.slack.types.channel_id,
        required: false,
      },
      search_term: {
        type: Schema.types.string,
        required: false,
      },
      message_context: {
        type: Schema.types.object,
        required: false,
      },
    },
    required: ["interactivity", "user_id"],
  },
});

catalogRequestWorkflow.addStep(OpenRequestModalDefinition, {
  interactivity: catalogRequestWorkflow.inputs.interactivity,
  user_id: catalogRequestWorkflow.inputs.user_id,
  search_term: catalogRequestWorkflow.inputs.search_term,
  message_context: catalogRequestWorkflow.inputs.message_context,
});
