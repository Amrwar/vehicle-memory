/**
 * How long things take, in the workshop's own words.
 *
 * The durations themselves are built by `describeSeconds` and translated as
 * whole phrases — "45 minutes", "4.3 hours" — rather than as a number and a
 * unit stuck together, because the two do not join the same way in every
 * language and a page that assembles them ends up saying something nobody
 * would say out loud.
 */

export const fr: Readonly<Record<string, string>> = {
  // The page
  'How long things take': 'Combien de temps cela prend',
  'Your own clock, from the records of the work itself':
    'Votre propre chronomètre, tiré des enregistrements du travail lui-même',
  'Slower than they should be': 'Plus lents qu’ils ne devraient',
  'Nothing to chase': 'Rien à relancer',
  'Too little to go on': 'Trop peu d’éléments',
  'Not enough work recorded to say': 'Pas assez de travail enregistré pour se prononcer',
  'Stretches watched': 'Intervalles suivis',
  'From moments the records already keep':
    'À partir de moments que les enregistrements conservent déjà',
  'From one moment to the next': 'D’un moment au suivant',
  'Furthest past its target first, because that is where to start':
    'Le plus éloigné de sa cible en premier, car c’est par là qu’il faut commencer',
  'From, to': 'De, à',
  Usually: 'Habituellement',
  'Slowest tenth': 'Dixième le plus lent',
  Target: 'Cible',
  'Measured on': 'Mesuré sur',
  Slower: 'Plus lent',
  'Too few': 'Trop peu',
  Fine: 'Correct',
  'Why these targets': 'Pourquoi ces cibles',
  '{seen} of {candidates}': '{seen} sur {candidates}',
  '{percent}%': '{percent} %',
  '{days} days': '{days} jours',
  'Every figure here is the middle one, not the average: one car left over a bank holiday would add three days to an average and tell you nothing. The slowest tenth is beside it because that is where complaints come from. A stretch measured on fewer than five jobs is shown as too few rather than as a number, because a middle figure taken from four jobs is a story rather than a measurement.':
    'Chaque chiffre ici est la valeur médiane, non la moyenne : une voiture laissée pendant un jour férié ajouterait trois jours à une moyenne sans rien vous apprendre. Le dixième le plus lent figure à côté, car c’est de là que viennent les réclamations. Un intervalle mesuré sur moins de cinq interventions est signalé comme insuffisant plutôt que chiffré, car une médiane tirée de quatre interventions est une anecdote, pas une mesure.',

  'Each is a judgement made when this page was written, not a requirement.':
    'Chacune est un jugement porté à la rédaction de cette page, non une exigence.',

  // How long, as one phrase with the figure filled in
  '{count} seconds': '{count} secondes',
  '{count} minutes': '{count} minutes',
  '{count} hours': '{count} heures',
  '{count} days': '{count} jours',

  // Why each target is what it is
  'A car on the forecourt with no job against it is work nobody can see, and a quarter of an hour is long enough to find the keys and the customer.':
    'Un véhicule sur le parking sans ordre de réparation est un travail que personne ne voit, et un quart d’heure suffit à retrouver les clés et le client.',
  'A full check with photographs, without rushing it.':
    'Un contrôle complet avec photographies, sans le bâcler.',
  'The customer is waiting and the car is on the ramp; an hour is the point at which the ramp is the cost.':
    'Le client attend et le véhicule est sur le pont ; au bout d’une heure, c’est le pont qui coûte.',
  'Mostly the customer’s time rather than the workshop’s — which is exactly why it is worth watching, because a quote that takes two days to answer is usually one that was hard to read.':
    'C’est surtout le temps du client, non celui de l’atelier — et c’est précisément pour cela qu’il mérite d’être suivi : un devis auquel on met deux jours à répondre est généralement un devis difficile à lire.',
  'A job stopped for a part is a bay not earning, and ordering is a few minutes of somebody’s attention.':
    'Une intervention arrêtée faute de pièce est un poste qui ne rapporte rien, et commander ne demande que quelques minutes d’attention.',
  'A working day. Longer is not wrong, but it means the car stayed overnight, and a workshop should know how often that happens.':
    'Une journée de travail. Plus long n’est pas fautif, mais cela signifie que le véhicule est resté la nuit, et un atelier devrait savoir à quelle fréquence cela arrive.',
  'A finished car occupying a space is the most expensive kind of storage there is.':
    'Un véhicule terminé qui occupe une place est le stockage le plus coûteux qui soit.',
  'An invoice not written is money not asked for, and the details are freshest on the day.':
    'Une facture non rédigée est de l’argent non réclamé, et les détails sont les plus frais le jour même.',
  'Most work is paid on collection; this is the figure that says how much is not.':
    'La plupart des travaux sont réglés à la reprise du véhicule ; ce chiffre dit quelle part ne l’est pas.',

  // The span of each, as one sentence rather than two halves glued together
  'From the car arriving to the job being written.':
    'De l’arrivée du véhicule à la rédaction de l’ordre.',
  'From the inspection being started to it being completed.':
    'Du début du contrôle à son achèvement.',
  'From the inspection being completed to the estimate going out.':
    'De l’achèvement du contrôle à l’envoi du devis.',
  'From the estimate going out to the customer deciding.':
    'De l’envoi du devis à la décision du client.',
  'From the shortfall raising a request to the order being sent.':
    'De la demande déclenchée par le manque à l’envoi de la commande.',
  'From the work being started to it being completed.': 'Du début des travaux à leur achèvement.',
  'From the job being completed to the car leaving.':
    'De l’achèvement des travaux au départ du véhicule.',
  'From the job being completed to the invoice being issued.':
    'De l’achèvement des travaux à l’émission de la facture.',
  'From the invoice being issued to the money arriving.':
    'De l’émission de la facture à la réception du paiement.',

  // The stretches
  'Car in to job open': 'Arrivée du véhicule à ouverture de l’ordre',
  'Inspection, start to finish': 'Contrôle, du début à la fin',
  'Findings to quote sent': 'Constats à devis envoyé',
  'Quote sent to answered': 'Devis envoyé à réponse',
  'Part needed to part ordered': 'Pièce nécessaire à pièce commandée',
  'Work started to finished': 'Travaux commencés à terminés',
  'Finished to collected': 'Terminé à récupéré',
  'Finished to invoiced': 'Terminé à facturé',
  'Invoiced to paid': 'Facturé à payé',
};

export const ar: Readonly<Record<string, string>> = {
  // The page
  'How long things take': 'كم يستغرق كل شيء',
  'Your own clock, from the records of the work itself': 'ساعتك أنت، مأخوذة من سجلات العمل نفسه',
  'Slower than they should be': 'أبطأ مما ينبغي',
  'Nothing to chase': 'لا شيء يستدعي المتابعة',
  'Too little to go on': 'الشواهد أقل من اللازم',
  'Not enough work recorded to say': 'لم يُسجَّل من العمل ما يكفي للحكم',
  'Stretches watched': 'الفترات المرصودة',
  'From moments the records already keep': 'من لحظات تحفظها السجلات أصلًا',
  'From one moment to the next': 'من لحظة إلى التي تليها',
  'Furthest past its target first, because that is where to start':
    'الأبعد عن هدفه أولًا، فمن هناك يبدأ النظر',
  'From, to': 'من، إلى',
  Usually: 'عادةً',
  'Slowest tenth': 'العُشر الأبطأ',
  Target: 'الهدف',
  'Measured on': 'قيس على',
  Slower: 'أبطأ',
  'Too few': 'قليل جدًا',
  Fine: 'جيّد',
  'Why these targets': 'لماذا هذه الأهداف',
  '{seen} of {candidates}': '{seen} من {candidates}',
  '{percent}%': '{percent}٪',
  '{days} days': '{days} يومًا',
  'Every figure here is the middle one, not the average: one car left over a bank holiday would add three days to an average and tell you nothing. The slowest tenth is beside it because that is where complaints come from. A stretch measured on fewer than five jobs is shown as too few rather than as a number, because a middle figure taken from four jobs is a story rather than a measurement.':
    'كل رقم هنا هو القيمة الوسيطة لا المتوسط: سيارة واحدة تُركت خلال عطلة رسمية تضيف ثلاثة أيام إلى المتوسط ولا تخبرك بشيء. والعُشر الأبطأ مذكور بجانبه لأن الشكاوى تأتي من هناك. أما الفترة التي قيست على أقل من خمس مهامّ فتُعرض بوصفها غير كافية لا كرقم، لأن وسيطًا مأخوذًا من أربع مهامّ حكاية لا قياس.',

  'Each is a judgement made when this page was written, not a requirement.':
    'كلٌّ منها اجتهاد وُضع عند كتابة هذه الصفحة، لا اشتراط.',

  // How long, as one phrase with the figure filled in
  '{count} seconds': '{count} ثانية',
  '{count} minutes': '{count} دقيقة',
  '{count} hours': '{count} ساعة',
  '{count} days': '{count} يومًا',

  // Why each target is what it is
  'A car on the forecourt with no job against it is work nobody can see, and a quarter of an hour is long enough to find the keys and the customer.':
    'سيارة في الساحة بلا مهمّة مسجّلة عليها عملٌ لا يراه أحد، وربع ساعة تكفي للعثور على المفاتيح وعلى العميل.',
  'A full check with photographs, without rushing it.': 'فحص كامل مع صور، دون استعجال.',
  'The customer is waiting and the car is on the ramp; an hour is the point at which the ramp is the cost.':
    'العميل ينتظر والسيارة على الرافعة؛ وعند الساعة تصبح الرافعة هي الكلفة.',
  'Mostly the customer’s time rather than the workshop’s — which is exactly why it is worth watching, because a quote that takes two days to answer is usually one that was hard to read.':
    'هو في الأغلب وقت العميل لا وقت الورشة — ولهذا بالضبط يستحقّ المتابعة، فالعرض الذي يستغرق الردّ عليه يومين يكون عادةً عرضًا صعب القراءة.',
  'A job stopped for a part is a bay not earning, and ordering is a few minutes of somebody’s attention.':
    'المهمّة المتوقفة بانتظار قطعة تعني موقفًا لا يدرّ دخلًا، والطلب لا يستغرق سوى دقائق من انتباه أحدهم.',
  'A working day. Longer is not wrong, but it means the car stayed overnight, and a workshop should know how often that happens.':
    'يوم عمل. وما زاد ليس خطأً، لكنه يعني أن السيارة باتت ليلتها، وعلى الورشة أن تعرف كم مرة يحدث ذلك.',
  'A finished car occupying a space is the most expensive kind of storage there is.':
    'سيارة منتهية تشغل مكانًا هي أغلى أنواع التخزين على الإطلاق.',
  'An invoice not written is money not asked for, and the details are freshest on the day.':
    'الفاتورة غير المكتوبة مالٌ لم يُطلب، والتفاصيل أكثر ما تكون حاضرة في يومها.',
  'Most work is paid on collection; this is the figure that says how much is not.':
    'معظم الأعمال تُسدَّد عند الاستلام؛ وهذا الرقم يقول كم منها لم يُسدَّد.',

  // The span of each, as one sentence rather than two halves glued together
  'From the car arriving to the job being written.': 'من وصول السيارة إلى تدوين المهمّة.',
  'From the inspection being started to it being completed.': 'من بدء الفحص إلى إتمامه.',
  'From the inspection being completed to the estimate going out.':
    'من إتمام الفحص إلى إرسال العرض.',
  'From the estimate going out to the customer deciding.': 'من إرسال العرض إلى قرار العميل.',
  'From the shortfall raising a request to the order being sent.':
    'من الطلب الذي أثاره النقص إلى إرسال أمر الشراء.',
  'From the work being started to it being completed.': 'من بدء العمل إلى إتمامه.',
  'From the job being completed to the car leaving.': 'من إتمام العمل إلى مغادرة السيارة.',
  'From the job being completed to the invoice being issued.': 'من إتمام العمل إلى إصدار الفاتورة.',
  'From the invoice being issued to the money arriving.': 'من إصدار الفاتورة إلى وصول المبلغ.',

  // The stretches
  'Car in to job open': 'من دخول السيارة إلى فتح المهمّة',
  'Inspection, start to finish': 'الفحص، من بدئه إلى انتهائه',
  'Findings to quote sent': 'من النتائج إلى إرسال العرض',
  'Quote sent to answered': 'من إرسال العرض إلى الردّ عليه',
  'Part needed to part ordered': 'من الحاجة إلى القطعة إلى طلبها',
  'Work started to finished': 'من بدء العمل إلى إنجازه',
  'Finished to collected': 'من الإنجاز إلى الاستلام',
  'Finished to invoiced': 'من الإنجاز إلى إصدار الفاتورة',
  'Invoiced to paid': 'من إصدار الفاتورة إلى السداد',
};
