/**
 * How Carnet itself is, and why a message did not arrive.
 *
 * The operator's words. They are translated for the same reason everything
 * else is: whoever runs a Carnet is not necessarily an English speaker, and a
 * status page half in English is a status page somebody misreads at two in the
 * morning.
 */

export const fr: Readonly<Record<string, string>> = {
  // The page
  //
  // The name does not change. It is here because every sentence handed to the
  // translator must have an answer in every language, and "it stays as it is"
  // is an answer — an absent one reads as an oversight and fails the check.
  Carnet: 'Carnet',
  'System health': 'État du système',
  'For whoever runs Carnet, not for a workshop': 'Pour qui exploite Carnet, non pour un atelier',
  Overall: 'Ensemble',
  'Needing attention': 'À traiter',
  'Nothing to do': 'Rien à faire',
  'Listed first below': 'En tête de liste ci-dessous',
  'Asked just now': 'Interrogé à l’instant',
  'What is wrong': 'Ce qui ne va pas',
  'Worst first, because that is where to start':
    'Le pire en premier, car c’est par là qu’il faut commencer',
  '{checked} checked: {failed} not working, {degraded} struggling, {unknown} never used.':
    '{checked} vérifiés : {failed} ne fonctionnent pas, {degraded} en difficulté, {unknown} jamais utilisés.',
  'Why did they not get their message?': 'Pourquoi n’ont-ils pas reçu leur message ?',
  'An address, a telephone number, or a few words from the subject':
    'Une adresse, un numéro de téléphone, ou quelques mots de l’objet',
  'Who, or what about': 'Qui, ou à quel sujet',
  'Find it': 'Rechercher',
  'Nothing sent to that': 'Rien n’a été envoyé à cela',
  'No message has gone to that address or carried those words. Check the spelling, or look at the customer to see which address the workshop actually holds.':
    'Aucun message n’est parti à cette adresse ni ne contenait ces mots. Vérifiez l’orthographe, ou consultez la fiche client pour voir l’adresse réellement enregistrée.',
  'No subject': 'Sans objet',

  // How a thing is
  Working: 'Fonctionne',
  Struggling: 'En difficulté',
  'Not working': 'Ne fonctionne pas',
  'Never used': 'Jamais utilisé',

  // The panels
  System: 'Système',
  Workers: 'Tâches de fond',
  Outside: 'Services externes',
  Records: 'Enregistrements',
  Access: 'Accès',
  'Coming back': 'Reprise',

  // What is looked at
  Database: 'Base de données',
  Migrations: 'Migrations',
  Workshops: 'Ateliers',
  Clock: 'Horloge',
  'Events waiting': 'Événements en attente',
  'Messages due and not gone': 'Messages dus et non partis',
  'Messages that failed today': 'Messages en échec aujourd’hui',
  Email: 'Courriel',
  'Text messages': 'SMS',
  'Card payments': 'Paiements par carte',
  'File store': 'Stockage des fichiers',
  'Vehicle lookup': 'Recherche de véhicule',
  Assistant: 'Assistant',
  'Passport chains': 'Chaînes des carnets',
  'Entries that balance': 'Écritures équilibrées',
  Attachments: 'Pièces jointes',
  Sessions: 'Sessions',
  'API keys': 'Clés d’API',
  'Addresses blocked today': 'Adresses bloquées aujourd’hui',
  'Scheduled work': 'Tâches planifiées',
  'Restore drill': 'Exercice de restauration',
  'Oldest record': 'Enregistrement le plus ancien',

  // What each one says
  'Answered in {ms} ms.': 'A répondu en {ms} ms.',
  'Did not answer.': 'N’a pas répondu.',
  '{count} applied.': '{count} appliquées.',
  '{count} on Carnet.': '{count} sur Carnet.',
  'It is {time} here.': 'Il est {time} ici.',
  '{count} waiting, the oldest for {minutes} minutes.':
    '{count} en attente, le plus ancien depuis {minutes} minutes.',
  '{due} of {queued} in the queue are due now and have not gone.':
    '{due} des {queued} en file sont dus maintenant et ne sont pas partis.',
  '{count} in the last day.': '{count} sur les dernières 24 heures.',
  '{sent} sent and {failed} failed in the last day.':
    '{sent} envoyés et {failed} en échec sur les dernières 24 heures.',
  'Not configured: nothing leaves this machine.': 'Non configuré : rien ne quitte cette machine.',
  '{tried} attempted and {failed} failed in the last day.':
    '{tried} tentés et {failed} en échec sur les dernières 24 heures.',
  'No keys: the stub is answering instead of a provider.':
    'Aucune clé : c’est le simulateur qui répond, pas un prestataire.',
  'Files go to the bucket.': 'Les fichiers vont dans le compartiment.',
  'Files are written to this machine, which is development only.':
    'Les fichiers sont écrits sur cette machine, ce qui ne vaut qu’en développement.',
  'The stub is answering.': 'C’est le simulateur qui répond.',
  'Asking {who}.': 'Interroge {who}.',
  'Switched off.': 'Désactivé.',
  'Asking {model}.': 'Interroge {model}.',
  '{broken} broken of {total} vehicles with a history.':
    '{broken} rompues sur {total} véhicules ayant un historique.',
  '{count} journal entries do not balance.': '{count} écritures ne sont pas équilibrées.',
  '{count} files belong to conversations.': '{count} fichiers appartiennent à des conversations.',
  '{live} live, {expired} expired and waiting to be swept.':
    '{live} actives, {expired} expirées en attente de purge.',
  '{count} in use.': '{count} en service.',
  '{count} stopped after a bounce or a complaint.':
    '{count} bloquées après un rejet ou une plainte.',
  'Behind a secret, as it must be.': 'Protégées par un secret, comme il se doit.',
  'No secret is set, so anybody can trigger it.':
    'Aucun secret n’est défini : n’importe qui peut les déclencher.',
  'Run on every push by verify-recovery, not from this page.':
    'Exécuté à chaque poussée par verify-recovery, pas depuis cette page.',
  'The history starts on {on}.': 'L’historique commence le {on}.',
  'Nothing recorded yet.': 'Rien n’a encore été enregistré.',

  // Why a message did not arrive
  'They asked not to be written to on this channel, so nothing was sent.':
    'Ils ont demandé à ne pas être contactés sur ce canal ; rien n’a donc été envoyé.',
  'Nothing to fix. Ring them, or ask them to opt back in on their own page.':
    'Rien à corriger. Téléphonez-leur, ou invitez-les à réactiver le consentement sur leur propre page.',
  'The address was stopped on {on} after {reason}, and nothing has gone to it since.':
    'L’adresse a été bloquée le {on} à la suite de {reason} ; plus rien n’y est parti depuis.',
  'Ask them for a different address, or lift the block on the messages page if you know it was wrong.':
    'Demandez-leur une autre adresse, ou levez le blocage depuis la page des messages si vous savez qu’il était infondé.',
  'It was not sent, because sending to that address is blocked.':
    'Il n’a pas été envoyé : l’envoi vers cette adresse est bloqué.',
  'The messages page lists what is blocked and why.':
    'La page des messages indique ce qui est bloqué, et pourquoi.',
  'It arrived. The provider confirmed it.': 'Il est arrivé. Le prestataire l’a confirmé.',
  'It left here on {on}. Nobody has told us it arrived, and most providers never do.':
    'Il est parti d’ici le {on}. Personne ne nous a dit qu’il était arrivé, et la plupart des prestataires ne le font jamais.',
  'If they say it is not there, check the junk folder before anything else.':
    'S’ils disent ne pas l’avoir, regardez d’abord le dossier indésirables.',
  'Sending was tried {attempts} times and given up on. The last thing the provider said was: {error}':
    'L’envoi a été tenté {attempts} fois puis abandonné. Le prestataire a répondu en dernier : {error}',
  'Read what the provider said. It is usually the address.':
    'Lisez la réponse du prestataire. C’est généralement l’adresse.',
  'The last attempt failed and it will be tried again. The provider said: {error}':
    'La dernière tentative a échoué et sera renouvelée. Le prestataire a répondu : {error}',
  'It failed {attempts} time(s) and is waiting {minutes} minutes before trying again.':
    'Il a échoué {attempts} fois et attend {minutes} minutes avant une nouvelle tentative.',
  'It is waiting {minutes} minutes, because messages are held outside the hours a customer wants to hear from you.':
    'Il attend {minutes} minutes : les messages sont retenus en dehors des heures où un client souhaite être contacté.',
  'It is due to go now and has not gone yet.': 'Il devrait partir maintenant et n’est pas parti.',
  'If it stays here, the worker that sends messages is not running.':
    'S’il reste là, la tâche de fond qui envoie les messages ne tourne pas.',
};

export const ar: Readonly<Record<string, string>> = {
  // The page
  //
  // Left in Latin script. A marque is not transliterated, and the rest of the
  // product already writes it this way inside Arabic sentences.
  Carnet: 'Carnet',
  'System health': 'حالة النظام',
  'For whoever runs Carnet, not for a workshop': 'لمن يُشغّل كارني، لا للورشة',
  Overall: 'الإجمال',
  'Needing attention': 'يحتاج انتباهًا',
  'Nothing to do': 'لا شيء يُفعل',
  'Listed first below': 'مذكور أولًا أدناه',
  'Asked just now': 'سُئل للتوّ',
  'What is wrong': 'ما الخلل',
  'Worst first, because that is where to start': 'الأسوأ أولًا، فمن هناك يبدأ النظر',
  '{checked} checked: {failed} not working, {degraded} struggling, {unknown} never used.':
    'فُحص {checked}: {failed} لا تعمل، و{degraded} تتعثّر، و{unknown} لم تُستخدم قطّ.',
  'Why did they not get their message?': 'لماذا لم تصلهم رسالتهم؟',
  'An address, a telephone number, or a few words from the subject':
    'عنوان، أو رقم هاتف، أو بضع كلمات من الموضوع',
  'Who, or what about': 'مَن، أو بأي شأن',
  'Find it': 'ابحث',
  'Nothing sent to that': 'لم يُرسل شيء إلى ذلك',
  'No message has gone to that address or carried those words. Check the spelling, or look at the customer to see which address the workshop actually holds.':
    'لم تذهب أي رسالة إلى ذلك العنوان ولم تحمل تلك الكلمات. تحقّق من الإملاء، أو راجع بطاقة العميل لمعرفة العنوان المسجّل فعلًا لدى الورشة.',
  'No subject': 'بلا موضوع',

  // How a thing is
  Working: 'يعمل',
  Struggling: 'يتعثّر',
  'Not working': 'لا يعمل',
  'Never used': 'لم يُستخدم قطّ',

  // The panels
  System: 'النظام',
  Workers: 'المهامّ الخلفية',
  Outside: 'الخدمات الخارجية',
  Records: 'السجلات',
  Access: 'الوصول',
  'Coming back': 'الاستعادة',

  // What is looked at
  Database: 'قاعدة البيانات',
  Migrations: 'الترحيلات',
  Workshops: 'الورش',
  Clock: 'الساعة',
  'Events waiting': 'أحداث منتظرة',
  'Messages due and not gone': 'رسائل حان وقتها ولم تُرسل',
  'Messages that failed today': 'رسائل أخفقت اليوم',
  Email: 'البريد الإلكتروني',
  'Text messages': 'الرسائل النصية',
  'Card payments': 'المدفوعات بالبطاقة',
  'File store': 'مخزن الملفات',
  'Vehicle lookup': 'البحث عن المركبات',
  Assistant: 'المساعد',
  'Passport chains': 'سلاسل جوازات المركبات',
  'Entries that balance': 'توازن القيود',
  Attachments: 'المرفقات',
  Sessions: 'الجلسات',
  'API keys': 'مفاتيح الواجهة البرمجية',
  'Addresses blocked today': 'عناوين حُظرت اليوم',
  'Scheduled work': 'المهامّ المجدولة',
  'Restore drill': 'تمرين الاستعادة',
  'Oldest record': 'أقدم سجلّ',

  // What each one says
  'Answered in {ms} ms.': 'أجابت في {ms} مللي ثانية.',
  'Did not answer.': 'لم تُجب.',
  '{count} applied.': 'طُبِّق منها {count}.',
  '{count} on Carnet.': '{count} على كارني.',
  'It is {time} here.': 'الساعة هنا {time}.',
  '{count} waiting, the oldest for {minutes} minutes.':
    '{count} في الانتظار، أقدمها منذ {minutes} دقيقة.',
  '{due} of {queued} in the queue are due now and have not gone.':
    '{due} من {queued} في الطابور حان وقتها ولم تُرسل.',
  '{count} in the last day.': '{count} خلال اليوم الماضي.',
  '{sent} sent and {failed} failed in the last day.':
    'أُرسل {sent} وأخفق {failed} خلال اليوم الماضي.',
  'Not configured: nothing leaves this machine.': 'غير مُهيّأ: لا شيء يغادر هذا الجهاز.',
  '{tried} attempted and {failed} failed in the last day.':
    'جرت محاولة {tried} وأخفق {failed} خلال اليوم الماضي.',
  'No keys: the stub is answering instead of a provider.':
    'لا مفاتيح: المحاكي هو المُجيب بدلًا من مزوّد فعلي.',
  'Files go to the bucket.': 'تذهب الملفات إلى الحاوية.',
  'Files are written to this machine, which is development only.':
    'تُكتب الملفات على هذا الجهاز، وهذا للتطوير فقط.',
  'The stub is answering.': 'المحاكي هو المُجيب.',
  'Asking {who}.': 'يسأل {who}.',
  'Switched off.': 'مُعطَّل.',
  'Asking {model}.': 'يسأل {model}.',
  '{broken} broken of {total} vehicles with a history.':
    'مكسورة {broken} من {total} مركبة لها سجلّ.',
  '{count} journal entries do not balance.': '{count} من قيود اليومية غير متوازنة.',
  '{count} files belong to conversations.': '{count} ملفًا تخصّ محادثات.',
  '{live} live, {expired} expired and waiting to be swept.':
    '{live} نشطة، و{expired} منتهية تنتظر التنظيف.',
  '{count} in use.': '{count} قيد الاستخدام.',
  '{count} stopped after a bounce or a complaint.': 'حُظر {count} بعد ارتداد أو شكوى.',
  'Behind a secret, as it must be.': 'محميّة بسرّ، كما ينبغي.',
  'No secret is set, so anybody can trigger it.': 'لم يُضبط أي سرّ، فبإمكان أي أحد تشغيلها.',
  'Run on every push by verify-recovery, not from this page.':
    'يُنفَّذ مع كل دفعة عبر verify-recovery، لا من هذه الصفحة.',
  'The history starts on {on}.': 'يبدأ السجلّ في {on}.',
  'Nothing recorded yet.': 'لم يُسجَّل شيء بعد.',

  // Why a message did not arrive
  'They asked not to be written to on this channel, so nothing was sent.':
    'طلبوا عدم مراسلتهم عبر هذه القناة، فلم يُرسل شيء.',
  'Nothing to fix. Ring them, or ask them to opt back in on their own page.':
    'لا شيء يُصلَح. اتصل بهم، أو اطلب منهم إعادة الموافقة من صفحتهم.',
  'The address was stopped on {on} after {reason}, and nothing has gone to it since.':
    'حُظر العنوان في {on} إثر {reason}، ولم يذهب إليه شيء منذئذ.',
  'Ask them for a different address, or lift the block on the messages page if you know it was wrong.':
    'اطلب منهم عنوانًا آخر، أو ارفع الحظر من صفحة الرسائل إن كنت تعلم أنه كان خطأً.',
  'It was not sent, because sending to that address is blocked.':
    'لم تُرسل، لأن الإرسال إلى ذلك العنوان محظور.',
  'The messages page lists what is blocked and why.': 'تسرد صفحة الرسائل ما هو محظور وسببه.',
  'It arrived. The provider confirmed it.': 'وصلت. أكّد المزوّد ذلك.',
  'It left here on {on}. Nobody has told us it arrived, and most providers never do.':
    'غادرت من هنا في {on}. لم يخبرنا أحد بوصولها، ومعظم المزوّدين لا يفعلون ذلك أبدًا.',
  'If they say it is not there, check the junk folder before anything else.':
    'إن قالوا إنها ليست لديهم، فافحص مجلد البريد غير المرغوب أولًا.',
  'Sending was tried {attempts} times and given up on. The last thing the provider said was: {error}':
    'جرت محاولة الإرسال {attempts} مرات ثم توقفت. وكان آخر ما قاله المزوّد: {error}',
  'Read what the provider said. It is usually the address.':
    'اقرأ ما قاله المزوّد. غالبًا ما يكون العنوان هو السبب.',
  'The last attempt failed and it will be tried again. The provider said: {error}':
    'أخفقت المحاولة الأخيرة وستُعاد. قال المزوّد: {error}',
  'It failed {attempts} time(s) and is waiting {minutes} minutes before trying again.':
    'أخفقت {attempts} مرة وتنتظر {minutes} دقيقة قبل المحاولة من جديد.',
  'It is waiting {minutes} minutes, because messages are held outside the hours a customer wants to hear from you.':
    'تنتظر {minutes} دقيقة، لأن الرسائل تُحتجز خارج الساعات التي يرغب العميل أن يصله فيها خبر منك.',
  'It is due to go now and has not gone yet.': 'حان وقت إرسالها ولم تُرسل بعد.',
  'If it stays here, the worker that sends messages is not running.':
    'إن بقيت هنا، فإن المهمّة الخلفية التي ترسل الرسائل لا تعمل.',
};
