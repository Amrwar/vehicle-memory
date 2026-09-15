/**
 * Getting a message out while somebody is still looking at the screen.
 *
 * Everything the product sends is written to `message_logs` and drained by a
 * scheduled job. That is the right shape: one place decides quiet hours,
 * suppression, retries and which provider carries which channel, and a crash
 * loses nothing.
 *
 * The problem is how often the sweep runs. On the current hosting plan a
 * scheduled job fires once a day, which is fine for a service reminder and
 * useless for anything a person is waiting on. Somebody who signs up and is
 * told to check their inbox, and finds the link there tomorrow morning, has
 * already decided the product does not work.
 *
 * So flows where a human is waiting queue the row and then call this. The queue
 * is still the record and still the retry path; this only removes the wait.
 *
 * Two things are deliberate. It never throws, because whether a provider
 * answered in that particular second must not decide whether an account was
 * created. And it is a dynamic import, because the sending package pulls in
 * transport configuration that has no business loading on every page render.
 */
export async function pushNow(messageId: string): Promise<void> {
  try {
    const { sendMessageNow } = await import('@carnet/jobs');
    await sendMessageNow(messageId);
  } catch {
    // The row stays QUEUED and the sweep collects it, exactly as before.
  }

  // Onto the customer's thread, whatever became of the send. Filing never
  // decides whether a message goes; it only says where it is read. Phase 36.
  try {
    const { fileOutbound } = await import('./conversations');
    await fileOutbound(messageId);
  } catch {
    // Unfiled is collected the next time a thread is opened.
  }
}
