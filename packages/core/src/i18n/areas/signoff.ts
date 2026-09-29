/**
 * The sign-off sheet. Phase 85.
 *
 * The twelve default lines are translated here as well as the screen around
 * them, because a workshop that has never edited its sheet reads the default
 * one, and a French technician reading an English checklist about torque is
 * exactly the moment this product stops being trustworthy.
 *
 * A workshop that writes its own lines writes them in its own language, and
 * those are data rather than keys — nothing here can or should translate them.
 *
 * Two words are not here. `Passed` is the jobs area's, because a check that
 * passed passed in the same sense an inspection did. `Checked` is the books'
 * plural — "64 checked" — so the tick on one line of a sheet is
 * `Checked#line`, which is what Phase 83's qualifier exists for.
 */

export const fr = {
  'Sign-off': 'Contrôle final',
  'The last look before the car goes back. A line left blank is a line not checked, and the sheet does not pass until every required one is answered.':
    'Le dernier regard avant de rendre le véhicule. Une ligne vide est une ligne non vérifiée, et la feuille ne passe pas tant que chaque ligne obligatoire n’a pas de réponse.',
  'Record the sign-off': 'Enregistrer le contrôle',
  'Anything worth saying': 'Ce qu’il y a à signaler',
  'This workshop has no sign-off sheet yet. Add the lines in settings.':
    'Cet atelier n’a pas encore de feuille de contrôle. Ajoutez les lignes dans les réglages.',
  'Checked#line': 'Vérifié',
  Yes: 'Oui',
  No: 'Non',
  optional: 'facultatif',
  'Not passed': 'Non réussi',

  // The refusals.
  'There is no such job in this workshop.': 'Ce travail n’existe pas dans cet atelier.',
  'A job is checked when the work is done, not before it starts or after it is invoiced.':
    'Un travail se contrôle quand il est terminé, ni avant d’être commencé ni après avoir été facturé.',
  'This workshop has no sign-off sheet yet. Add the lines in settings first.':
    'Cet atelier n’a pas encore de feuille de contrôle. Ajoutez d’abord les lignes dans les réglages.',
  'An answer was given for a line not on the sheet.':
    'Une réponse a été donnée pour une ligne absente de la feuille.',

  // The twelve a workshop starts with.
  'Every task on the job is done': 'Toutes les tâches du travail sont faites',
  'The parts on the job are the parts fitted':
    'Les pièces du travail sont bien celles qui ont été montées',
  'Torque-critical fasteners checked': 'Serrages au couple vérifiés',
  'Fluid levels checked': 'Niveaux vérifiés',
  'No warning lights on': 'Aucun témoin allumé',
  'Road test done': 'Essai routier effectué',
  'What the road test showed': 'Ce qu’a montré l’essai routier',
  'Photographs attached': 'Photos jointes',
  'What the customer asked about is answered': 'Ce que le client a signalé a reçu une réponse',
  'Mileage on handing back': 'Kilométrage à la restitution',
  'Signed off by': 'Contrôlé par',
};

export const ar = {
  'Sign-off': 'الفحص النهائي',
  'The last look before the car goes back. A line left blank is a line not checked, and the sheet does not pass until every required one is answered.':
    'النظرة الأخيرة قبل إعادة السيارة. السطر الفارغ سطر لم يُفحص، ولا تُعتمد الورقة حتى يُجاب عن كل سطر إلزامي.',
  'Record the sign-off': 'سجّل الفحص',
  'Anything worth saying': 'ما يستحق الذكر',
  'This workshop has no sign-off sheet yet. Add the lines in settings.':
    'لا توجد لهذه الورشة ورقة فحص بعد. أضف السطور من الإعدادات.',
  'Checked#line': 'تم الفحص',
  Yes: 'نعم',
  No: 'لا',
  optional: 'اختياري',
  'Not passed': 'غير ناجح',

  'There is no such job in this workshop.': 'لا يوجد هذا العمل في هذه الورشة.',
  'A job is checked when the work is done, not before it starts or after it is invoiced.':
    'يُفحص العمل عند انتهائه، لا قبل بدئه ولا بعد فوترته.',
  'This workshop has no sign-off sheet yet. Add the lines in settings first.':
    'لا توجد لهذه الورشة ورقة فحص بعد. أضف السطور من الإعدادات أولاً.',
  'An answer was given for a line not on the sheet.': 'أُعطيت إجابة لسطر غير موجود في الورقة.',

  'Every task on the job is done': 'كل مهام العمل منجزة',
  'The parts on the job are the parts fitted': 'القطع المدرجة في العمل هي القطع المركّبة',
  'Torque-critical fasteners checked': 'تم التأكد من ربط المسامير الحرجة بعزمها',
  'Fluid levels checked': 'تم فحص مستويات السوائل',
  'No warning lights on': 'لا توجد لمبات تحذير مضاءة',
  'Road test done': 'تم إجراء اختبار الطريق',
  'What the road test showed': 'ما أظهره اختبار الطريق',
  'Photographs attached': 'الصور مرفقة',
  'What the customer asked about is answered': 'ما سأل عنه العميل تمت الإجابة عنه',
  'Mileage on handing back': 'قراءة العداد عند التسليم',
  'Signed off by': 'اعتمده',
};
