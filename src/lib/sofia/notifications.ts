/**
 * Sofia Real-Time Notifications
 * Send WhatsApp alerts to team for hot leads
 */

import { ScoringResult } from "./scoring";
import { MentalModelProfile } from "./mentalModels";

export interface NotificationPayload {
  type: "hot_lead" | "whale" | "escalation_ready" | "booking_intent";
  urgency: "critical" | "high" | "medium";
  sessionId: string;
  score: number;
  quality: string;
  businessType?: string;
  mentalModel?: string;
  signals: string[];
  lastMessage: string;
  timestamp: Date;
}

// Notification recipients from environment
const RECIPIENTS = [
  { name: "Philip", phone: process.env.PHILIP_PHONE || "+19544451638" },
  { name: "Sergio", phone: process.env.NOTIFY_PHONE || "+17024092818" },
];

const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+17543183430";

/**
 * Send WhatsApp notification to team
 */
export async function sendTeamNotification(
  payload: NotificationPayload,
): Promise<boolean> {
  // Check for Twilio credentials
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.log(
      "[Sofia Notifications] Twilio not configured, skipping notification",
    );
    return false;
  }

  const emoji = {
    hot_lead: "🔥",
    whale: "🐋",
    escalation_ready: "📞",
    booking_intent: "📅",
  };

  const urgencyBadge = {
    critical: "🚨 CRITICAL",
    high: "⚡ HIGH",
    medium: "📊 MEDIUM",
  };

  // Build message
  const message = `${emoji[payload.type]} *SOFIA ALERT*
${urgencyBadge[payload.urgency]}

*Score:* ${payload.score}/100 (${payload.quality.toUpperCase()})
*Type:* ${payload.type.replace("_", " ").toUpperCase()}
${payload.businessType ? `*Business:* ${payload.businessType}` : ""}
${payload.mentalModel ? `*Profile:* ${payload.mentalModel}` : ""}

*Signals:*
${payload.signals
  .slice(0, 5)
  .map((s) => `• ${s}`)
  .join("\n")}

*Last Message:*
"${payload.lastMessage.slice(0, 200)}${payload.lastMessage.length > 200 ? "..." : ""}"

*Session:* ${payload.sessionId.slice(0, 20)}...
*Time:* ${payload.timestamp.toLocaleString("en-US", { timeZone: "America/New_York" })}`;

  // Send to each recipient
  const sendPromises = RECIPIENTS.map(async (recipient) => {
    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: TWILIO_FROM,
            To: `whatsapp:${recipient.phone}`,
            Body: message,
          }),
        },
      );

      if (!response.ok) {
        console.error(
          `[Sofia] Failed to notify ${recipient.name}:`,
          await response.text(),
        );
        return false;
      }

      console.log(
        `[Sofia] ✅ Notified ${recipient.name} about ${payload.type}`,
      );
      return true;
    } catch (error) {
      console.error(`[Sofia] Error notifying ${recipient.name}:`, error);
      return false;
    }
  });

  const results = await Promise.all(sendPromises);
  return results.some((r) => r); // Return true if at least one succeeded
}

/**
 * Determine if notification should be sent and build payload
 */
export function buildNotificationPayload(
  sessionId: string,
  score: ScoringResult,
  mentalModel: MentalModelProfile | null,
  lastUserMessage: string,
  businessType?: string,
): NotificationPayload | null {
  // Hot lead threshold
  if (score.total >= 75) {
    return {
      type: "hot_lead",
      urgency: score.total >= 85 ? "critical" : "high",
      sessionId,
      score: score.total,
      quality: score.quality,
      businessType,
      mentalModel: mentalModel?.type,
      signals: score.signals,
      lastMessage: lastUserMessage,
      timestamp: new Date(),
    };
  }

  // Explicit booking intent
  if (score.breakdown.bookingIntent >= 15) {
    return {
      type: "booking_intent",
      urgency: "high",
      sessionId,
      score: score.total,
      quality: score.quality,
      businessType,
      mentalModel: mentalModel?.type,
      signals: score.signals,
      lastMessage: lastUserMessage,
      timestamp: new Date(),
    };
  }

  // High engagement at gate 3
  if (score.gate >= 3 && score.total >= 50) {
    return {
      type: "escalation_ready",
      urgency: "medium",
      sessionId,
      score: score.total,
      quality: score.quality,
      businessType,
      mentalModel: mentalModel?.type,
      signals: score.signals,
      lastMessage: lastUserMessage,
      timestamp: new Date(),
    };
  }

  return null; // No notification needed
}

/**
 * Rate limit notifications (max 1 per session per 5 minutes)
 */
const notificationCache = new Map<string, number>();
const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function shouldSendNotification(sessionId: string): boolean {
  const lastNotification = notificationCache.get(sessionId);
  const now = Date.now();

  if (lastNotification && now - lastNotification < NOTIFICATION_COOLDOWN_MS) {
    return false;
  }

  notificationCache.set(sessionId, now);

  // Clean old entries
  for (const [key, time] of notificationCache.entries()) {
    if (now - time > NOTIFICATION_COOLDOWN_MS * 2) {
      notificationCache.delete(key);
    }
  }

  return true;
}
