// Brazilian Portuguese (pt-BR) strings for the sessions UI. Code-split: loaded only when a visitor
// picks or has stored 'pt' (src/lib/loadLocale.ts). English (src/lib/translations.ts)
// is the static default and the fallback for any key missing here.
// Add every new key to the same place in en (translations.ts) and here, or to an
// area file translations<Area>.ts (all five locales), which is spread in below.
// Brazilian Portuguese (pt-BR), sessions only. The main dictionary lives in three files
// (translationsPtA/B/C.ts) so it can be translated in parallel; see .claude/pt-glossary.md.
// Any key still missing falls back to English in t() (LanguageContext).
import { advisorBoardTranslations } from '../translationsAdvisorBoard';
import { advisorRoomTranslations } from '../translationsAdvisorRoom';
import { advisorConfTranslations } from '../translationsAdvisorConf';
import { commentDockTranslations } from '../translationsCommentDock';
import { docIntroTranslations } from '../translationsDocIntro';
import { motionCardsTranslations } from '../translationsMotionCards';
import { scoreAdjustTranslations } from '../translationsScoreAdjust';
import { placeholderTranslations } from '../translationsPlaceholders';
import { floorToolsTranslations } from '../translationsFloorTools';
import { createJoinTranslations } from '../translationsCreateJoin';
import { restartTranslations } from '../translationsRestart';
import { sessionsVideoTranslations } from '../translationsSessionsVideo';
import { seatAdmissionTranslations } from '../translationsSeatAdmission';
import { rollCallPickerTranslations } from '../translationsRollCallPicker';
import { tutorialTranslations } from '../translationsTutorial';
import { broadcastsTranslations } from '../translationsBroadcasts';
import { ptTranslationsA } from '../translationsPtA';
import { ptTranslationsB } from '../translationsPtB';
import { ptTranslationsC } from '../translationsPtC';
import type { LocaleStrings } from '../translations';

const pt: LocaleStrings = {
    ...advisorBoardTranslations.pt,
    ...advisorRoomTranslations.pt,
    ...advisorConfTranslations.pt,
    ...commentDockTranslations.pt,
    ...docIntroTranslations.pt,
    ...motionCardsTranslations.pt,
    ...scoreAdjustTranslations.pt,
    ...floorToolsTranslations.pt,
    ...createJoinTranslations.pt,
    ...restartTranslations.pt,
    ...sessionsVideoTranslations.pt,
    ...seatAdmissionTranslations.pt,
    ...rollCallPickerTranslations.pt,
    ...tutorialTranslations.pt,
    ...broadcastsTranslations.pt,
    ...placeholderTranslations.pt,
    ...ptTranslationsA,
    ...ptTranslationsB,
    ...ptTranslationsC,
};

export default pt;
