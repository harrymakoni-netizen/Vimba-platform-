import { deliverWhatsApp } from '@/channels/whatsapp/send';
import { processDue } from './outbox';
import { deliverRelayNotice } from './relay';

/** Deliver due outbox jobs. Called by the worker script, the authenticated worker route and after webhooks. */
export function runWorkerOnce(limit = 20) {
  return processDue(
    {
      'relay.notify': (job) => deliverRelayNotice(job.payload.relayRequestId),
      'whatsapp.send': (job) => deliverWhatsApp(job),
    },
    limit,
  );
}
