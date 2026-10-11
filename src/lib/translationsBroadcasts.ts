// Keys for organiser broadcasts shown in the chat, as messages from the Secretariat in the
// Everyone conversation (owner, 11 Oct 2026: "the announcement should now live in the
// everyone chat as a message from secretariat. make sure images also come through!").
//
// Read by src/components/chat/SecretariatMessage.tsx (the bubble), src/components/ChatPanel.tsx
// (the sender label, the list preview, the read-only bar when chat is off) and
// src/components/chat/ChatThread.tsx (the photo viewer's caption). Kept in its own file so
// several changes can land without colliding in translations.ts; spread into each locale
// there. Every key must exist in all five locales.
//
// Copy rules (CLAUDE.md §8): no em dashes, no full stop on a title or a one-line caption.
export const broadcastsTranslations = {
  en: {
    bc_secretariat: 'Secretariat',
    bc_pause: 'Asks the dais to suspend debate',
    bc_end: 'Asks the dais to end debate',
    bc_at: 'At {time}',
    bc_on_ack: 'When a chair acknowledges it',
    bc_image: 'Image from the Secretariat',
    bc_read_only: 'Only the Secretariat can post here',
    bc_chat_off: 'Chat is off for this committee. Messages from the Secretariat still arrive here',
  },
  es: {
    bc_secretariat: 'Secretaría',
    bc_pause: 'Pide a la mesa suspender el debate',
    bc_end: 'Pide a la mesa terminar el debate',
    bc_at: 'A las {time}',
    bc_on_ack: 'Cuando un miembro de la mesa lo confirme',
    bc_image: 'Imagen de la Secretaría',
    bc_read_only: 'Solo la Secretaría puede publicar aquí',
    bc_chat_off: 'El chat está desactivado en este comité. Los mensajes de la Secretaría siguen llegando aquí',
  },
  fr: {
    bc_secretariat: 'Secrétariat',
    bc_pause: 'Demande au bureau de suspendre le débat',
    bc_end: 'Demande au bureau de clore le débat',
    bc_at: 'À {time}',
    bc_on_ack: "Quand un président l'aura confirmé",
    bc_image: 'Image du Secrétariat',
    bc_read_only: 'Seul le Secrétariat peut publier ici',
    bc_chat_off: 'Le chat est désactivé pour ce comité. Les messages du Secrétariat arrivent toujours ici',
  },
  ar: {
    bc_secretariat: 'الأمانة العامة',
    bc_pause: 'تطلب من المنصة تعليق النقاش',
    bc_end: 'تطلب من المنصة إنهاء النقاش',
    bc_at: 'الساعة {time}',
    bc_on_ack: 'عندما يؤكده أحد الرؤساء',
    bc_image: 'صورة من الأمانة العامة',
    bc_read_only: 'الأمانة العامة وحدها يمكنها النشر هنا',
    bc_chat_off: 'الدردشة متوقفة في هذه اللجنة. تصل رسائل الأمانة العامة إلى هنا رغم ذلك',
  },
  pt: {
    bc_secretariat: 'Secretariado',
    bc_pause: 'Pede à mesa que suspenda o debate',
    bc_end: 'Pede à mesa que encerre o debate',
    bc_at: 'Às {time}',
    bc_on_ack: 'Quando um membro da mesa confirmar',
    bc_image: 'Imagem do Secretariado',
    bc_read_only: 'Somente o Secretariado pode publicar aqui',
    bc_chat_off: 'O chat está desativado neste comitê. As mensagens do Secretariado continuam chegando aqui',
  },
};
