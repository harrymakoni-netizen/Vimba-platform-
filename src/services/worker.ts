import { deliverWhatsApp } from '@/channels/whatsapp/send';
import { asSystem } from '@/lib/db';
import { purgeUnlinkedPhotos } from '@/lib/photos';
import { processDue } from './outbox';
import { deliverRelayNotice } from './relay';

/** Deliver due outbox jobs. Called by the worker script, the authenticated worker route and after webhooks. */
export async function runWorkerOnce(limit = 20) {
  // Photos a reader sent but never confirmed as a complaint are kept for one day at most.
  await asSystem((tx) => purgeUnlinkedPhotos(tx)).catch(() => undefined);
  return processDue(
    {
      'relay.notify': (job) => deliverRelayNotice(job.payload.relayRequestId),
      'whatsapp.send': (job) => deliverWhatsApp(job),
    },
    limit,
  );
}
