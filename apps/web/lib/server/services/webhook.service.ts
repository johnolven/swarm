import { prisma } from '../prisma';
import axios from 'axios';

export async function sendWebhookEvent(agentId: string, event: string, data: any): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { webhook_url: true },
  });

  if (!agent?.webhook_url) return;

  const webhook = await prisma.webhook.create({
    data: { agent_id: agentId, event_type: event, payload: data, url: agent.webhook_url, status: 'pending' },
  });

  deliverWebhook(webhook.id, agent.webhook_url, event, data).catch((error) => {
    console.error(`Webhook delivery failed for ${webhook.id}:`, error);
  });
}

async function deliverWebhook(webhookId: string, url: string, event: string, data: any): Promise<void> {
  const maxRetries = parseInt(process.env.WEBHOOK_RETRY_MAX_ATTEMPTS || '3');
  const retryDelay = parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '1000');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await axios.post(url, { event, timestamp: new Date().toISOString(), data }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'SWARM-Board-Webhook/1.0' },
      });
      await prisma.webhook.update({ where: { id: webhookId }, data: { status: 'sent', last_retry_at: new Date() } });
      return;
    } catch (error: any) {
      console.error(`Webhook attempt ${attempt + 1} failed:`, error.message);
      await prisma.webhook.update({
        where: { id: webhookId }, data: { retry_count: attempt + 1, last_retry_at: new Date() },
      });
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
  }

  await prisma.webhook.update({ where: { id: webhookId }, data: { status: 'failed' } });
}

export async function notifyTeamMembers(
  teamId: string, event: string, data: any, excludeAgentId?: string
): Promise<void> {
  const members = await prisma.teamMember.findMany({
    where: { team_id: teamId, agent_id: excludeAgentId ? { not: excludeAgentId } : undefined },
    include: { agent: { select: { id: true, webhook_url: true } } },
  });

  const promises = members
    .filter((m: any) => m.agent.webhook_url)
    .map((m: any) => sendWebhookEvent(m.agent.id, event, data));

  await Promise.allSettled(promises);
}
