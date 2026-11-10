import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toE164SA } from "@/lib/phone";

export interface SmsProviderAdapter {
  sendMessage(recipient: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

type ProviderConfig = { apiKey?: string; apiSecret?: string; senderId?: string };
type Channel = "sms" | "whatsapp";

const responseError = async (response: Response) => {
  const body = await response.text().catch(() => "");
  return body.slice(0, 500) || `Provider returned HTTP ${response.status}`;
};

class MockLogAdapter implements SmsProviderAdapter {
  async sendMessage(recipient: string, message: string) {
    console.info("[EduSync mock SMS]", { recipient, message: message.slice(0, 160) });
    return { success: true, messageId: `mock-${crypto.randomUUID()}` };
  }
}

class BulkSmsAdapter implements SmsProviderAdapter {
  constructor(private config: ProviderConfig) {}
  async sendMessage(recipient: string, message: string) {
    if (recipient.startsWith("whatsapp:")) return { success: false, error: "BulkSMS adapter supports SMS only; configure Twilio for WhatsApp." };
    const auth = btoa(`${this.config.apiKey}:${this.config.apiSecret}`);
    const response = await fetch("https://api.bulksms.com/v1/messages", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: recipient, body: message, ...(this.config.senderId ? { from: this.config.senderId } : {}) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { success: false, error: await responseError(response) };
    const result = await response.json().catch(() => ({})) as { id?: string;[key: string]: unknown };
    return { success: true, messageId: result.id };
  }
}

class AfricasTalkingAdapter implements SmsProviderAdapter {
  constructor(private config: ProviderConfig) {}
  async sendMessage(recipient: string, message: string) {
    if (recipient.startsWith("whatsapp:")) return { success: false, error: "Africa's Talking adapter supports SMS only; configure Twilio for WhatsApp." };
    const form = new URLSearchParams({ username: this.config.apiKey ?? "", to: recipient, message });
    if (this.config.senderId) form.set("from", this.config.senderId);
    const response = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: { apiKey: this.config.apiSecret ?? "", Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { success: false, error: await responseError(response) };
    const result = await response.json().catch(() => ({})) as { SMSMessageData?: { Recipients?: Array<{ messageId?: string; status?: string }> } };
    const recipientResult = result.SMSMessageData?.Recipients?.[0];
    if (recipientResult?.status && !/success/i.test(recipientResult.status)) return { success: false, error: recipientResult.status };
    return { success: true, messageId: recipientResult?.messageId };
  }
}

class TwilioAdapter implements SmsProviderAdapter {
  constructor(private config: ProviderConfig) {}
  async sendMessage(recipient: string, message: string) {
    const sid = this.config.apiKey ?? "";
    const auth = btoa(`${sid}:${this.config.apiSecret}`);
    const whatsapp = recipient.startsWith("whatsapp:");
    const to = whatsapp ? recipient : recipient;
    const from = this.config.senderId ? (whatsapp && !this.config.senderId.startsWith("whatsapp:") ? `whatsapp:${this.config.senderId}` : this.config.senderId) : "";
    if (!from) return { success: false, error: "SMS_SENDER_ID must contain the Twilio sender number (or WhatsApp-enabled sender)." };
    const form = new URLSearchParams({ To: to, From: from, Body: message });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { success: false, error: await responseError(response) };
    const result = await response.json().catch(() => ({})) as { sid?: string };
    return { success: true, messageId: result.sid };
  }
}

function createSmsProvider(): SmsProviderAdapter {
  const provider = (process.env.SMS_PROVIDER ?? "").toLowerCase();
  const config = { apiKey: process.env.SMS_API_KEY, apiSecret: process.env.SMS_API_SECRET, senderId: process.env.SMS_SENDER_ID };
  if (provider === "mock") return new MockLogAdapter();
  const credentialsReady = provider === "twilio"
    ? Boolean(config.apiKey && config.apiSecret && config.senderId)
    : Boolean(config.apiKey && config.apiSecret);
  if (process.env.NODE_ENV !== "production" && !credentialsReady) return new MockLogAdapter();
  if (provider === "bulksms" && credentialsReady) return new BulkSmsAdapter(config);
  if (provider === "africastalking" && credentialsReady) return new AfricasTalkingAdapter(config);
  if (provider === "twilio" && credentialsReady) return new TwilioAdapter(config);
  throw new Error("SMS provider is not configured. Set SMS_PROVIDER, SMS_API_KEY, SMS_API_SECRET and SMS_SENDER_ID as required.");
}

export const dispatchOutboundQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { schoolId: string }) => {
    if (!input?.schoolId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.schoolId)) {
      throw new Error("A valid school ID is required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("school_id", data.schoolId);
    if (roleError) throw new Error("Could not verify school permissions");
    const allowed = new Set(["school_admin", "teacher", "clerk"]);
    if (!(roles ?? []).some((row) => allowed.has(row.role))) throw new Error("You are not authorised to dispatch messages for this school");

    // Validate provider configuration before claiming rows; otherwise a missing secret could strand jobs in processing.
    const adapter = createSmsProvider();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claimed, error: claimError } = await (supabaseAdmin as any).rpc("claim_outbound_messages", {
      p_school_id: data.schoolId,
      p_limit: 50,
    });
    if (claimError) throw new Error("Could not safely claim the outbound queue");
    const messages = (claimed ?? []) as Array<{
      id: string; channel: Channel; recipient_phone: string | null; body: string; retry_count: number;
    }>;
    if (!messages.length) return { claimed: 0, sent: 0, failed: 0 };

    let sent = 0;
    let failed = 0;
    for (const item of messages) {
      const phone = toE164SA(item.recipient_phone ?? "");
      let result: { success: boolean; messageId?: string; error?: string };
      if (!phone) {
        result = { success: false, error: "Recipient phone number is missing or is not a valid South African mobile number." };
      } else {
        try {
          result = await adapter.sendMessage(item.channel === "whatsapp" ? `whatsapp:${phone}` : phone, item.body);
        } catch (error) {
          result = { success: false, error: error instanceof Error ? error.message : "Provider request failed" };
        }
      }
      const update = result.success
        ? { status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.messageId ?? null, last_error: null }
        : { status: "failed", last_error: (result.error ?? "Delivery failed").slice(0, 1000), retry_count: item.retry_count + 1 };
      const { error: updateError } = await supabaseAdmin.from("outbound_messages").update(update).eq("id", item.id).eq("school_id", data.schoolId).eq("status", "processing");
      if (updateError) {
        console.error("[EduSync] Could not persist outbound delivery result", { id: item.id, error: updateError.message });
        failed++;
      } else if (result.success) sent++;
      else failed++;
    }
    return { claimed: messages.length, sent, failed };
  });
