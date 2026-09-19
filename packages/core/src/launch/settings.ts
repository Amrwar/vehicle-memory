/**
 * Whether a workshop can be put on this deployment. Phase 58.
 *
 * Everything else in this repository asks whether the product works. This asks
 * whether the copy of it in front of you has been configured to do anything,
 * which is a different question with a nastier failure.
 *
 * The nastiest category is not the one that stops the product. A missing
 * database stops the boot and somebody fixes it within the minute. A mail
 * transport left on `console` does not stop anything at all: every page works,
 * every button responds, every message is written into `message_logs` and
 * marked as queued, and not one customer hears a word. A workshop would run on
 * that for a fortnight before somebody noticed that nobody ever replies — and
 * what they would conclude is that the product is broken, because from where
 * they sit it is.
 *
 * So the settings are ranked by what a workshop would *feel*, rather than by
 * what an engineer would call severity:
 *
 *   silent    Looks entirely well and does nothing. The worst.
 *   stops     Nothing works, loudly, and somebody fixes it.
 *   pretend   Works, with money or data that is not real.
 *   degraded  Works, less well, in a way somebody would notice and live with.
 *   fine      A default that is a genuine choice rather than an omission.
 *
 * The register is checked against the application's own environment schema
 * rather than maintained beside it, because a list of settings kept by hand is
 * a list that falls behind the first time somebody adds one — and the first
 * anybody would learn of it is a workshop wondering why nothing sends.
 */

export type Consequence = 'silent' | 'stops' | 'pretend' | 'degraded' | 'fine';

/** Worst first, and `silent` is worst. */
export const SEVERITY: Record<Consequence, number> = {
  silent: 0,
  stops: 1,
  pretend: 2,
  degraded: 3,
  fine: 4,
};

export interface Setting {
  /** The variable's name, exactly as the environment schema spells it. */
  name: string;
  /** When it has to be set for a real workshop. */
  needed: 'always' | 'to send' | 'to take money' | 'for a network' | 'never';
  consequence: Consequence;
  /** What a workshop would feel, in a workshop's words rather than a log's. */
  felt: string;
  /** What to do about it. */
  set: string;
  /**
   * Values that are present and still mean "not configured".
   *
   * `MAIL_TRANSPORT=console` is the whole problem this file exists for: a
   * setting can be present, valid, and a lie about whether anything works.
   */
  pretendingIfEqual?: readonly string[];
}

export const SETTINGS: readonly Setting[] = [
  /* --- without these, nothing at all ---------------------------------------- */
  {
    name: 'DATABASE_URL',
    needed: 'always',
    consequence: 'stops',
    felt: 'Nothing opens. The product does not start.',
    set: 'The connection string for the workshop’s own database.',
  },
  {
    name: 'AUTH_SECRET',
    needed: 'always',
    consequence: 'stops',
    felt: 'Nobody can sign in, because no session can be signed.',
    set: 'At least 32 characters: openssl rand -base64 48',
  },
  {
    name: 'LEDGER_CHAIN_SALT',
    needed: 'always',
    consequence: 'stops',
    felt: 'Nothing starts. And once it is set it must never be rotated, or every passport chain ever written stops verifying.',
    set: 'At least 16 characters, generated once, kept for ever.',
  },
  {
    name: 'APP_URL',
    needed: 'always',
    consequence: 'silent',
    felt: 'Every link in every message points at the wrong place. A customer follows an approval link and lands on somebody else’s site, or on nothing.',
    set: 'The public address a customer would type, with https.',
    pretendingIfEqual: ['http://localhost:3000'],
  },

  /* --- without these, everything looks well and nobody hears anything ------- */
  {
    name: 'MAIL_TRANSPORT',
    needed: 'to send',
    consequence: 'silent',
    felt: 'Not one customer receives anything, ever, and the workshop has no way to tell. Every message is written down as queued and goes nowhere.',
    set: 'smtp, with the provider’s host and credentials.',
    pretendingIfEqual: ['console'],
  },
  {
    name: 'MAIL_FROM',
    needed: 'to send',
    consequence: 'degraded',
    felt: 'Messages arrive from an address that does not exist, so replies vanish and spam filters take a dim view.',
    set: 'A verified sending address at the workshop’s own domain.',
    pretendingIfEqual: ['Carnet <no-reply@carnet.local>'],
  },
  {
    name: 'SMS_TRANSPORT',
    needed: 'to send',
    consequence: 'silent',
    felt: 'No text message reaches anybody. Reminders and ready-for-collection notices are the ones that matter, and both go nowhere.',
    set: 'twilio, with its account and token.',
    pretendingIfEqual: ['console'],
  },
  {
    name: 'CRON_SECRET',
    needed: 'always',
    consequence: 'silent',
    felt: 'Two things at once: the scheduled work stops — no reminders, no queued messages, no alerts — and until it does, anybody on the internet can trigger it.',
    set: 'At least 16 characters, and the same value in the scheduler.',
  },
  {
    name: 'OPERATOR_EMAIL',
    needed: 'always',
    consequence: 'silent',
    felt: 'Nobody is told when a workshop signs up or when Carnet itself goes wrong. The first you hear of an incident is the telephone.',
    set: 'Whoever runs this, and reads their post.',
  },

  /* --- money that is not money ---------------------------------------------- */
  {
    name: 'PAYMENT_PROVIDER',
    needed: 'to take money',
    consequence: 'pretend',
    felt: 'Card payments take pretend money at a checkout page of ours. The invoice is marked paid and no money moved.',
    set: 'stripe, with the secret and webhook keys.',
    pretendingIfEqual: ['stub'],
  },
  {
    name: 'STRIPE_SECRET_KEY',
    needed: 'to take money',
    consequence: 'pretend',
    felt: 'As above: with no key, the provider is the stub whatever PAYMENT_PROVIDER says.',
    set: 'The live secret key. Set by whoever owns the account, not by this repository.',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    needed: 'to take money',
    consequence: 'silent',
    felt: 'Cards are charged and the product never learns. An invoice stays unpaid while the customer’s statement says otherwise, which is the worst disagreement in the product.',
    set: 'The signing secret from the webhook destination pointed at /api/payments/webhook.',
  },
  {
    name: 'PAYMENT_WEBHOOK_SECRET',
    needed: 'to take money',
    consequence: 'degraded',
    felt: 'The stub provider’s own webhook is unsigned. Harmless with real keys in place, because the stub is then unused.',
    set: 'Only needed while the stub is in use.',
  },
  {
    name: 'STRIPE_PRICE_CORE',
    needed: 'never',
    consequence: 'fine',
    felt: 'Without it the subscription checkout prices the plan inline from core, which is correct.',
    set: 'Optional: the provider’s own recurring price for the Core plan.',
  },
  {
    name: 'STRIPE_PRICE_COMPLETE',
    needed: 'never',
    consequence: 'fine',
    felt: 'As above, for Complete.',
    set: 'Optional.',
  },
  {
    name: 'STRIPE_PRICE_GROUP',
    needed: 'never',
    consequence: 'fine',
    felt: 'As above, for the Group plan.',
    set: 'Optional: the provider’s own recurring price.',
  },

  /* --- the rest -------------------------------------------------------------- */
  {
    name: 'INBOUND_WEBHOOK_SECRET',
    needed: 'to send',
    consequence: 'degraded',
    felt: 'A customer replying to a message reaches nobody: inbound mail is refused outright, which is the right refusal and still means the reply is lost.',
    set: 'The signing secret from the inbound mail provider.',
  },
  {
    name: 'REPLY_DOMAIN',
    needed: 'for a network',
    consequence: 'degraded',
    felt: 'Replies go back to the sending address rather than to the workshop that sent the message. Right for one workshop, wrong for several.',
    set: 'The domain replies are addressed at.',
  },
  {
    name: 'PASSWORD_BREACH_CHECK',
    needed: 'always',
    consequence: 'degraded',
    felt: 'A person can set a password that is already on every breach list. It defaults to on in production.',
    set: 'on, which is the default in production anyway.',
    pretendingIfEqual: ['off'],
  },
  {
    name: 'NODE_ENV',
    needed: 'always',
    consequence: 'degraded',
    felt: 'Anything but production leaves development behaviour in place, including the breached-password check being off by default.',
    set: 'production',
    pretendingIfEqual: ['development', 'test'],
  },
  {
    name: 'APP_NAME',
    needed: 'never',
    consequence: 'fine',
    felt: 'The product is called Carnet unless somebody says otherwise.',
    set: 'Optional.',
  },
  {
    name: 'SESSION_TTL_HOURS',
    needed: 'never',
    consequence: 'fine',
    felt: 'Twelve hours, which is a working day and a bit.',
    set: 'Optional.',
  },
  {
    name: 'VIN_DECODER',
    needed: 'never',
    consequence: 'fine',
    felt: 'The built-in decoder reads the maker and year from the VIN itself. nhtsa asks a free public registry for more.',
    set: 'Optional.',
  },
  {
    name: 'FITMENT_FEED',
    needed: 'never',
    consequence: 'fine',
    felt: 'The sample feed knows the demonstration parts only and says nothing about any other, which is honest rather than wrong.',
    set: 'Optional.',
  },
  {
    name: 'REVIEW_SITE',
    needed: 'never',
    consequence: 'fine',
    felt: 'Where a happy customer is sent. The workshop names its own listing.',
    set: 'Optional.',
  },
  {
    name: 'AI_TRANSPORT',
    needed: 'never',
    consequence: 'fine',
    felt: 'none means every summary is the plain one composed from the record, which is a complete feature rather than a degraded one.',
    set: 'Optional.',
  },
  {
    name: 'AI_MODEL',
    needed: 'never',
    consequence: 'fine',
    felt: 'Only read when the assistant is switched on.',
    set: 'Optional.',
  },
  {
    name: 'ANTHROPIC_API_KEY',
    needed: 'never',
    consequence: 'fine',
    felt: 'Only needed when the assistant is switched on.',
    set: 'Optional.',
  },
  {
    name: 'LOG_LEVEL',
    needed: 'never',
    consequence: 'fine',
    felt: 'info, which is the right amount for somebody reading a log search.',
    set: 'Optional.',
  },
  {
    name: 'FEATURE_CUSTOMER_PORTAL',
    needed: 'never',
    consequence: 'fine',
    felt: 'On. Turning it off takes the customer’s own side away.',
    set: 'Optional.',
  },
  {
    name: 'FEATURE_VEHICLE_PASSPORT',
    needed: 'never',
    consequence: 'fine',
    felt: 'On. Turning it off takes away the thing the product is for.',
    set: 'Optional.',
  },
  {
    name: 'FEATURE_INVENTORY',
    needed: 'never',
    consequence: 'fine',
    felt: 'Off by default; the parts pages are there either way.',
    set: 'Optional.',
  },
  {
    name: 'FEATURE_ACCOUNTING',
    needed: 'never',
    consequence: 'fine',
    felt: 'Off by default. The finance pages are there either way.',
    set: 'Optional: on, to surface the accounting menu.',
  },
  /* --- the ones that never went through the schema -------------------------- */
  //
  // Read straight from process.env rather than parsed at startup, which is why
  // they were missing from the first draft of this register: it was written
  // against the environment schema, and the schema is not the whole truth.
  // Finding that was the point of checking the register against the source
  // rather than against the one file that looked authoritative.
  {
    name: 'STORAGE_DRIVER',
    needed: 'always',
    consequence: 'silent',
    felt: 'Photographs and paperwork are written to the machine’s own disk, which a serverless host throws away between requests. An inspection is carried out, the evidence is taken, and it is gone — and nothing anywhere says so.',
    set: 's3, with an endpoint, a bucket and keys.',
    pretendingIfEqual: ['local'],
  },
  {
    name: 'S3_ENDPOINT',
    needed: 'always',
    consequence: 'stops',
    felt: 'With the driver set to s3 and no endpoint, every upload is refused with a message saying so. Loud, and therefore the better half of this pair.',
    set: 'The object store’s endpoint: R2, S3 or anything that speaks S3.',
  },
  {
    name: 'S3_BUCKET',
    needed: 'always',
    consequence: 'stops',
    felt: 'As above: uploads are refused rather than lost.',
    set: 'The bucket photographs and paperwork live in.',
  },
  {
    name: 'S3_ACCESS_KEY_ID',
    needed: 'always',
    consequence: 'stops',
    felt: 'As above: with the driver set to s3 and no key, uploads are refused rather than quietly lost.',
    set: 'The store’s access key.',
  },
  {
    name: 'S3_SECRET_ACCESS_KEY',
    needed: 'always',
    consequence: 'stops',
    felt: 'As above: with the driver set to s3 and no key, uploads are refused rather than quietly lost.',
    set: 'The store’s secret key.',
  },
  {
    name: 'S3_REGION',
    needed: 'never',
    consequence: 'fine',
    felt: 'auto, which is what R2 wants and what most others accept.',
    set: 'Optional: the store’s region, where it has one.',
  },
  {
    name: 'S3_FORCE_PATH_STYLE',
    needed: 'never',
    consequence: 'fine',
    felt: 'On, which is right for R2 and for MinIO.',
    set: 'Optional: false for a store that wants virtual-hosted URLs.',
  },
  {
    name: 'STORAGE_LOCAL_PATH',
    needed: 'never',
    consequence: 'fine',
    felt: 'Where files go while the driver is local, which is a development arrangement.',
    set: 'Optional.',
  },
  {
    name: 'SITE_URL',
    needed: 'always',
    consequence: 'silent',
    felt: 'The address in a password reset and in an alert. Wrong, and somebody following a reset link lands on a laptop that is not running.',
    set: 'The same public address as APP_URL.',
    pretendingIfEqual: ['http://localhost:3000'],
  },
  {
    name: 'SMTP_PASSWORD',
    needed: 'to send',
    consequence: 'stops',
    felt: 'With the transport set to smtp and no password, nothing sends and the failure is recorded on each message.',
    set: 'The provider’s password, or a Resend key beginning re_.',
  },
  {
    name: 'RESEND_API_KEY',
    needed: 'to send',
    consequence: 'degraded',
    felt: 'Only read by the inbound mail route, to fetch the body of a reply the provider did not include. Without it a long reply arrives truncated.',
    set: 'The same Resend key, where Resend is the provider.',
  },
  {
    name: 'DATABASE_POOL_MAX',
    needed: 'never',
    consequence: 'fine',
    felt: 'Ten connections, which suits a serverless host. Raise it for a long-running one.',
    set: 'Optional.',
  },
  {
    name: 'WORKER_BATCH',
    needed: 'never',
    consequence: 'fine',
    felt: 'Twenty-five items a pass, which keeps a run inside a serverless timeout.',
    set: 'Optional.',
  },
  {
    name: 'WORKER_SHIFT_END_HOUR',
    needed: 'never',
    consequence: 'fine',
    felt: 'Seven in the evening: when a technician’s forgotten clock-in is closed off.',
    set: 'Optional: the hour the workshop actually shuts.',
  },
];

/* ---------------------------------------------------------------------------
   Reading an environment against it
   --------------------------------------------------------------------------- */

export type SettingVerdict = 'ready' | 'missing' | 'pretending' | 'not needed';

export interface SettingReading {
  setting: Setting;
  verdict: SettingVerdict;
}

/**
 * What an environment says about itself.
 *
 * Takes presence and value, never logs either. A settings check that prints
 * the values it is checking is a settings check nobody can run against
 * production.
 */
export function readSettings(
  values: Readonly<Record<string, string | undefined>>,
  settings: readonly Setting[] = SETTINGS,
): SettingReading[] {
  return settings.map((setting) => {
    const value = values[setting.name];

    if (setting.needed === 'never') {
      return { setting, verdict: 'not needed' as const };
    }

    if (value === undefined || value.trim() === '') {
      return { setting, verdict: 'missing' as const };
    }

    if (setting.pretendingIfEqual?.includes(value.trim())) {
      return { setting, verdict: 'pretending' as const };
    }

    return { setting, verdict: 'ready' as const };
  });
}

/**
 * Whether a real workshop could be put on this, and what stops it.
 *
 * "What stops it" is ordered by what a workshop would feel first, so the
 * silent failures come before the loud ones. A loud failure is somebody's
 * afternoon; a silent one is a fortnight of a workshop believing it has told
 * its customers things it has not.
 */
export function handover(readings: readonly SettingReading[]): {
  ready: boolean;
  stopping: SettingReading[];
} {
  const stopping = readings
    .filter((one) => one.verdict === 'missing' || one.verdict === 'pretending')
    .filter((one) => one.setting.needed !== 'never')
    .sort(
      (a, b) =>
        SEVERITY[a.setting.consequence] - SEVERITY[b.setting.consequence] ||
        a.setting.name.localeCompare(b.setting.name),
    );

  return { ready: stopping.length === 0, stopping };
}

/** One line, for the top of the report. */
export function describeReadiness(readings: readonly SettingReading[]): string {
  const count = (verdict: SettingVerdict) =>
    readings.filter((one) => one.verdict === verdict).length;

  return (
    `${readings.length} settings: ${count('ready')} set, ` +
    `${count('missing')} missing, ${count('pretending')} set to something that only pretends, ` +
    `${count('not needed')} optional.`
  );
}
