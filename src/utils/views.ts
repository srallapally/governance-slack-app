import type { CatalogItem } from "../clients/ping_iga.ts";

interface RequestModalOptions {
  searchQuery?: string;
  items: CatalogItem[];
  requestFor?: "self" | "other";
  justification?: string;
  requestedForUser?: string;
  selectedCatalogItemId?: string;
}

export const CATALOG_SELECT_BLOCK_ID = "catalog_selection";
export const CATALOG_SELECT_ACTION_ID = "catalog_select";
export const SEARCH_INPUT_BLOCK_ID = "search_block";
export const SEARCH_INPUT_ACTION_ID = "search_query";
export const REQUEST_FOR_BLOCK_ID = "request_for";
export const REQUEST_FOR_ACTION_ID = "request_for_select";
export const REQUESTED_FOR_BLOCK_ID = "requested_for_user";
export const REQUESTED_FOR_ACTION_ID = "requested_for_select";
export const JUSTIFICATION_BLOCK_ID = "justification";
export const JUSTIFICATION_ACTION_ID = "justification_input";

export function buildRequestModal(options: RequestModalOptions) {
  const {
    searchQuery = "",
    items,
    requestFor = "self",
    requestedForUser,
    justification,
    selectedCatalogItemId,
  } = options;

  const selectOptions = items.map((item) => ({
    text: {
      type: "plain_text" as const,
      text: truncate(`${item.label}${item.type ? ` (${item.type})` : ""}`, 75),
    },
    value: item.id,
    description: item.description?.slice(0, 75),
  }));

  return {
    type: "modal",
    callback_id: "catalog_request_modal",
    title: {
      type: "plain_text",
      text: "Request Access",
    },
    submit: {
      type: "plain_text",
      text: "Request",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks: [
      {
        type: "input",
        block_id: SEARCH_INPUT_BLOCK_ID,
        dispatch_action: true,
        label: {
          type: "plain_text",
          text: "Search catalog",
        },
        element: {
          type: "plain_text_input",
          action_id: SEARCH_INPUT_ACTION_ID,
          initial_value: searchQuery,
          placeholder: {
            type: "plain_text",
            text: "Search for apps, roles, or entitlements",
          },
        },
      },
      {
        type: "input",
        block_id: CATALOG_SELECT_BLOCK_ID,
        label: {
          type: "plain_text",
          text: "Catalog item",
        },
        element: {
          type: "static_select",
          action_id: CATALOG_SELECT_ACTION_ID,
          placeholder: {
            type: "plain_text",
            text: items.length ? "Select an item" : "Type a search term to see results",
          },
          options: selectOptions,
          initial_option: selectedCatalogItemId
            ? selectOptions.find((option) => option.value === selectedCatalogItemId)
            : undefined,
        },
      },
      {
        type: "input",
        block_id: REQUEST_FOR_BLOCK_ID,
        label: {
          type: "plain_text",
          text: "Request for",
        },
        element: {
          type: "static_select",
          action_id: REQUEST_FOR_ACTION_ID,
          initial_option: {
            text: {
              type: "plain_text",
              text: requestFor === "other" ? "Someone else" : "Myself",
            },
            value: requestFor,
          },
          options: [
            {
              text: {
                type: "plain_text",
                text: "Myself",
              },
              value: "self",
            },
            {
              text: {
                type: "plain_text",
                text: "Someone else",
              },
              value: "other",
            },
          ],
        },
      },
      {
        type: "input",
        optional: requestFor === "self",
        block_id: REQUESTED_FOR_BLOCK_ID,
        label: {
          type: "plain_text",
          text: "Who should receive access?",
        },
        element: {
          type: "users_select",
          action_id: REQUESTED_FOR_ACTION_ID,
          initial_user: requestedForUser,
        },
        hint: {
          type: "plain_text",
          text: requestFor === "self"
            ? "We'll default to you if left blank"
            : "Select the teammate who should receive access",
        },
      },
      {
        type: "input",
        block_id: JUSTIFICATION_BLOCK_ID,
        optional: true,
        label: {
          type: "plain_text",
          text: "Business justification (sent to Ping IGA)",
        },
        element: {
          type: "plain_text_input",
          action_id: JUSTIFICATION_ACTION_ID,
          multiline: true,
          initial_value: justification ?? "",
        },
        hint: {
          type: "plain_text",
          text: "Sensitive details are not stored in Slack",
        },
      },
    ],
  };
}

interface HomeRequestSummary {
  requestId: string;
  catalogItemLabel: string;
  status: string;
  requestedAt: string;
}

export function buildAppHomeView(requests: HomeRequestSummary[]) {
  const headerBlocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Ping IGA requests",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "Search the catalog with */iga* or the Ping IGA shortcuts. Requests and statuses refresh whenever you open this page.",
      },
    },
  ];

  const requestBlocks = requests.length
    ? requests.flatMap((request) => [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${request.catalogItemLabel}*\nStatus: *${request.status}*\nRequested: ${formatDate(request.requestedAt)}`,
        },
        accessory: {
          type: "button",
          action_id: "view_request_in_iga",
          text: {
            type: "plain_text",
            text: "Open in Ping IGA",
          },
          value: request.requestId,
          url: undefined,
        },
      },
      {
        type: "divider",
      },
    ])
    : [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "No recent requests yet. Use */iga* to get started!",
        },
      },
    ];

  return {
    type: "home",
    blocks: [...headerBlocks, ...requestBlocks],
  };
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function formatDate(iso: string) {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (_error) {
    return iso;
  }
}
