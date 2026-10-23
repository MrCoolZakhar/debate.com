// Keys for "every join waits for the chair" (owner, 17 Oct 2026: "this should be everytime
// they try to join"). With "Join without approval" blocked, a phone taking a seat that roll
// call already marked Present still waits in the Waiting Room for the chair's Approve
// (src/lib/seatAdmission.ts). Read by the delegate page's Waiting Room. Spread into each
// locale in translations.ts; every key must exist in all five.
// delegate_not_in_room_*: the seat let this phone in but the room has no row for its
// delegation yet, so the status controls make way for this panel until the chair adds it.
export const seatAdmissionTranslations = {
  en: {
    delegate_admit_present_desc: 'The chair lets each phone in. Ask to join and wait for them to approve',
    delegate_admit_ask: 'Ask to join',
    delegate_admit_failed: 'Your request did not send. Check your connection and try again',
    delegate_not_in_room_title: 'Not in the Room Yet',
    delegate_not_in_room_body: 'The chair needs to add your delegation to the room. You will be let in as soon as they do',
  },
  es: {
    delegate_admit_present_desc: 'La mesa deja entrar a cada teléfono. Pide entrar y espera su aprobación',
    delegate_admit_ask: 'Pedir entrar',
    delegate_admit_failed: 'Tu solicitud no se envió. Revisa tu conexión e inténtalo de nuevo',
    delegate_not_in_room_title: 'Aún No Estás en la Sala',
    delegate_not_in_room_body: 'La mesa tiene que añadir tu delegación a la sala. Entrarás en cuanto lo haga',
  },
  fr: {
    delegate_admit_present_desc: 'La présidence fait entrer chaque téléphone. Demandez à entrer et attendez son accord',
    delegate_admit_ask: 'Demander à entrer',
    delegate_admit_failed: "Votre demande n'a pas été envoyée. Vérifiez votre connexion et réessayez",
    delegate_not_in_room_title: 'Pas Encore dans la Salle',
    delegate_not_in_room_body: 'La présidence doit ajouter votre délégation à la salle. Vous entrerez dès que ce sera fait',
  },
  ar: {
    delegate_admit_present_desc: 'يسمح الرئيس بدخول كل هاتف. اطلب الدخول وانتظر موافقته',
    delegate_admit_ask: 'اطلب الدخول',
    delegate_admit_failed: 'لم يُرسل طلبك. تحقق من اتصالك وحاول مرة أخرى',
    delegate_not_in_room_title: 'لست في القاعة بعد',
    delegate_not_in_room_body: 'يجب على الرئيس إضافة وفدك إلى القاعة. ستدخل فور قيامه بذلك',
  },
  pt: {
    delegate_admit_present_desc: 'A mesa deixa entrar cada telefone. Peça para entrar e aguarde a aprovação',
    delegate_admit_ask: 'Pedir para entrar',
    delegate_admit_failed: 'Seu pedido não foi enviado. Verifique sua conexão e tente novamente',
    delegate_not_in_room_title: 'Ainda Não Está na Sala',
    delegate_not_in_room_body: 'A mesa precisa adicionar sua delegação à sala. Você entra assim que ela fizer isso',
  },
};
