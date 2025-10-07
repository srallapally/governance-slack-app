import { DefineWorkflow, Schema } from "slack/manifest/mod.ts";
import { RenderAppHomeDefinition } from "../functions/render_app_home.ts";

export const renderAppHomeWorkflow = DefineWorkflow({
  callback_id: "render_app_home",
  title: "Render Ping IGA App Home",
  description: "Refresh Ping IGA request statuses for a user",
  input_parameters: {
    properties: {
      event: {
        type: Schema.slack.types.event,
      },
      user_id: {
        type: Schema.slack.types.user_id,
      },
    },
    required: ["event", "user_id"],
  },
});

renderAppHomeWorkflow.addStep(RenderAppHomeDefinition, {
  event: renderAppHomeWorkflow.inputs.event,
  user_id: renderAppHomeWorkflow.inputs.user_id,
});
