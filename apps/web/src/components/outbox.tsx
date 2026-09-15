'use client';

import { useCallback, useEffect, useState } from 'react';

import { useT } from '@/components/language-provider';

/**
 * What a device holds when there is no signal.
 *
 * IndexedDB rather than local storage, for one reason that matters and one
 * that will. It survives the browser deciding to reclaim memory from a tab
 * left open under a car all afternoon, and it has room for the photographs
 * this will eventually hold, which local storage does not.
 *
 * Every queued action carries an id generated here, before anything is sent.
 * That id is the only thing that makes a retry safe: a flush interrupted
 * halfway would otherwise write the whole morning again when the signal came
 * back.
 *
 * Nothing is removed from the queue until the server has said what happened to
 * it. An action the server refused stays, with the reason attached, because
 * the person holding the device is the one who has to decide what to do about
 * it and a silent deletion is indistinguishable from work that never happened.
 */

const DB = 'carnet-outbox';
const STORE = 'actions';

export interface OutboxAction {
  clientId: string;
  type: string;
  at: string;
  subjectId: string;
  payload: Record<string, unknown>;
  /** Set once the server has refused it, and kept on the device. */
  problem?: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'clientId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function all(): Promise<OutboxAction[]> {
  const database = await open();

  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as OutboxAction[]);
    request.onerror = () => reject(request.error);
  });
}

async function put(action: OutboxAction): Promise<void> {
  const database = await open();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(action);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function drop(clientIds: readonly string[]): Promise<void> {
  if (clientIds.length === 0) return;

  const database = await open();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    for (const id of clientIds) store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/** An id this device generated, unique enough that two devices cannot collide. */
function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Queues one action, whether or not there is a signal.
 *
 * Always queued first and sent second, never the other way round. A click that
 * went straight to the network and only fell back to the queue on failure
 * would lose whatever was in flight when the tab was closed.
 */
export async function enqueue(
  type: string,
  subjectId: string,
  payload: Record<string, unknown> = {},
): Promise<string> {
  const action: OutboxAction = {
    clientId: newId(),
    type,
    at: new Date().toISOString(),
    subjectId,
    payload,
  };

  await put(action);
  window.dispatchEvent(new CustomEvent('carnet:queued'));

  return action.clientId;
}

interface FlushResponse {
  results: { clientId: string; outcome: { status: string; reason?: string } }[];
  message: string;
}

/**
 * Sends everything waiting, and keeps whatever the server would not take.
 *
 * Actions already carrying a problem are sent again. The state they conflicted
 * with may have been sorted out by somebody in the office since, and a device
 * that gave up on its first refusal would need a person to know it was holding
 * anything at all.
 */
export async function flushOutbox(): Promise<string | null> {
  const waiting = await all();
  if (waiting.length === 0) return null;

  const response = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      actions: waiting.map(({ problem: _problem, ...action }) => action),
    }),
  });

  if (!response.ok) return null;

  const body = (await response.json()) as FlushResponse;

  const settled: string[] = [];

  for (const result of body.results) {
    if (result.outcome.status === 'APPLIED' || result.outcome.status === 'DUPLICATE') {
      settled.push(result.clientId);
      continue;
    }

    const held = waiting.find((action) => action.clientId === result.clientId);
    if (held) await put({ ...held, problem: result.outcome.reason ?? 'Refused.' });
  }

  await drop(settled);
  window.dispatchEvent(new CustomEvent('carnet:queued'));

  return body.message;
}

/**
 * The strip along the top of the shop floor.
 *
 * It says three things and nothing else: whether there is a signal, how much
 * is waiting, and what the last flush said. A technician glances at this with
 * gloves on, and anything more would be read as decoration.
 */
export function OutboxStatus() {
  const t = useT();
  const [online, setOnline] = useState(true);
  const [waiting, setWaiting] = useState(0);
  const [problems, setProblems] = useState<OutboxAction[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const queued = await all();
      setWaiting(queued.length);
      setProblems(queued.filter((action) => action.problem));
    } catch {
      // A browser with storage disabled cannot queue anything. The strip says
      // nothing rather than claiming an empty queue, which would be a lie
      // somebody might rely on.
      setWaiting(0);
    }
  }, []);

  const send = useCallback(async () => {
    setBusy(true);
    try {
      const said = await flushOutbox();
      if (said) setMessage(said);
    } catch {
      setMessage('Could not reach the workshop. Everything is still here.');
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh();

    const up = () => {
      setOnline(true);
      void send();
    };
    const down = () => setOnline(false);

    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    window.addEventListener('carnet:queued', refresh);

    // Registered from the page rather than the layout, so the worker only ever
    // exists for people who open the shop floor.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/shop' }).catch(() => undefined);
    }

    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      window.removeEventListener('carnet:queued', refresh);
    };
  }, [refresh, send]);

  if (online && waiting === 0 && !message) return null;

  return (
    <div
      className={`mb-4 rounded-(--radius-lg) border px-4 py-3 text-[15px] ${
        online ? 'border-(--border) bg-(--surface)' : 'border-(--warning) bg-(--surface)'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${online ? 'bg-(--success)' : 'bg-(--warning)'}`}
          aria-hidden
        />
        <span className="font-medium">
          {online ? t('Connected') : t('No signal. Carry on; nothing is lost.')}
        </span>

        {waiting > 0 ? (
          <span className="text-(--text-soft)">
            {problems.length > 0
              ? t('{waiting} waiting to send, {problems} needing a decision', {
                  waiting,
                  problems: problems.length,
                })
              : t('{waiting} waiting to send', { waiting })}
          </span>
        ) : null}

        {online && waiting > 0 ? (
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="ms-auto min-h-[44px] rounded-(--radius) border border-(--border) px-4 text-[15px] font-medium disabled:opacity-60"
          >
            {busy ? t('Sending…') : t('Send now')}
          </button>
        ) : null}
      </div>

      {message ? <p className="mt-2 text-[14px] text-(--text-soft)">{t(message)}</p> : null}

      {problems.length > 0 ? (
        <ul className="mt-2 grid gap-1.5 text-[14px] text-(--warning)">
          {problems.map((action) => (
            <li key={action.clientId}>{t(action.problem ?? '')}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
