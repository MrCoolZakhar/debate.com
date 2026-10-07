"""
Builds the Gavelling update newsletter from one edition file.

    python3 scripts/newsletter/build.py scripts/newsletter/editions/v2-05.json
        ->  scripts/newsletter/out/v2-05.html  and  out/v2-05.txt

Images are drawn from code (art/<name>.html, rendered by render.mjs) and uploaded to
the public bucket the other emails use:
    session-documents/email-assets/newsletter/<image_folder>/<file>
The bucket refuses overwrites, so a re-render goes to a new folder and the edition's
`image_folder` moves with it.

Click tracking: every link except the unsubscribe and the mailto feedback button is
    https://gavelling.com/r/{{CLICK_TOKEN}}/<key>
where <key> is a short slug and the edition's `links` object maps it to the real URL.
{{CLICK_TOKEN}} is filled per recipient at send time; the /r route looks the key up.
The unsubscribe link is left as {{UNSUBSCRIBE_URL}} and filled per recipient at send
time (https://gavelling.com/unsubscribe?t=<unsubscribe_token_for(email)>).

House style, matched to the emails already going out (the founder welcome):
white ground, a 560 px column, Arial, ink #1C1410, soft ink #4A4238, gold labels
#8A6414, links bold and underlined in forest #1B3828, images that scale to the
column. No em dashes, sentence case buttons, no arrow links.
"""
import html, json, os, re, sys
from urllib.parse import quote

BUCKET = ("https://luruhkwrgisytejswlas.supabase.co/storage/v1/object/public/"
          "session-documents/email-assets/newsletter")
LOGO = "https://gavelling.com/gavelling-lockup.png"
TRACK = "https://gavelling.com/r/{{CLICK_TOKEN}}/"
HERE = os.path.dirname(os.path.abspath(__file__))
TEAM_INBOX = "wearegavelling@gmail.com"

INK, SOFT, MUTED, GOLD, DEEP_GOLD, FOREST = "#1C1410", "#4A4238", "#8C7E6E", "#8A6414", "#B6871F", "#1B3828"
FONT = "Arial,Helvetica,sans-serif"
SERIF_ITALIC = "Georgia,'Times New Roman',serif"


def esc(s):
    return html.escape(s or "", quote=True)


def track(key):
    return TRACK + key


def check_links(ed, page, text):
    """Every tracked key used must be in the edition's `links` map, and nothing else is linked raw."""
    links = ed.get("links") or {}
    used = set(re.findall(r"/r/\{\{CLICK_TOKEN\}\}/([a-z0-9-]+)", page + text))
    problems = [f"link key '{k}' is used but missing from links" for k in sorted(used - set(links))]
    problems += [f"links['{k}'] is not an https URL" for k, v in links.items() if not str(v).startswith("https://")]
    for href in re.findall(r'href="([^"]+)"', page):
        if not (href.startswith(TRACK) or href.startswith("mailto:") or href == "{{UNSUBSCRIBE_URL}}"):
            problems.append(f"untracked link: {href}")
    if problems:
        sys.exit("Link check failed:\n  - " + "\n  - ".join(problems))
    return used


def check_copy(ed):
    """The copy rules the site follows, enforced here so no edition slips."""
    text = json.dumps(ed, ensure_ascii=False)
    problems = []
    if "—" in text or "–" in text:
        problems.append("an em or en dash is in the copy (CLAUDE.md: none anywhere users can see)")
    for f in ed["features"]:
        if f.get("link_label", "").isupper():
            problems.append(f"button '{f['link_label']}' is uppercase; buttons are sentence case")
        if len(f["text"]) > 260:
            problems.append(f"'{f['title']}' runs {len(f['text'])} characters; keep each under ~260")
    if problems:
        sys.exit("Copy check failed:\n  - " + "\n  - ".join(problems))


def feature_block(f, img_base):
    link = ""
    if f.get("link_key"):
        link = (f'<p style="margin:12px 0 0;"><a href="{esc(track(f["link_key"]))}" '
                f'style="font-family:{FONT};font-size:15px;font-weight:bold;color:{FOREST};text-decoration:underline;">'
                f'{esc(f["link_label"])}</a></p>')
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 40px;"><tr><td>
  <img src="{img_base}/{esc(f['image'])}" width="560" alt="{esc(f['alt'])}"
       style="display:block;width:100%;max-width:560px;height:auto;border-radius:16px;border:1px solid #ECE5D6;margin:0 0 18px;">
  <p style="margin:0 0 6px;font-family:{FONT};font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:{GOLD};">{esc(f['audience'])}</p>
  <p class="h2" style="margin:0 0 8px;font-family:{FONT};font-size:22px;line-height:1.25;font-weight:bold;color:{INK};">{esc(f['title'])}</p>
  <p style="margin:0;font-family:{FONT};font-size:15px;line-height:1.6;color:{SOFT};">{esc(f['text'])}</p>
  {link}
</td></tr></table>"""


def build(ed, slug):
    img_base = f"{BUCKET}/{ed.get('image_folder') or slug}"
    features = "".join(feature_block(f, img_base) for f in ed["features"])
    hero = ed["hero"]
    page = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>{esc(ed['subject'])}</title>
<style>
@media (max-width:600px){{
  .h1{{font-size:28px!important}}
  .h2{{font-size:20px!important}}
  .pad{{padding:20px 16px!important}}
}}
</style></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{esc(ed['preheader'])}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr>
<td class="pad" align="center" style="padding:28px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr>
<td style="font-family:{FONT};font-size:15px;line-height:1.6;color:{INK};">

  <a href="{track('home')}" style="text-decoration:none;">
    <img src="{LOGO}" width="156" alt="Gavelling" style="display:block;width:156px;height:auto;margin:0 0 30px;border:0;">
  </a>

  <p style="margin:0 0 10px;font-family:{FONT};font-size:12px;font-weight:bold;letter-spacing:0.1em;text-transform:uppercase;color:{GOLD};">{esc(ed['eyebrow'])}</p>
  <h1 class="h1" style="margin:0 0 12px;font-family:{FONT};font-size:34px;line-height:1.12;font-weight:bold;color:{INK};">
    {esc(ed['headline'])} <span style="font-family:{SERIF_ITALIC};font-style:italic;font-weight:normal;color:{DEEP_GOLD};">{esc(ed['headline_accent'])}</span>
  </h1>
  <p style="margin:0 0 24px;font-family:{FONT};font-size:16px;line-height:1.55;color:{SOFT};">{esc(ed['intro'])}</p>

  <img src="{img_base}/{esc(hero['image'])}" width="560" alt="{esc(hero['alt'])}"
       style="display:block;width:100%;max-width:560px;height:auto;border-radius:18px;margin:0 0 44px;">
{features}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 36px;background:#F6F1E4;border-radius:18px;"><tr>
  <td style="padding:28px 26px;">
    <p style="margin:0 0 8px;font-family:{FONT};font-size:21px;line-height:1.25;font-weight:bold;color:{FOREST};">{esc(ed['feedback_title'])}</p>
    <p style="margin:0 0 20px;font-family:{FONT};font-size:15px;line-height:1.6;color:{SOFT};">{esc(ed['feedback_text'])}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:{FOREST};border-radius:10px;">
        <a href="mailto:{TEAM_INBOX}?subject={quote('Feedback on ' + ed['edition'])}"
           style="display:inline-block;padding:13px 24px;font-family:{FONT};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Send us feedback</a>
      </td>
    </tr></table>
  </td></tr></table>

  <p style="margin:0;font-family:{FONT};font-size:15px;color:{SOFT};">See you in committee,</p>
  <p style="margin:6px 0 0;font-family:{FONT};font-size:15px;"><strong style="color:{INK};">Peter and Christian</strong><br>
    <span style="color:#55483C;">Founders of Gavelling</span></p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:34px 0 0;border-top:1px solid #ECE5D6;"><tr>
  <td style="padding:18px 0 0;font-family:{FONT};font-size:12px;line-height:1.6;color:{MUTED};">
    <a href="{track('instagram')}" style="color:{MUTED};font-weight:bold;">Instagram</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="{track('linkedin')}" style="color:{MUTED};font-weight:bold;">LinkedIn</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="{track('home')}" style="color:{MUTED};font-weight:bold;">gavelling.com</a><br>
    You are receiving this because you have a Gavelling account. <a href="{{{{UNSUBSCRIBE_URL}}}}" style="color:{MUTED};">Unsubscribe</a>
  </td></tr></table>

</td></tr></table>
</td></tr></table>
</body></html>
"""
    # Plain-text part: some clients show it, and spam filters like having one.
    lines = [f"{ed['eyebrow']}", f"{ed['headline']} {ed['headline_accent']}", "", ed["intro"], ""]
    for f in ed["features"]:
        lines += [f["audience"].upper(), f["title"], f["text"]]
        if f.get("link_key"):
            lines.append(f"{f['link_label']}: {track(f['link_key'])}")
        lines.append("")
    lines += [ed["feedback_title"], ed["feedback_text"], "", "See you in committee,", "Peter and Christian",
              "Founders of Gavelling", "", f"gavelling.com: {track('home')}",
              "Unsubscribe: {{UNSUBSCRIBE_URL}}"]
    return page, "\n".join(lines)


if __name__ == "__main__":
    path = sys.argv[1]
    ed = json.load(open(path))
    check_copy(ed)
    slug = os.path.splitext(os.path.basename(path))[0]
    page, text = build(ed, slug)
    used = check_links(ed, page, text)
    out = os.path.join(HERE, "out")
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, f"{slug}.html"), "w").write(page)
    open(os.path.join(out, f"{slug}.txt"), "w").write(text)
    unused = sorted(set(ed.get("links", {})) - used)
    print(f"out/{slug}.html  {len(page)//1024} KB, {len(ed['features'])} features, images from "
          f"{ed.get('image_folder') or slug}; copy and link checks passed"
          + (f" (unused link keys: {', '.join(unused)})" if unused else ""))
