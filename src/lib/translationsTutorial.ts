// The chair tutorial's first card (owner, 21 Oct 2026): the chair guide video big, and
// two smaller slots under it for the delegate and faculty advisor videos, each drawn only
// once its YouTube id is set (DELEGATE_VIDEO_ID / ADVISOR_VIDEO_ID in
// src/components/TutorialOverlay.tsx). The big video reuses the /sessions keys
// (sl_video_kicker, sl_video_title, sl_video_play). The step copy itself is inline in
// TutorialOverlay.tsx (pick). Spread into every locale in translations.ts; every key
// exists in all five.
export const tutorialTranslations = {
  en: {
    tutorial_video_delegates: 'For delegates',
    tutorial_video_advisors: 'For faculty advisors',
  },
  es: {
    tutorial_video_delegates: 'Para delegados',
    tutorial_video_advisors: 'Para profesores asesores',
  },
  fr: {
    tutorial_video_delegates: 'Pour les délégués',
    tutorial_video_advisors: 'Pour les conseillers pédagogiques',
  },
  ar: {
    tutorial_video_delegates: 'للمندوبين',
    tutorial_video_advisors: 'للمشرفين الأكاديميين',
  },
  pt: {
    tutorial_video_delegates: 'Para delegados',
    tutorial_video_advisors: 'Para orientadores',
  },
};
