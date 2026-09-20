/**
 * Working at more than one workshop. Phase 63.
 *
 * Four of these are reached through `t(describeChoice(...))` — a variable, not
 * a literal, so no scanner that collects literals can see them. That gap has
 * now appeared in Phases 57, 59, 62 and here; `verify-belonging` checks these
 * four where the sentences are built, which is the only place that knows what
 * they can be.
 *
 * Three of them carry slots. The translator reads a finished English sentence
 * back into its slots and fills the same slots in the other language, so a
 * workshop's name passes through untranslated and the words around it do not.
 */

export const fr: Readonly<Record<string, string>> = {
  'Which workshop?': 'Quel atelier ?',
  'Switch workshop': 'Changer d’atelier',
  'You can move between them at any time from the workshop’s name.':
    'Vous pouvez passer de l’un à l’autre à tout moment depuis le nom de l’atelier.',
  'Already have a Carnet account on this address? Enter that account’s password and this invitation attaches the workshop to it. We ask because the link alone should never sign anybody in as you.':
    'Vous avez déjà un compte Carnet à cette adresse ? Saisissez le mot de passe de ce compte et cette invitation y rattachera l’atelier. Nous le demandons parce qu’un lien seul ne devrait jamais connecter quelqu’un à votre place.',

  // Built in core, reached through a variable
  'You are not on any workshop’s team.': 'Vous ne faites partie de l’équipe d’aucun atelier.',
  'You work at {v1}.': 'Vous travaillez chez {v1}.',
  'You work at {v1} and {v2}. Choose which one you are in.':
    'Vous travaillez chez {v1} et chez {v2}. Choisissez celui où vous êtes.',
  'You work at {v1} workshops. Choose which one you are in.':
    'Vous travaillez dans {v1} ateliers. Choisissez celui où vous êtes.',

  // Refusals
  'That is not a workshop you work at.': 'Ce n’est pas un atelier où vous travaillez.',
  'That is not the password for this email address. This invitation is for an account that already exists.':
    'Ce n’est pas le mot de passe de cette adresse. Cette invitation concerne un compte qui existe déjà.',
  'That account is closed. Ask whoever invited you to use another address.':
    'Ce compte est clos. Demandez à la personne qui vous a invité d’utiliser une autre adresse.',
};

export const ar: Readonly<Record<string, string>> = {
  'Which workshop?': 'أي ورشة؟',
  'Switch workshop': 'تغيير الورشة',
  'You can move between them at any time from the workshop’s name.':
    'يمكنك الانتقال بينها في أي وقت من اسم الورشة.',
  'Already have a Carnet account on this address? Enter that account’s password and this invitation attaches the workshop to it. We ask because the link alone should never sign anybody in as you.':
    'هل لديك حساب Carnet على هذا العنوان؟ أدخل كلمة مرور ذلك الحساب وستُضاف الورشة إليه بهذه الدعوة. نطلبها لأن الرابط وحده يجب ألّا يُدخل أحدًا باسمك أبدًا.',

  'You are not on any workshop’s team.': 'لست ضمن فريق أي ورشة.',
  'You work at {v1}.': 'أنت تعمل في {v1}.',
  'You work at {v1} and {v2}. Choose which one you are in.':
    'أنت تعمل في {v1} وفي {v2}. اختر التي أنت فيها.',
  'You work at {v1} workshops. Choose which one you are in.':
    'أنت تعمل في {v1} ورش. اختر التي أنت فيها.',

  'That is not a workshop you work at.': 'هذه ليست ورشة تعمل فيها.',
  'That is not the password for this email address. This invitation is for an account that already exists.':
    'هذه ليست كلمة مرور هذا العنوان. هذه الدعوة لحساب موجود بالفعل.',
  'That account is closed. Ask whoever invited you to use another address.':
    'هذا الحساب مغلق. اطلب ممن دعاك استخدام عنوان آخر.',
};
