import { SlackFunction } from "slack/mod.ts";
import { DefineFunction, Schema } from "slack/manifest/mod.ts";
import { PingIgaClient } from "../clients/ping_iga.ts";
import {
  buildRequestModal,
  CATALOG_SELECT_ACTION_ID,
  CATALOG_SELECT_BLOCK_ID,
  JUSTIFICATION_ACTION_ID,
  JUSTIFICATION_BLOCK_ID,
  REQUESTED_FOR_ACTION_ID,
  REQUESTED_FOR_BLOCK_ID,
  REQUEST_FOR_ACTION_ID,
  REQUEST_FOR_BLOCK_ID,
  SEARCH_INPUT_ACTION_ID,
  SEARCH_INPUT_BLOCK_ID,
} from "../utils/views.ts";

function parseSelectedOption(viewState: any) {
  return viewState?.[CATALOG_SELECT_BLOCK_ID]?.[CATALOG_SELECT_ACTION_ID]?.selected_option ?? null;
}

function parseRequestFor(viewState: any) {
  return viewState?.[REQUEST_FOR_BLOCK_ID]?.[REQUEST_FOR_ACTION_ID]?.selected_option?.value ??
    "self";
}

function parseRequestedForUser(viewState: any) {
  return viewState?.[REQUESTED_FOR_BLOCK_ID]?.[REQUESTED_FOR_ACTION_ID]?.selected_user ?? undefined;
}

function parseJustification(viewState: any) {
  return viewState?.[JUSTIFICATION_BLOCK_ID]?.[JUSTIFICATION_ACTION_ID]?.value ?? undefined;
}

function parseSearchQuery(viewState: any) {
  return viewState?.[SEARCH_INPUT_BLOCK_ID]?.[SEARCH_INPUT_ACTION_ID]?.value ?? "";
}

export const OpenRequestModalDefinition = DefineFunction({
  callback_id: "open_request_modal",
  title: "Open Ping IGA request modal",
  description: "Launches the Ping IGA catalog request modal",
  source_file: "src/functions/open_request_modal.ts",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
      },
      user_id: {
        type: Schema.slack.types.user_id,
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
  output_parameters: {
    properties: {
      request_id: {
        type: Schema.types.string,
      },
    },
    required: [],
  },
});

const OpenRequestModal = SlackFunction(OpenRequestModalDefinition, async ({ inputs, client }) => {
  const ping = new PingIgaClient(client);
  const initialItems = await ping.searchCatalog(inputs.search_term ?? "");

  await client.views.open({
    interactivity_pointer: inputs.interactivity.interactivity_pointer,
    view: buildRequestModal({
      items: initialItems,
      searchQuery: inputs.search_term,
      requestedForUser: inputs.user_id,
    }),
  });

  return { completed: false };
});

OpenRequestModal.addBlockActionsHandler(SEARCH_INPUT_ACTION_ID, async ({ client, body }) => {
  const ping = new PingIgaClient(client);
  const state = body?.view?.state?.values;
  const query = body?.actions?.[0]?.value ?? parseSearchQuery(state);
  const items = await ping.searchCatalog(query ?? "");
  const selectedOption = parseSelectedOption(state);
  const requestFor = parseRequestFor(state);
  const requestedForUser = parseRequestedForUser(state);
  const justification = parseJustification(state);

  await client.views.update({
    view_id: body.view?.id,
    hash: body.view?.hash,
    view: buildRequestModal({
      items,
      searchQuery: query ?? "",
      selectedCatalogItemId: selectedOption?.value,
      requestFor: requestFor === "other" ? "other" : "self",
      requestedForUser,
      justification,
    }),
  });
});

OpenRequestModal.addBlockActionsHandler(REQUEST_FOR_ACTION_ID, async ({ client, body }) => {
  const ping = new PingIgaClient(client);
  const state = body.view?.state?.values;
  const query = parseSearchQuery(state);
  const items = await ping.searchCatalog(query);
  const selectedOption = parseSelectedOption(state);
  const justification = parseJustification(state);
  const newValue = body.actions?.[0]?.selected_option?.value ?? "self";
  const requestedForUser = parseRequestedForUser(state);

  await client.views.update({
    view_id: body.view?.id,
    hash: body.view?.hash,
    view: buildRequestModal({
      items,
      searchQuery: query,
      selectedCatalogItemId: selectedOption?.value,
      requestFor: newValue === "other" ? "other" : "self",
      requestedForUser,
      justification,
    }),
  });
});

OpenRequestModal.addViewSubmissionHandler(async ({ client, body, inputs }) => {
  const state = body.view?.state?.values;
  const selectedOption = parseSelectedOption(state);
  if (!selectedOption) {
    return {
      response_action: "errors",
      errors: {
        [CATALOG_SELECT_BLOCK_ID]: "Select a catalog item",
      },
    };
  }

  const requestFor = parseRequestFor(state);
  const justification = parseJustification(state);
  const requestedForUser = requestFor === "other"
    ? parseRequestedForUser(state)
    : inputs.user_id;
  if (!requestedForUser) {
    return {
      response_action: "errors",
      errors: {
        [REQUESTED_FOR_BLOCK_ID]: "Choose who should receive access",
      },
    };
  }

  const ping = new PingIgaClient(client);
  const requesterProfile = await client.users.info({ user: inputs.user_id });
  const requesterEmail = requesterProfile?.user?.profile?.email as string | undefined;

  try {
    const result = await ping.createRequest({
      catalogItemId: selectedOption.value,
      catalogItemLabel: selectedOption.text?.text ?? selectedOption.value,
      justification,
      requestedBy: inputs.user_id,
      requestedFor: requestedForUser,
      requesterEmail,
    });

    await client.apps.datastore.put({
      datastore: "requests",
      item: {
        id: result.requestId,
        requester_user_id: inputs.user_id,
        requester_email: requesterEmail,
        requested_for_user_id: requestedForUser,
        catalog_item_id: selectedOption.value,
        catalog_item_label: selectedOption.text?.text ?? selectedOption.value,
        status: result.status ?? "PENDING",
        justification,
        requested_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      },
    });

    const summary = requestFor === "self"
      ? `You requested *${selectedOption.text?.text ?? selectedOption.value}*`
      : `You requested *${selectedOption.text?.text ?? selectedOption.value}* for <@${requestedForUser}>`;

    const requesterDm = await client.conversations.open({ users: inputs.user_id });
    if (requesterDm?.channel?.id) {
      await client.chat.postMessage({
        channel: requesterDm.channel.id,
        text:
          `${summary}. Ping IGA request ID: *${result.requestId}*. We'll notify you as the status changes.`,
      });
    }

    if (requestedForUser !== inputs.user_id) {
      const recipientDm = await client.conversations.open({ users: requestedForUser });
      if (recipientDm?.channel?.id) {
        await client.chat.postMessage({
          channel: recipientDm.channel.id,
          text:
            `<@${inputs.user_id}> requested *${selectedOption.text?.text ?? selectedOption.value}* for you. Request ID: *${result.requestId}*.`,
        });
      }
    }

    return {
      response_action: "clear",
      completed: true,
      outputs: {
        request_id: result.requestId,
      },
    };
  } catch (error) {
    console.error("Unable to submit Ping IGA request", error);
    return {
      response_action: "errors",
      errors: {
        [CATALOG_SELECT_BLOCK_ID]: error instanceof Error ? error.message : "Unable to submit request",
      },
    };
  }
});

export default OpenRequestModal;
