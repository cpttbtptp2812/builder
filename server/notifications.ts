export type NotificationMessage = {
  title: string;
  body: string;
  severity?: "info" | "warning" | "critical";
  url?: string;
  fields?: Record<string, string | number | boolean | null>;
};

export type NotificationChannel = "feishu" | "slack" | "email";
export type NotificationStatus = "sent" | "skipped" | "failed";

export type NotificationResult = {
  channel: NotificationChannel;
  status: NotificationStatus;
  sent: boolean;
  statusCode?: number;
  detail?: string;
};

type FetchLike = typeof fetch;

function validateWebhookUrl(value: string, channel: NotificationChannel): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${channel} webhook URL is invalid`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${channel} webhook URL must use http or https`);
  }
  return url.toString();
}

function failed(
  channel: NotificationChannel,
  detail: string,
  statusCode?: number,
): NotificationResult {
  return { channel, status: "failed", sent: false, statusCode, detail };
}

function sent(channel: NotificationChannel, statusCode: number): NotificationResult {
  return { channel, status: "sent", sent: true, statusCode };
}

function fieldLines(fields: NotificationMessage["fields"]): string[] {
  if (!fields) return [];
  return Object.entries(fields).map(([key, value]) => `**${key}:** ${String(value ?? "")}`);
}

async function responsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function readNumericCode(payload: unknown, keys: string[]): number | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function payloadDetail(payload: unknown): string | undefined {
  if (typeof payload === "string") return payload.slice(0, 300);
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const value = record.message ?? record.msg ?? record.error;
  return typeof value === "string" ? value.slice(0, 300) : undefined;
}

export async function sendFeishuWebhook(
  webhookUrl: string,
  message: NotificationMessage,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<NotificationResult> {
  const channel = "feishu";
  let url: string;
  try {
    url = validateWebhookUrl(webhookUrl, channel);
  } catch (error) {
    return failed(channel, error instanceof Error ? error.message : String(error));
  }
  try {
    const content = [message.body, ...fieldLines(message.fields), message.url ?? ""]
      .filter(Boolean)
      .join("\n");
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "post",
        content: {
          post: {
            zh_cn: {
              title: message.title,
              content: [[{ tag: "text", text: content }]],
            },
          },
        },
      }),
      signal: options.signal,
    });
    const payload = await responsePayload(response);
    if (!response.ok) {
      return failed(
        channel,
        payloadDetail(payload) ?? `Webhook returned HTTP ${response.status}`,
        response.status,
      );
    }
    const code = readNumericCode(payload, ["code", "StatusCode"]);
    if (code !== undefined && code !== 0) {
      return failed(
        channel,
        payloadDetail(payload) ?? `Webhook returned application code ${code}`,
        response.status,
      );
    }
    return sent(channel, response.status);
  } catch (error) {
    return failed(channel, error instanceof Error ? error.message : String(error));
  }
}

export async function sendSlackWebhook(
  webhookUrl: string,
  message: NotificationMessage,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<NotificationResult> {
  const channel = "slack";
  let url: string;
  try {
    url = validateWebhookUrl(webhookUrl, channel);
  } catch (error) {
    return failed(channel, error instanceof Error ? error.message : String(error));
  }
  try {
    const fieldText = fieldLines(message.fields).join("\n");
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message.title,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: message.title.slice(0, 150) },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [message.body, fieldText, message.url ? `<${message.url}|Open>` : ""]
                .filter(Boolean)
                .join("\n"),
            },
          },
        ],
      }),
      signal: options.signal,
    });
    const payload = await responsePayload(response);
    if (!response.ok) {
      return failed(
        channel,
        payloadDetail(payload) ?? `Webhook returned HTTP ${response.status}`,
        response.status,
      );
    }
    if (typeof payload === "string" && payload.trim().toLowerCase() !== "ok") {
      return failed(channel, payload.slice(0, 300), response.status);
    }
    if (
      payload &&
      typeof payload === "object" &&
      (payload as Record<string, unknown>).ok === false
    ) {
      return failed(
        channel,
        payloadDetail(payload) ?? "Slack rejected the webhook request",
        response.status,
      );
    }
    return sent(channel, response.status);
  } catch (error) {
    return failed(channel, error instanceof Error ? error.message : String(error));
  }
}

export async function sendEmailNotification(
  message: NotificationMessage & { to: string | string[] },
  options: {
    endpoint?: string;
    authorization?: string;
    fetchImpl?: FetchLike;
    signal?: AbortSignal;
  } = {},
): Promise<NotificationResult> {
  const channel = "email";
  const configuredEndpoint =
    options.endpoint?.trim() || process.env.EMAIL_NOTIFICATION_ENDPOINT?.trim();
  if (!configuredEndpoint) {
    return {
      channel,
      status: "skipped",
      sent: false,
      detail: "EMAIL_NOTIFICATION_ENDPOINT is not configured",
    };
  }
  let endpoint: string;
  try {
    endpoint = validateWebhookUrl(configuredEndpoint, channel);
  } catch (error) {
    return failed(channel, error instanceof Error ? error.message : String(error));
  }
  const authorization =
    options.authorization ?? process.env.EMAIL_NOTIFICATION_AUTHORIZATION;
  try {
    const response = await (options.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify({
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.title,
        text: message.body,
        severity: message.severity ?? "info",
        url: message.url,
        fields: message.fields,
      }),
      signal: options.signal,
    });
    const payload = await responsePayload(response);
    if (!response.ok) {
      return failed(
        channel,
        payloadDetail(payload) ?? `Email endpoint returned HTTP ${response.status}`,
        response.status,
      );
    }
    if (
      payload &&
      typeof payload === "object" &&
      ((payload as Record<string, unknown>).ok === false ||
        (payload as Record<string, unknown>).sent === false)
    ) {
      return failed(
        channel,
        payloadDetail(payload) ?? "Email endpoint did not send the message",
        response.status,
      );
    }
    return sent(channel, response.status);
  } catch (error) {
    return failed(channel, error instanceof Error ? error.message : String(error));
  }
}

export async function sendGovernanceNotifications(
  message: NotificationMessage,
  config: {
    feishuWebhookUrl?: string;
    slackWebhookUrl?: string;
    email?: {
      to: string | string[];
      endpoint?: string;
      authorization?: string;
    };
    fetchImpl?: FetchLike;
    signal?: AbortSignal;
  },
): Promise<NotificationResult[]> {
  const sends: Promise<NotificationResult>[] = [];
  if (config.feishuWebhookUrl) {
    sends.push(
      sendFeishuWebhook(config.feishuWebhookUrl, message, {
        fetchImpl: config.fetchImpl,
        signal: config.signal,
      }),
    );
  }
  if (config.slackWebhookUrl) {
    sends.push(
      sendSlackWebhook(config.slackWebhookUrl, message, {
        fetchImpl: config.fetchImpl,
        signal: config.signal,
      }),
    );
  }
  if (config.email) {
    sends.push(
      sendEmailNotification(
        { ...message, to: config.email.to },
        {
          endpoint: config.email.endpoint,
          authorization: config.email.authorization,
          fetchImpl: config.fetchImpl,
          signal: config.signal,
        },
      ),
    );
  }
  return Promise.all(sends);
}

