export type Language = 'en' | 'es';

export const translations = {
  en: {
    // Nav
    'nav.sessions': 'SESSIONS',
    'nav.conferences': 'CONFERENCES',
    'nav.about': 'ABOUT US',
    'nav.contact': 'CONTACT',
    'nav.signIn': 'SIGN IN',
    'nav.signOut': 'SIGN OUT',
    'nav.myProfile': 'MY PROFILE',
    'nav.munCv': 'MUN CV',
    'nav.conferenceCalendar': 'CONFERENCE CALENDAR',
    'nav.gavellingPoints': 'GAVELLING POINTS',
    'nav.upgradeUnlimited': 'UPGRADE TO UNLIMITED',
    'nav.gavellingUnlimited': 'GAVELLING UNLIMITED ✦',

    // Landing / home
    'home.startSession': 'Start a Session',
    'home.joinSession': 'Join a Session',
    'home.enterCode': 'Enter session code',
    'home.join': 'Join',
    'home.create': 'Create Committee',
    'home.recentSessions': 'Recent Sessions',
    'home.noRecentSessions': 'No recent sessions',

    // Session phases
    'phase.preSession': 'Pre-Session',
    'phase.rollCall': 'Roll Call',
    'phase.speakersList': 'General Speakers List',
    'phase.moderatedCaucus': 'Moderated Caucus',
    'phase.unmoderatedCaucus': 'Unmoderated Caucus',
    'phase.voting': 'Voting',
    'phase.adjourned': 'Adjourned',

    // Roll call
    'rollCall.present': 'Present',
    'rollCall.presentVoting': 'Present & Voting',
    'rollCall.absent': 'Absent',
    'rollCall.allPresent': 'All Present',
    'rollCall.allPresentVoting': 'All P+V',
    'rollCall.clearAll': 'Clear All',
    'rollCall.beginSession': 'Begin Session',

    // Speakers list
    'gsl.addSpeaker': 'Add Speaker',
    'gsl.nextSpeaker': 'Next',
    'gsl.startTimer': 'Start',
    'gsl.pauseTimer': 'Pause',
    'gsl.extraTime': '+⏱',
    'gsl.rightOfReply': 'Right of Reply',
    'gsl.noSpeakers': 'No speakers in queue',
    'gsl.currentSpeaker': 'Current Speaker',
    'gsl.requestToSpeak': 'Request to Speak',
    'gsl.yourRequestDenied': 'Your request was denied',
    'gsl.requestAgain': 'Request Again',

    // Motions
    'motions.title': 'Motions',
    'motions.raise': 'Raise Motion',
    'motions.accept': 'Accept',
    'motions.reject': 'Reject',
    'motions.moderated': 'Moderated Caucus',
    'motions.unmoderated': 'Unmoderated Caucus',
    'motions.consultation': 'Consultation of the Whole',
    'motions.tourDeTable': 'Tour de Table',
    'motions.suspendDebate': 'Suspend Debate',
    'motions.endDebate': 'End Debate',
    'motions.pass': 'Does this motion pass?',
    'motions.yes': 'Yes',
    'motions.no': 'No',
    'motions.noPending': 'No pending motions',

    // Caucus
    'caucus.purpose': 'Purpose',
    'caucus.totalTime': 'Total Time',
    'caucus.speakingTime': 'Speaking Time',
    'caucus.maxSpeakers': 'Max Speakers',
    'caucus.timeRemaining': 'Time Remaining',
    'caucus.addSpeaker': 'Add Speaker',
    'caucus.nextSpeaker': 'Next Speaker',
    'caucus.endCaucus': 'End Caucus',
    'caucus.maxReached': 'Maximum speakers reached',

    // Voting
    'voting.inFavour': 'In Favour',
    'voting.inFavourWithRights': 'In Favour with Rights',
    'voting.abstain': 'Abstain',
    'voting.againstWithRights': 'Against with Rights',
    'voting.against': 'Against',
    'voting.result': 'Result',
    'voting.passed': 'PASSED',
    'voting.failed': 'FAILED',
    'voting.voteAgain': 'Vote Again',
    'voting.backToSession': 'Back to Session',

    // Documents
    'documents.title': 'Documents',
    'documents.workingPapers': 'Working Papers',
    'documents.draftResolutions': 'Draft Resolutions',
    'documents.submit': 'Submit',
    'documents.introduce': 'Introduce',
    'documents.status.submitted': 'Submitted',
    'documents.status.onFloor': 'On Floor',
    'documents.status.introduced': 'Introduced',
    'documents.status.passed': 'Passed',
    'documents.status.failed': 'Failed',

    // Chat
    'chat.title': 'Chat',
    'chat.everyone': 'Everyone',
    'chat.placeholder': 'Type a message...',
    'chat.send': 'Send',
    'chat.newMessage': 'New message',

    // Settings
    'settings.title': 'Settings',
    'settings.voting': 'Voting',
    'settings.motions': 'Motions',
    'settings.access': 'Access',
    'settings.points': 'Points',

    // Suspend / End
    'suspend.title': 'Session Suspended',
    'suspend.resumeSession': 'Resume Session',
    'suspend.resuming': '{name} is resuming...',
    'end.title': 'Session Ended',
    'end.viewOnly': 'View Only',
    'end.deletesIn': 'Session deletes in {time}',

    // Delegate view
    'delegate.notOnList': 'Not on any speaker list',
    'delegate.youHaveFloor': 'You have the floor!',
    'delegate.youreUpNext': "You're up next!",
    'delegate.speakersUntil': '{n} speaker(s) until your speech',
    'delegate.requestToJoin': 'Request to Join',
    'delegate.tabs.session': 'Session',
    'delegate.tabs.motions': 'Motions',
    'delegate.tabs.viewDocs': 'View Documents',
    'delegate.tabs.submitDocs': 'Submit Documents',
    'delegate.tabs.stats': 'Stats',

    // Errors / generic
    'error.notFound': 'Not Found',
    'error.tryAgain': 'Try Again',
    'loading': 'Loading...',
    'save': 'Save',
    'cancel': 'Cancel',
    'close': 'Close',
    'confirm': 'Confirm',
    'delete': 'Delete',
    'edit': 'Edit',
    'add': 'Add',
    'remove': 'Remove',
    'search': 'Search',
    'minutes': 'min',
    'seconds': 'sec',
  },

  es: {
    // Nav
    'nav.sessions': 'SESIONES',
    'nav.conferences': 'CONFERENCIAS',
    'nav.about': 'NOSOTROS',
    'nav.contact': 'CONTACTO',
    'nav.signIn': 'INICIAR SESIÓN',
    'nav.signOut': 'CERRAR SESIÓN',
    'nav.myProfile': 'MI PERFIL',
    'nav.munCv': 'CV DE MUN',
    'nav.conferenceCalendar': 'CALENDARIO DE CONFERENCIAS',
    'nav.gavellingPoints': 'PUNTOS GAVELLING',
    'nav.upgradeUnlimited': 'MEJORAR A ILIMITADO',
    'nav.gavellingUnlimited': 'GAVELLING ILIMITADO ✦',

    // Landing / home
    'home.startSession': 'Iniciar Sesión',
    'home.joinSession': 'Unirse a Sesión',
    'home.enterCode': 'Ingresar código de sesión',
    'home.join': 'Unirse',
    'home.create': 'Crear Comité',
    'home.recentSessions': 'Sesiones Recientes',
    'home.noRecentSessions': 'Sin sesiones recientes',

    // Session phases
    'phase.preSession': 'Pre-Sesión',
    'phase.rollCall': 'Lista de Asistencia',
    'phase.speakersList': 'Lista General de Oradores',
    'phase.moderatedCaucus': 'Caucus Moderado',
    'phase.unmoderatedCaucus': 'Caucus No Moderado',
    'phase.voting': 'Votación',
    'phase.adjourned': 'Suspendida',

    // Roll call
    'rollCall.present': 'Presente',
    'rollCall.presentVoting': 'Presente y Votando',
    'rollCall.absent': 'Ausente',
    'rollCall.allPresent': 'Todos Presentes',
    'rollCall.allPresentVoting': 'Todos P+V',
    'rollCall.clearAll': 'Limpiar Todo',
    'rollCall.beginSession': 'Iniciar Sesión',

    // Speakers list
    'gsl.addSpeaker': 'Agregar Orador',
    'gsl.nextSpeaker': 'Siguiente',
    'gsl.startTimer': 'Iniciar',
    'gsl.pauseTimer': 'Pausar',
    'gsl.extraTime': '+⏱',
    'gsl.rightOfReply': 'Derecho de Respuesta',
    'gsl.noSpeakers': 'Sin oradores en la cola',
    'gsl.currentSpeaker': 'Orador Actual',
    'gsl.requestToSpeak': 'Solicitar Hablar',
    'gsl.yourRequestDenied': 'Tu solicitud fue denegada',
    'gsl.requestAgain': 'Solicitar de Nuevo',

    // Motions
    'motions.title': 'Mociones',
    'motions.raise': 'Elevar Moción',
    'motions.accept': 'Aceptar',
    'motions.reject': 'Rechazar',
    'motions.moderated': 'Caucus Moderado',
    'motions.unmoderated': 'Caucus No Moderado',
    'motions.consultation': 'Consulta del Pleno',
    'motions.tourDeTable': 'Tour de Table',
    'motions.suspendDebate': 'Suspender Debate',
    'motions.endDebate': 'Finalizar Debate',
    'motions.pass': '¿Esta moción es aprobada?',
    'motions.yes': 'Sí',
    'motions.no': 'No',
    'motions.noPending': 'Sin mociones pendientes',

    // Caucus
    'caucus.purpose': 'Propósito',
    'caucus.totalTime': 'Tiempo Total',
    'caucus.speakingTime': 'Tiempo de Habla',
    'caucus.maxSpeakers': 'Oradores Máx.',
    'caucus.timeRemaining': 'Tiempo Restante',
    'caucus.addSpeaker': 'Agregar Orador',
    'caucus.nextSpeaker': 'Siguiente Orador',
    'caucus.endCaucus': 'Finalizar Caucus',
    'caucus.maxReached': 'Se alcanzó el máximo de oradores',

    // Voting
    'voting.inFavour': 'A Favor',
    'voting.inFavourWithRights': 'A Favor con Derechos',
    'voting.abstain': 'Abstención',
    'voting.againstWithRights': 'En Contra con Derechos',
    'voting.against': 'En Contra',
    'voting.result': 'Resultado',
    'voting.passed': 'APROBADA',
    'voting.failed': 'RECHAZADA',
    'voting.voteAgain': 'Votar de Nuevo',
    'voting.backToSession': 'Volver a Sesión',

    // Documents
    'documents.title': 'Documentos',
    'documents.workingPapers': 'Documentos de Trabajo',
    'documents.draftResolutions': 'Resoluciones en Borrador',
    'documents.submit': 'Enviar',
    'documents.introduce': 'Introducir',
    'documents.status.submitted': 'Enviado',
    'documents.status.onFloor': 'En Plenario',
    'documents.status.introduced': 'Introducido',
    'documents.status.passed': 'Aprobado',
    'documents.status.failed': 'Rechazado',

    // Chat
    'chat.title': 'Chat',
    'chat.everyone': 'Todos',
    'chat.placeholder': 'Escribe un mensaje...',
    'chat.send': 'Enviar',
    'chat.newMessage': 'Nuevo mensaje',

    // Settings
    'settings.title': 'Configuración',
    'settings.voting': 'Votación',
    'settings.motions': 'Mociones',
    'settings.access': 'Acceso',
    'settings.points': 'Puntos',

    // Suspend / End
    'suspend.title': 'Sesión Suspendida',
    'suspend.resumeSession': 'Reanudar Sesión',
    'suspend.resuming': '{name} está reanudando...',
    'end.title': 'Sesión Finalizada',
    'end.viewOnly': 'Solo Lectura',
    'end.deletesIn': 'La sesión se elimina en {time}',

    // Delegate view
    'delegate.notOnList': 'No estás en ninguna lista de oradores',
    'delegate.youHaveFloor': '¡Tienes la palabra!',
    'delegate.youreUpNext': '¡Eres el siguiente!',
    'delegate.speakersUntil': '{n} orador(es) antes de tu discurso',
    'delegate.requestToJoin': 'Solicitar Unirse',
    'delegate.tabs.session': 'Sesión',
    'delegate.tabs.motions': 'Mociones',
    'delegate.tabs.viewDocs': 'Ver Documentos',
    'delegate.tabs.submitDocs': 'Enviar Documentos',
    'delegate.tabs.stats': 'Estadísticas',

    // Errors / generic
    'error.notFound': 'No Encontrado',
    'error.tryAgain': 'Intentar de Nuevo',
    'loading': 'Cargando...',
    'save': 'Guardar',
    'cancel': 'Cancelar',
    'close': 'Cerrar',
    'confirm': 'Confirmar',
    'delete': 'Eliminar',
    'edit': 'Editar',
    'add': 'Agregar',
    'remove': 'Quitar',
    'search': 'Buscar',
    'minutes': 'min',
    'seconds': 'seg',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
