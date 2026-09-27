/**
 * The diagnostic corpus. Phase 81.
 *
 * Every sentence here reports the past rather than forecasting the car on
 * the ramp, and the translations keep that: « s'est révélé être », not
 * « est probablement ». A word that turns a count into a prediction in one
 * language undoes the whole argument of ADR-0016 in that language.
 */

export const fr = {
  'That is not a symptom this workshop uses.': 'Ce n’est pas une plainte utilisée par cet atelier.',
  'This job already has a diagnosis.': 'Cette intervention a déjà un diagnostic.',
  'There is no diagnosis to record against.': 'Il n’y a aucun diagnostic où consigner cela.',
  'That cause is not one this diagnosis considered.':
    'Cette cause ne fait pas partie de celles examinées par ce diagnostic.',
  'What the complaint was, what was ruled on, and what this workshop has found it to be before. Nothing here is a guess about this car.':
    'La plainte, ce qui a été tranché, et ce que cet atelier a déjà trouvé pour la même plainte. Rien ici n’est une supposition sur ce véhicule.',
  'No complaints are set up yet. A workshop adds its own in settings.':
    'Aucune plainte n’est encore définie. Un atelier ajoute les siennes dans les réglages.',
  'What did they come in with?': 'Avec quoi sont-ils venus ?',
  'Start a diagnosis': 'Ouvrir un diagnostic',
  'Still open': 'Toujours en cours',
  Confirmed: 'Confirmée',
  'Ruled out': 'Écartée',
  'Not determined': 'Non déterminée',
  'What it has turned out to be here': 'Ce que cela s’est révélé être ici',
  'Nothing has been confirmed here often enough to be worth showing. It will appear once {enough} jobs have settled on the same cause.':
    'Rien n’a encore été confirmé assez souvent ici pour mériter d’être affiché. Cela apparaîtra lorsque {enough} interventions auront conclu à la même cause.',
  'In this workshop, {jobs} jobs that began with “{symptom}” reached a verdict. These are what they turned out to be.':
    'Dans cet atelier, {jobs} interventions parties de « {symptom} » ont abouti à un verdict. Voici ce qu’elles se sont révélées être.',
  'Confirmed {confirmed} times, never ruled out': 'Confirmée {confirmed} fois, jamais écartée',
  'Confirmed {confirmed} times, ruled out {rejected}':
    'Confirmée {confirmed} fois, écartée {rejected}',
};

export const ar = {
  'That is not a symptom this workshop uses.': 'ليست هذه شكوى تستخدمها هذه الورشة.',
  'This job already has a diagnosis.': 'لهذا العمل تشخيص بالفعل.',
  'There is no diagnosis to record against.': 'لا يوجد تشخيص لتسجيل ذلك فيه.',
  'That cause is not one this diagnosis considered.':
    'هذا السبب ليس من الأسباب التي نظر فيها هذا التشخيص.',
  'What the complaint was, what was ruled on, and what this workshop has found it to be before. Nothing here is a guess about this car.':
    'الشكوى، وما تم البتّ فيه، وما توصّلت إليه هذه الورشة سابقاً للشكوى نفسها. لا شيء هنا تخمين بشأن هذه السيارة.',
  'No complaints are set up yet. A workshop adds its own in settings.':
    'لم تُعرَّف أي شكاوى بعد. تضيف الورشة شكاواها من الإعدادات.',
  'What did they come in with?': 'بماذا حضروا؟',
  'Start a diagnosis': 'ابدأ تشخيصاً',
  'Still open': 'ما زال مفتوحاً',
  Confirmed: 'مؤكَّد',
  'Ruled out': 'مستبعَد',
  'Not determined': 'غير محدَّد',
  'What it has turned out to be here': 'ما تبيّن أنه كذلك هنا',
  'Nothing has been confirmed here often enough to be worth showing. It will appear once {enough} jobs have settled on the same cause.':
    'لم يتأكد شيء هنا بما يكفي لعرضه. سيظهر عندما تنتهي {enough} أعمال إلى السبب نفسه.',
  'In this workshop, {jobs} jobs that began with “{symptom}” reached a verdict. These are what they turned out to be.':
    'في هذه الورشة، بلغت {jobs} من الأعمال التي بدأت بـ «{symptom}» حكماً نهائياً. وهذا ما تبيّن أنها كانت.',
  'Confirmed {confirmed} times, never ruled out': 'مؤكَّد {confirmed} مرات، ولم يُستبعد قط',
  'Confirmed {confirmed} times, ruled out {rejected}':
    'مؤكَّد {confirmed} مرات، ومستبعَد {rejected}',
};
