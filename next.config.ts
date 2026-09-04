import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* The share-card routes read four Outfit TTFs and the brand mark off disk at
     module scope. Nothing IMPORTS those files, so without this declaration the
     tracer only copies them by inferring an include from a `join(process.cwd(),
     '<literal>')` call — which works, but leaves the bundle contents dependent
     on the tracer recognising one particular code shape. Declaring them makes
     it explicit: change the filenames and you change this glob.

     Not to be confused with the "Encountered unexpected file in NFT list"
     warning these two routes emit. That one is NOT ours: it survives deleting
     every filesystem call in _shared/ (verified — stub them all out and the
     warning is unchanged), and `turbopackIgnore` comments do not silence it.
     It comes from next/og's own dynamic requires for its wasm renderer, so it
     is fixed upstream or not at all. */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'luruhkwrgisytejswlas.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
