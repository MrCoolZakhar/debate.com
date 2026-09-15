# Circular flag artwork

`xx.svg`, one per ISO 3166-1 alpha-2 code (lowercase), plus the few special
two-letter codes the source ships (`eu`, `un`, `xk`, `xx`).

Source: [circle-flags](https://github.com/HatScripts/circle-flags) by HatScripts,
npm `circle-flags@2.8.3`, the `flags/??.svg` files copied unmodified.

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
