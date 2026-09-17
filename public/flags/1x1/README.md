# Circular flag artwork

`xx.svg`, one per ISO 3166-1 alpha-2 code (lowercase), plus the few special
two-letter codes the source ships (`eu`, `un`, `xk`, `xx`).

Source: [circle-flags](https://github.com/HatScripts/circle-flags) by HatScripts,
npm `circle-flags@2.8.3`, the `flags/??.svg` files copied unmodified, EXCEPT the
flags listed below.

### Overrides from flag-icons (17 Sep 2026)

circle-flags draws national emblems as flat pictograms, and for these flags the
pictogram was wrong or unrecognisable (Afghanistan had an invented ring and a
bulging red band instead of the national emblem, `un.svg` was a ship's wheel
instead of the UN world map and olive branches, the Holy See had no tiara,
Iran had battlements instead of the takbir, Brazil had no stars or motto, and so
on). These 22 files are the square `flags/1x1/xx.svg` artwork from
[flag-icons](https://github.com/lipis/flag-icons) by Panayiotis Lipiridis,
npm `flag-icons@7.5.0`, with only `width="512" height="512"` added to the root
element. They are 512x512 squares with the emblem centred, so `CircleFlag`'s
round clip draws them the same way:

`ad al af br bt bz do ec eg er gt ht ir kz md me mt pt sm sv un va`

Afghanistan is the black-red-green tricolour with the emblem of the Islamic
Republic, the flag the Afghan seat at the UN still uses. Any other flag stays
circle-flags; do not replace a file with a newer circle-flags copy without
checking this list.

Each file is a 512x512 square whose artwork is already designed for a circle
(emblems re-centred, masked to a disc), so it fills a round frame edge to edge.
This is the same approach MUNCommand takes with its own bespoke round flags.

Render them ONLY through `src/components/CircleFlag.tsx` (URL helper:
`getCircleFlagUrl` in `src/lib/countries.ts`). Rectangular flags stay on
`getFlagUrl` (Twemoji).

## License

MIT License

Copyright (c) 2026 HatScripts

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

flag-icons (the override files above):

The MIT License (MIT)

Copyright (c) 2013 Panayiotis Lipiridis

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
