import { DefineManifest } from "slack/manifest/mod.ts";
import { catalogRequestWorkflow } from "./src/workflows/catalog_request.ts";
import { renderAppHomeWorkflow } from "./src/workflows/render_app_home.ts";
import { requestsDatastore } from "./src/datastores/requests.ts";

export default DefineManifest({
  name: "Ping IGA",
  description:
    "Search, request, and track access from Ping Identity IGA—directly in Slack.",
  longDescription:
    "Ping IGA for Slack allows users to search the PingOne Advanced Identity Cloud Identity Governance catalog, request access for themselves or teammates, and monitor request status—all without leaving Slack.",
  backgroundColor: "#005EB8",
  majorVersion: 1,
  minorVersion: 0,
  author: "Ping Identity",
  supportUrl: "https://support.pingidentity.com",
  privacyPolicyUrl: "https://www.pingidentity.com/en/legal/privacy.html",
  termsOfServiceUrl: "https://www.pingidentity.com/en/legal/terms.html",
  botScopes: [
    "app_home:read",
    "app_home:write",
    "chat:write",
    "commands",
    "conversations:read",
    "im:history",
    "im:write",
    "metadata.read",
    "users:read",
    "users:read.email",
    "views:write",
  ],
  datastores: [requestsDatastore],
  workflows: [catalogRequestWorkflow, renderAppHomeWorkflow],
  slashCommands: [
    {
      command: "/iga",
      description: "Search Ping IGA catalog and request access",
      shouldEscape: false,
      usageHint: "/iga [search term]",
      workflow: "catalog_request",
    },
  ],
  shortcuts: [
    {
      name: "Search IGA Catalog",
      description: "Find access items in Ping IGA",
      type: "global",
      workflow: "catalog_request",
      callbackId: "iga_search_shortcut",
    },
    {
      name: "Request Access for User",
      description: "Request access for someone mentioned in a message",
      type: "message",
      workflow: "catalog_request",
      callbackId: "iga_request_shortcut",
    },
  ],
  events: [
    {
      event: "app_home_opened",
      name: "App Home opened",
      description: "Render the Ping IGA home tab",
      type: "event",
      channelType: "app_home",
      workflow: "render_app_home",
    },
  ],
});
