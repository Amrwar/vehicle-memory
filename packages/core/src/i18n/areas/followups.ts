/**
 * Chasing something later. Phase 66.
 *
 * The four standings — done, due today, so many days late, due later — are
 * built in core and handed to `t()` as a variable, so no scanner collecting
 * literals can see them. `verify-followups` asks the translator for each one
 * instead, which is the fifth place that gap has been closed one list at a
 * time (Phases 57, 59, 62, 63, and here).
 *
 * "1 day late" and "3 days late" are one key with a slot. The translator reads
 * the finished English sentence back into its slot and fills the same slot in
 * the other language, so the count passes through and the words around it do
 * not — which is also why the singular has a key of its own rather than being
 * the same sentence with a 1 in it.
 */

export const fr: Readonly<Record<string, string>> = {
  'Follow up': 'À rappeler',
  'To chase': 'À relancer',
  'For you to chase': 'À relancer, pour vous',
  'Late, or due today': 'En retard, ou pour aujourd’hui',
  'Work that was put off until later, and later is now.':
    'Ce qui avait été remis à plus tard, et plus tard, c’est maintenant.',
  'Something to do after the car has gone: ring them about the work they turned down, chase a part, check a noise did not come back.':
    'Quelque chose à faire une fois la voiture partie : les rappeler au sujet des travaux qu’ils ont refusés, relancer une pièce, vérifier qu’un bruit n’est pas revenu.',
  'Nothing to chase on this job.': 'Rien à relancer sur cet ordre de réparation.',
  'Add a follow-up': 'Ajouter un rappel',
  'What needs doing': 'Ce qu’il faut faire',
  'By when': 'Pour quand',
  Who: 'Qui',
  Anybody: 'N’importe qui',
  'Ring about the rear discs they turned down':
    'Rappeler au sujet des disques arrière qu’ils ont refusés',
  '{who}, by {when}': '{who}, pour le {when}',
  'Anybody, by {when}': 'N’importe qui, pour le {when}',
  'done by {who}': 'fait par {who}',

  // Built in core, reached through a variable
  Done: 'Fait',
  'Due today': 'Pour aujourd’hui',
  'Due later': 'Pour plus tard',
  '1 day late': '1 jour de retard',
  '{v1} days late': '{v1} jours de retard',

  // Refusals
  'Say what needs doing, so somebody else could do it.':
    'Dites ce qu’il faut faire, afin qu’une autre personne puisse s’en charger.',
  'That date is over a year ago. Check the year.':
    'Cette date remonte à plus d’un an. Vérifiez l’année.',
  'That has already been done.': 'Cela a déjà été fait.',
  'That job is not one of yours.': 'Cet ordre de réparation n’est pas le vôtre.',
  'That follow-up is not one of yours.': 'Ce rappel n’est pas le vôtre.',
  'That is not somebody on this team.': 'Cette personne ne fait pas partie de cette équipe.',
};

export const ar: Readonly<Record<string, string>> = {
  'Follow up': 'متابعة',
  'To chase': 'للمتابعة',
  'For you to chase': 'عليك متابعتها',
  'Late, or due today': 'متأخرة، أو مستحقة اليوم',
  'Work that was put off until later, and later is now.':
    'عمل أُجّل إلى وقت لاحق، والوقت اللاحق هو الآن.',
  'Something to do after the car has gone: ring them about the work they turned down, chase a part, check a noise did not come back.':
    'شيء يُفعل بعد مغادرة السيارة: الاتصال بهم بشأن العمل الذي رفضوه، أو متابعة قطعة غيار، أو التأكد من أن الصوت لم يعد.',
  'Nothing to chase on this job.': 'لا شيء لمتابعته في هذه المهمة.',
  'Add a follow-up': 'إضافة متابعة',
  'What needs doing': 'ما الذي يجب عمله',
  'By when': 'بحلول متى',
  Who: 'من',
  Anybody: 'أي شخص',
  'Ring about the rear discs they turned down': 'الاتصال بشأن الأقراص الخلفية التي رفضوها',
  '{who}, by {when}': '{who}، بحلول {when}',
  'Anybody, by {when}': 'أي شخص، بحلول {when}',
  'done by {who}': 'أنجزها {who}',

  Done: 'تمّت',
  'Due today': 'مستحقة اليوم',
  'Due later': 'مستحقة لاحقًا',
  '1 day late': 'متأخرة يومًا واحدًا',
  '{v1} days late': 'متأخرة {v1} أيام',

  'Say what needs doing, so somebody else could do it.':
    'اذكر ما الذي يجب عمله، حتى يتمكن شخص آخر من القيام به.',
  'That date is over a year ago. Check the year.': 'هذا التاريخ يسبق عامًا كاملًا. تحقق من السنة.',
  'That has already been done.': 'لقد تمّ هذا بالفعل.',
  'That job is not one of yours.': 'هذه المهمة ليست من مهامك.',
  'That follow-up is not one of yours.': 'هذه المتابعة ليست من متابعاتك.',
  'That is not somebody on this team.': 'هذا الشخص ليس ضمن هذا الفريق.',
};
