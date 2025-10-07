import { SlackFunction } from "slack/mod.ts";
import { DefineFunction, Schema } from "slack/manifest/mod.ts";
import { buildAppHomeView } from "../utils/views.ts";
import { PingIgaClient } from "../clients/ping_iga.ts";

export const RenderAppHomeDefinition = DefineFunction({
  callback_id: "render_app_home",
  title: "Render the Ping IGA App Home",
  description: "Refreshes a user's Ping IGA request list",
  source_file: "src/functions/render_app_home.ts",
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

const RenderAppHome = SlackFunction(RenderAppHomeDefinition, async ({ inputs, client }) => {
  const ping = new PingIgaClient(client);
  const queryResponse = await client.apps.datastore.query({
    datastore: "requests",
    limit: 200,
  });

  const items = (Array.isArray(queryResponse?.items) ? queryResponse.items : []).filter((item) =>
    item.requester_user_id === inputs.user_id
  );
  const refreshed: typeof items = [];

  for (const item of items) {
    try {
      const status = await ping.getRequestStatus(item.id as string);
      if (status && status !== item.status) {
        await client.apps.datastore.put({
          datastore: "requests",
          item: {
            ...item,
            status,
            last_synced_at: new Date().toISOString(),
          },
        });
        const dm = await client.conversations.open({ users: item.requester_user_id as string });
        if (dm?.channel?.id) {
          await client.chat.postMessage({
            channel: dm.channel.id,
            text: `Request *${item.catalog_item_label}* (${item.id}) is now *${status}*.`,
          });
        }
        refreshed.push({ ...item, status });
      } else {
        refreshed.push({ ...item, last_synced_at: new Date().toISOString() });
      }
    } catch (error) {
      console.error("Unable to refresh request status", error);
      refreshed.push(item);
    }
  }

  refreshed.sort((a, b) => {
    const aDate = Date.parse(a.requested_at as string);
    const bDate = Date.parse(b.requested_at as string);
    return bDate - aDate;
  });

  await client.views.publish({
    user_id: inputs.user_id,
    view: buildAppHomeView(
      refreshed.slice(0, 25).map((item) => ({
        requestId: item.id as string,
        catalogItemLabel: item.catalog_item_label as string,
        status: item.status as string,
        requestedAt: item.requested_at as string,
      })),
    ),
  });

  return { completed: true };
});

export default RenderAppHome;
