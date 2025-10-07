import { DefineDatastore, Schema } from "slack/manifest/mod.ts";

export const requestsDatastore = DefineDatastore({
  name: "requests",
  primary_key: "id",
  attributes: {
    id: {
      type: Schema.types.string,
    },
    requester_user_id: {
      type: Schema.types.string,
    },
    requester_email: {
      type: Schema.types.string,
      required: false,
    },
    requested_for_user_id: {
      type: Schema.types.string,
    },
    catalog_item_id: {
      type: Schema.types.string,
    },
    catalog_item_label: {
      type: Schema.types.string,
    },
    status: {
      type: Schema.types.string,
    },
    justification: {
      type: Schema.types.string,
      required: false,
    },
    requested_at: {
      type: Schema.types.string,
    },
    last_synced_at: {
      type: Schema.types.string,
      required: false,
    },
  },
});
