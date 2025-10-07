export interface CatalogItem {
  id: string;
  label: string;
  description?: string;
  type?: string;
}

export interface CreateRequestPayload {
  requestedFor: string;
  requestedBy: string;
  requesterEmail?: string;
  justification?: string;
  catalogItemId: string;
  catalogItemLabel: string;
}

export interface CreateRequestResponse {
  requestId: string;
  status: string;
}

interface PingIgaConfig {
  baseUrl: string;
  tokenUrl?: string;
  searchPath?: string;
  requestPath?: string;
  requestStatusPath?: string;
  clientId: string;
  clientSecret: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const FALLBACK_ITEMS: CatalogItem[] = [
  {
    id: "app_salesforce",
    label: "Salesforce",
    description: "CRM access profile",
    type: "application",
  },
  {
    id: "ent_marketing_analytics",
    label: "Marketing Analytics",
    description: "Read-only dashboard access",
    type: "entitlement",
  },
  {
    id: "role_finance_approver",
    label: "Finance Approver",
    description: "Approve finance workflows",
    type: "role",
  },
];

export class PingIgaClient {
  #client: any;
  #config?: PingIgaConfig;
  #token?: { value: string; expiresAt: number };

  constructor(client: any) {
    this.#client = client;
  }

  async searchCatalog(query: string): Promise<CatalogItem[]> {
    const config = await this.#getConfig();
    if (!config) {
      return this.#filterFallback(query);
    }

    try {
      const token = await this.#getToken(config);
      const url = new URL(config.searchPath ?? "/v1/catalog-items", config.baseUrl);
      if (query) {
        url.searchParams.set("search", query);
      }
      const response = await fetch(url, {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Ping IGA search failed", response.status, await response.text());
        return this.#filterFallback(query);
      }

      const body = await response.json();
      if (Array.isArray(body?.items)) {
        return body.items.map((item: Record<string, unknown>) => ({
          id: String(item.id ?? item.itemId ?? ""),
          label: String(item.displayName ?? item.name ?? item.label ?? ""),
          description: typeof item.description === "string" ? item.description : undefined,
          type: typeof item.type === "string" ? item.type : undefined,
        })).filter((item) => item.id && item.label);
      }

      return this.#filterFallback(query);
    } catch (error) {
      console.error("Ping IGA search error", error);
      return this.#filterFallback(query);
    }
  }

  async createRequest(payload: CreateRequestPayload): Promise<CreateRequestResponse> {
    const config = await this.#getConfig();
    if (!config) {
      return {
        requestId: `demo-${crypto.randomUUID()}`,
        status: "PENDING",
      };
    }

    try {
      const token = await this.#getToken(config);
      const url = new URL(config.requestPath ?? "/v1/requests", config.baseUrl);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          catalogItemId: payload.catalogItemId,
          catalogItemLabel: payload.catalogItemLabel,
          requestedFor: payload.requestedFor,
          requestedBy: payload.requestedBy,
          requesterEmail: payload.requesterEmail,
          justification: payload.justification,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Ping IGA create request failed", response.status, errorBody);
        throw new Error(
          `Ping IGA returned ${response.status} when creating the request. ${errorBody}`,
        );
      }

      const body = await response.json();
      return {
        requestId: String(body.id ?? body.requestId ?? crypto.randomUUID()),
        status: String(body.status ?? body.state ?? "PENDING"),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Unable to submit request to Ping IGA");
    }
  }

  async getRequestStatus(requestId: string): Promise<string | undefined> {
    const config = await this.#getConfig();
    if (!config) {
      return undefined;
    }

    try {
      const token = await this.#getToken(config);
      const pathTemplate = config.requestStatusPath ?? `/v1/requests/${encodeURIComponent(requestId)}`;
      const url = new URL(pathTemplate, config.baseUrl);
      const response = await fetch(url, {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Ping IGA get request failed", response.status, await response.text());
        return undefined;
      }

      const body = await response.json();
      return typeof body.status === "string"
        ? body.status
        : typeof body.state === "string"
        ? body.state
        : undefined;
    } catch (error) {
      console.error("Ping IGA status error", error);
      return undefined;
    }
  }

  async #getConfig(): Promise<PingIgaConfig | undefined> {
    if (this.#config) return this.#config;

    try {
      const baseUrl = await this.#getSecret("PING_IGA_BASE_URL");
      const clientId = await this.#getSecret("PING_IGA_CLIENT_ID");
      const clientSecret = await this.#getSecret("PING_IGA_CLIENT_SECRET");
      if (!baseUrl || !clientId || !clientSecret) {
        console.warn("Missing Ping IGA secrets; falling back to demo mode");
        return undefined;
      }

      this.#config = {
        baseUrl,
        clientId,
        clientSecret,
        tokenUrl: await this.#getSecret("PING_IGA_TOKEN_URL"),
        searchPath: await this.#getSecret("PING_IGA_SEARCH_PATH"),
        requestPath: await this.#getSecret("PING_IGA_REQUEST_PATH"),
        requestStatusPath: await this.#getSecret("PING_IGA_REQUEST_STATUS_PATH"),
      };
      return this.#config;
    } catch (error) {
      console.error("Unable to load Ping IGA configuration", error);
      return undefined;
    }
  }

  async #getToken(config: PingIgaConfig): Promise<string> {
    const now = Date.now();
    if (this.#token && this.#token.expiresAt > now + 30_000) {
      return this.#token.value;
    }

    const tokenUrl = config.tokenUrl
      ? new URL(config.tokenUrl)
      : new URL("/as/token", config.baseUrl);

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      throw new Error(`Unable to obtain Ping IGA access token: ${response.status}`);
    }

    const body = (await response.json()) as TokenResponse;
    const tokenType = body.token_type ?? "Bearer";
    const expiresIn = typeof body.expires_in === "number" ? body.expires_in * 1000 : 300_000;
    this.#token = {
      value: `${tokenType} ${body.access_token}`.trim(),
      expiresAt: Date.now() + expiresIn,
    };
    return this.#token.value;
  }

  async #getSecret(name: string): Promise<string | undefined> {
    try {
      const response = await this.#client.apps.secrets.get({ name });
      return response?.secret?.value;
    } catch (error) {
      console.error(`Unable to read secret ${name}`, error);
      return undefined;
    }
  }

  #filterFallback(query: string): CatalogItem[] {
    if (!query) return FALLBACK_ITEMS;
    const lower = query.toLowerCase();
    return FALLBACK_ITEMS.filter((item) =>
      item.label.toLowerCase().includes(lower) || item.description?.toLowerCase().includes(lower)
    );
  }
}
