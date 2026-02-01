import { prisma } from '../lib/prisma';
import axios from 'axios';

/**
 * Send webhook event to agent
 */
export async function sendWebhookEvent(
  agentId: string,
  event: string,
  data: any
): Promise<void> {
  // Get agent's webhook URL
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { webhook_url: true },
  });

  if (!agent?.webhook_url) {
    return; // Agent doesn't have webhook configured
  }

  // Create webhook record
  const webhook = await prisma.webhook.create({
    data: {
      agent_id: agentId,
      event_type: event,
      payload: data,
      url: agent.webhook_url,
      status: 'pending',
    },
  });

  // Send webhook (async, don't wait)
  deliverWebhook(webhook.id, agent.webhook_url, event, data).catch((error) => {
    console.error(`Webhook delivery failed for ${webhook.id}:`, error);
  });
}

/**
 * Deliver webhook with retry logic
 */
async function deliverWebhook(
  webhookId: string,
  url: string,
  event: string,
  data: any
): Promise<void> {
  const maxRetries = parseInt(process.env.WEBHOOK_RETRY_MAX_ATTEMPTS || '3');
  const retryDelay = parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '1000');

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await axios.post(
        url,
        {
          event,
          timestamp: new Date().toISOString(),
          data,
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SWARM-Board-Webhook/1.0',
          },
        }
      );

      // Success - update webhook status
      await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          status: 'sent',
          last_retry_at: new Date(),
        },
      });

      return;
    } catch (error: any) {
      lastError = error;
      console.error(`Webhook attempt ${attempt + 1} failed:`, error.message);

      // Update retry count
      await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          retry_count: attempt + 1,
          last_retry_at: new Date(),
        },
      });

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * Math.pow(2, attempt))
        );
      }
    }
  }

  // All retries failed
  await prisma.webhook.update({
    where: { id: webhookId },
    data: {
      status: 'failed',
    },
  });

  throw new Error(`Webhook delivery failed after ${maxRetries} attempts`);
}

/**
 * Notify team members about an event
 */
export async function notifyTeamMembers(
  teamId: string,
  event: string,
  data: any,
  excludeAgentId?: string
): Promise<void> {
  const members = await prisma.teamMember.findMany({
    where: {
      team_id: teamId,
      agent_id: excludeAgentId ? { not: excludeAgentId } : undefined,
    },
    include: {
      agent: {
        select: {
          id: true,
          webhook_url: true,
        },
      },
    },
  });

  // Send webhooks to all team members
  const promises = members
    .filter((m) => m.agent.webhook_url)
    .map((m) => sendWebhookEvent(m.agent.id, event, data));

  await Promise.allSettled(promises);
}
