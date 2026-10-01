/**
 * Minute by minute: the story of a job. Phase 99.
 *
 * Two things must survive translation or the page changes meaning.
 *
 * **The three sides are a claim about who acted**, not about where the row
 * came from. "The product" means the software did it on nobody's behalf — a
 * reminder a schedule sent, a clock the sweeper closed. A translation that
 * made it "automatic" or "system" would be read as a technicality; it must
 * read as a third party, because that is how a reader of a complaint needs
 * to count it.
 *
 * **"with nothing recorded"** is a statement about the record, not about
 * the workshop. A silence on the page may have been a weekend, a wait for a
 * part, or three unanswered calls, and the page does not know which. The
 * phrase must stay neutral and must not become "nothing happened".
 *
 * The channel and method words fill a slot: "Sent {channel}" with "a text
 * message", "Payment taken by {method}" with "cash". They are written so the
 * whole sentence reads as one in each language, which is why the English
 * carries its own article.
 */

export const fr = {
  // The page.
  'Minute by minute': 'Minute par minute',
  'From first to last': 'Du premier au dernier',
  '{from} to {to}': 'Du {from} au {to}',
  Messages: 'Messages',
  '{out} out, {in} in': '{out} envoyés, {in} reçus',
  'The customer wrote and nobody wrote back': 'Le client a écrit et personne n’a répondu',
  'Both ways, people and the product': 'Dans les deux sens, les gens et le produit',
  'Longest silence': 'Plus long silence',
  'After: {what}': 'Après : {what}',
  'Never a day without something recorded': 'Jamais un jour sans rien d’enregistré',
  '1 moment': '1 moment',
  '{count} moments': '{count} moments',
  '{span} with nothing recorded': '{span} sans rien d’enregistré',
  'Moved to {status}': 'Passé à {status}',
  '{days} days': '{days} jours',
  '{hours} hours': '{hours} heures',
  '{minutes} minutes': '{minutes} minutes',
  'The product': 'Le produit',

  // The sentence at the top.
  'Nothing has happened on this job yet.': 'Rien ne s’est encore passé sur ce travail.',
  'One moment so far.': 'Un seul moment jusqu’ici.',
  '{moments} moments over {span}: {us} by the workshop, {customer} by the customer, {system} by the product on its own.':
    '{moments} moments sur {span} : {us} par l’atelier, {customer} par le client, {system} par le produit de lui-même.',

  // What happened.
  'Job opened': 'Travail ouvert',
  'Car checked in': 'Voiture prise en charge',
  'Car checked out': 'Voiture restituée',
  'Car collected': 'Voiture récupérée',
  'Work completed': 'Travaux terminés',
  'Keys hung on hook {hook}': 'Clés accrochées au crochet {hook}',
  'Keys taken off the hook': 'Clés décrochées',
  'Keys returned to the hook': 'Clés raccrochées',
  'Keys handed to the customer': 'Clés remises au client',
  'Inspection started': 'Inspection commencée',
  'Inspection completed': 'Inspection terminée',
  'Estimate v{version} sent': 'Devis v{version} envoyé',
  'Estimate v{version} approved': 'Devis v{version} approuvé',
  'Estimate v{version} declined': 'Devis v{version} refusé',
  'Estimate v{version} approved in part': 'Devis v{version} approuvé en partie',
  'The estimate’s link was withdrawn': 'Le lien du devis a été retiré',
  'Extra work found and put to the customer':
    'Travaux supplémentaires constatés et soumis au client',
  'Sent {channel}': '{channel} envoyé',
  'The product sent {channel}': 'Le produit a envoyé {channel}',
  '{channel} failed to send': '{channel} n’a pas pu être envoyé',
  'The customer sent {channel}': 'Le client a envoyé {channel}',
  'a text message': 'un SMS',
  'an email': 'un courriel',
  'a WhatsApp message': 'un message WhatsApp',
  'a portal message': 'un message par le portail',
  'Clocked off after {minutes} minutes': 'Dépointé après {minutes} minutes',
  'Clock closed by the overnight sweeper after {minutes} minutes':
    'Pointage fermé par le balayage nocturne après {minutes} minutes',
  'Part added: {part}': 'Pièce ajoutée : {part}',
  '{part} fitted instead of {original}': '{part} monté à la place de {original}',
  '{work} sent out to {supplier}': '{work} confié à {supplier}',
  '{work} back from {supplier}': '{work} revenu de {supplier}',
  'Quality check passed': 'Contrôle qualité réussi',
  'Quality check failed': 'Contrôle qualité échoué',
  Note: 'Note',
  'Photo added': 'Photo ajoutée',
  'Video added': 'Vidéo ajoutée',
  'Document added': 'Document ajouté',
  'Invoice {number} issued': 'Facture {number} émise',
  'Paid online': 'Payé en ligne',
  'Payment taken by {method}': 'Paiement reçu par {method}',
  'loyalty points': 'points de fidélité',
  coupon: 'bon de réduction',
  'Summary of the work sent to the customer': 'Résumé des travaux envoyé au client',
  'Marked as a comeback of an earlier job': 'Marqué comme retour d’un travail antérieur',
  'Follow-up set': 'Relance programmée',
  'Follow-up done': 'Relance faite',
  'Estimate v{version} approved in person': 'Devis v{version} approuvé en personne',
  'Estimate v{version} declined in person': 'Devis v{version} refusé en personne',
  'Estimate v{version} approved in part, in person':
    'Devis v{version} approuvé en partie, en personne',
} as const;

export const ar = {
  // The page.
  'Minute by minute': 'دقيقة بدقيقة',
  'From first to last': 'من الأول إلى الأخير',
  '{from} to {to}': 'من {from} إلى {to}',
  Messages: 'الرسائل',
  '{out} out, {in} in': '{out} صادرة، {in} واردة',
  'The customer wrote and nobody wrote back': 'كتب العميل ولم يردّ أحد',
  'Both ways, people and the product': 'في الاتجاهين، الأشخاص والمنتج',
  'Longest silence': 'أطول صمت',
  'After: {what}': 'بعد: {what}',
  'Never a day without something recorded': 'لم يمرّ يوم دون تسجيل شيء',
  '1 moment': 'لحظة واحدة',
  '{count} moments': '{count} لحظات',
  '{span} with nothing recorded': '{span} دون تسجيل شيء',
  'Moved to {status}': 'انتقل إلى {status}',
  '{days} days': '{days} أيام',
  '{hours} hours': '{hours} ساعات',
  '{minutes} minutes': '{minutes} دقائق',
  'The product': 'المنتج',

  // The sentence at the top.
  'Nothing has happened on this job yet.': 'لم يحدث شيء في هذا العمل بعد.',
  'One moment so far.': 'لحظة واحدة حتى الآن.',
  '{moments} moments over {span}: {us} by the workshop, {customer} by the customer, {system} by the product on its own.':
    '{moments} لحظات على مدى {span}: {us} من الورشة، {customer} من العميل، {system} من المنتج تلقائيًا.',

  // What happened.
  'Job opened': 'فُتح العمل',
  'Car checked in': 'استُلمت السيارة',
  'Car checked out': 'سُلّمت السيارة',
  'Car collected': 'استلم العميل السيارة',
  'Work completed': 'اكتمل العمل',
  'Keys hung on hook {hook}': 'عُلّقت المفاتيح على الخطاف {hook}',
  'Keys taken off the hook': 'أُخذت المفاتيح من الخطاف',
  'Keys returned to the hook': 'أُعيدت المفاتيح إلى الخطاف',
  'Keys handed to the customer': 'سُلّمت المفاتيح للعميل',
  'Inspection started': 'بدأ الفحص',
  'Inspection completed': 'اكتمل الفحص',
  'Estimate v{version} sent': 'أُرسل التقدير الإصدار {version}',
  'Estimate v{version} approved': 'اعتُمد التقدير الإصدار {version}',
  'Estimate v{version} declined': 'رُفض التقدير الإصدار {version}',
  'Estimate v{version} approved in part': 'اعتُمد التقدير الإصدار {version} جزئيًا',
  'The estimate’s link was withdrawn': 'سُحب رابط التقدير',
  'Extra work found and put to the customer': 'وُجد عمل إضافي وعُرض على العميل',
  'Sent {channel}': 'أُرسلت {channel}',
  'The product sent {channel}': 'أرسل المنتج {channel}',
  '{channel} failed to send': 'تعذّر إرسال {channel}',
  'The customer sent {channel}': 'أرسل العميل {channel}',
  'a text message': 'رسالة نصية',
  'an email': 'رسالة بريد إلكتروني',
  'a WhatsApp message': 'رسالة واتساب',
  'a portal message': 'رسالة عبر البوابة',
  'Clocked off after {minutes} minutes': 'سجّل الانتهاء بعد {minutes} دقيقة',
  'Clock closed by the overnight sweeper after {minutes} minutes':
    'أغلق المسح الليلي الساعة بعد {minutes} دقيقة',
  'Part added: {part}': 'أُضيفت قطعة: {part}',
  '{part} fitted instead of {original}': 'رُكّبت {part} بدلًا من {original}',
  '{work} sent out to {supplier}': 'أُرسل {work} إلى {supplier}',
  '{work} back from {supplier}': 'عاد {work} من {supplier}',
  'Quality check passed': 'اجتاز فحص الجودة',
  'Quality check failed': 'أخفق في فحص الجودة',
  Note: 'ملاحظة',
  'Photo added': 'أُضيفت صورة',
  'Video added': 'أُضيف مقطع فيديو',
  'Document added': 'أُضيف مستند',
  'Invoice {number} issued': 'صدرت الفاتورة {number}',
  'Paid online': 'دُفع عبر الإنترنت',
  'Payment taken by {method}': 'استُلم الدفع عبر {method}',
  'loyalty points': 'نقاط الولاء',
  coupon: 'قسيمة',
  'Summary of the work sent to the customer': 'أُرسل ملخص العمل إلى العميل',
  'Marked as a comeback of an earlier job': 'عُلّم كعودة لعمل سابق',
  'Follow-up set': 'حُددت متابعة',
  'Follow-up done': 'أُنجزت المتابعة',
  'Estimate v{version} approved in person': 'اعتُمد التقدير الإصدار {version} حضوريًا',
  'Estimate v{version} declined in person': 'رُفض التقدير الإصدار {version} حضوريًا',
  'Estimate v{version} approved in part, in person':
    'اعتُمد التقدير الإصدار {version} جزئيًا حضوريًا',
} as const;
