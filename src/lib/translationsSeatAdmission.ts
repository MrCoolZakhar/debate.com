// Keys for "every join waits for the chair" (owner, 17 Oct 2026: "this should be everytime
// they try to join"). With "Join without approval" blocked, a phone taking a seat that roll
// call already marked Present still waits in the Waiting Room for the chair's Approve
// (src/lib/seatAdmission.ts). Read by the delegate page's Waiting Room. Spread into each
// locale in translations.ts; every key must exist in all five.
export const seatAdmissionTranslations = {
  en: {
    delegate_admit_present_desc: 'The chair lets each phone in. Ask to join and wait for them to approve',
    delegate_admit_ask: 'Ask to join',
    delegate_admit_failed: 'Your request did not send. Check your connection and try again',
  },
  es: {
    delegate_admit_present_desc: 'La mesa deja entrar a cada teléfono. Pide entrar y espera su aprobación',
    delegate_admit_ask: 'Pedir entrar',
    delegate_admit_failed: 'Tu solicitud no se envió. Revisa tu conexión e inténtalo de nuevo',
  },
  fr: {
    delegate_admit_present_desc: 'La présidence fait entrer chaque téléphone. Demandez à entrer et attendez son accord',
    delegate_admit_ask: 'Demander à entrer',
    delegate_admit_failed: "Votre demande n'a pas été envoyée. Vérifiez votre connexion et réessayez",
  },
  ar: {
    delegate_admit_present_desc: 'يسمح الرئيس بدخول كل هاتف. اطلب الدخول وانتظر موافقته',
    delegate_admit_ask: 'اطلب الدخول',
    delegate_admit_failed: 'لم يُرسل طلبك. تحقق من اتصالك وحاول مرة أخرى',
  },
  pt: {
    delegate_admit_present_desc: 'A mesa deixa entrar cada telefone. Peça para entrar e aguarde a aprovação',
    delegate_admit_ask: 'Pedir para entrar',
    delegate_admit_failed: 'Seu pedido não foi enviado. Verifique sua conexão e tente novamente',
  },
};
