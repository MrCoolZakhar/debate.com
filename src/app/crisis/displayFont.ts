// Gavelling Crisis: the one display face, used ONLY for the playful pop-up banners ("New Cabinet Directive!",
// "Meeting Request!"). Loaded once through next/font, so it is self-hosted and costs no extra request to Google.
import { Bungee } from 'next/font/google';

export const crisisDisplay = Bungee({ weight: '400', subsets: ['latin'], display: 'swap' });
