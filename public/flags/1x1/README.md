# Circular flag artwork

`xx.svg`, one per ISO 3166-1 alpha-2 code (lowercase), plus the few special
two-letter codes the source ships (`eu`, `un`, `xk`, `xx`).

Two MIT sources, chosen flag by flag (18 Sep 2026, "some flags in the circles
are still weird, Argentina, Cyprus"):

### 1. flag-icons (the default for every country, observer and entity we list)

[flag-icons](https://github.com/lipis/flag-icons) by Panayiotis Lipiridis, npm
`flag-icons@7.5.0`, the square `flags/1x1/xx.svg` artwork, with only
`width="512" height="512"` added to the root element. It draws the real flag:
official colours and the real emblems. circle-flags redraws every flag in one
flat palette (#0052b4 blue, #338af3 sky, #d80027 red, #6da544 / #496e2d green,
#ffda44 yellow), which made many flags simply wrong: Argentina a mid blue with a
faceless twelve-point star for the Sun of May, Cyprus a yellow blob in a green
horseshoe, Azerbaijan and the Bahamas the wrong blues, Belarus without its
ornament band, Bolivia without its arms, Bosnia, Botswana, Bulgaria, Bangladesh,
Algeria in the wrong shades, Brunei, Cambodia, Kenya, Angola as crude pictograms.

Used for all 202 codes in `UN_COUNTRIES` plus `un` and `eh`, EXCEPT the lists
below. Where flag-icons uses a pure screen primary (#ff0, #0c0, #00f, `red`),
the large fields were set to the flag's official shades:
`bw cg ci cn dj gm gn jm jo kg km ml sd sl sn tz`.

Three flag-icons files had an emblem the round clip cut through, and the emblem
group was moved inward (a `transform` on that one group, nothing redrawn):
`uy` (the Sun of May), `om` (the national emblem), `fj` (the shield).

### 2. circle-flags, recoloured (canton flags the square crop cuts)

[circle-flags](https://github.com/HatScripts/circle-flags) by HatScripts, npm
`circle-flags@2.8.3`. Its designers moved each canton inside the disc, which a
square crop cannot do, so for these the geometry is circle-flags and the colours
were replaced with the official ones (and #eee white with #fff):
`cf ck li my sb sg to tv us uz ws`.

(Australia, New Zealand, Niue and Greece keep flag-icons: their canton is cut at
the rim exactly as the real flag would be, and nothing in it becomes illegible.)

Files for codes we never list (territories, `xx`, etc.) are still the untouched
circle-flags copies. Before replacing ANY file with a newer copy from either
package, render it in a circle at 26, 52 and 164 px and compare.

Each file is a 512x512 square, so it fills a round frame edge to edge. Nepal is
the one flag that is not a rectangle and shows the page ground around it.

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
