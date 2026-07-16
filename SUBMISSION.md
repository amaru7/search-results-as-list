# How to publish on addons.thunderbird.net (ATN)

Thunderbird add-ons are listed on **https://addons.thunderbird.net**, backed by
the `services.addons.thunderbird.net` API/signing service. Same software as
Mozilla's AMO, so the flow and policies mirror the ones you read. Because this
add-on uses an **Experiment API**, it will get a **manual human review**.
Everything below is prepared to make that review pass on the first try.

## Simplest possible path (5 steps)

1. Go to **https://addons.thunderbird.net/developers/addon/submit/distribution**
   and sign in (create a Mozilla account first if you don't have one — top
   right "Register/Log in").
2. Choose **"On this site"** so it's listed publicly and gets signed
   automatically.
3. Upload **`search-results-as-list.xpi`** (already built, in this folder).
   A warning about the experiment API is expected — continue anyway.
4. Paste the listing text from `LISTING.md` (English and/or German) and upload
   the images from `graphics/`:
   - `graphics/icon-256.png` as the icon
   - `graphics/real-before-facet.png` and `graphics/real-after-list.png` as
     screenshots (these are your own real Thunderbird, with all private
     details blurred)
5. Paste the **reviewer notes** and **data collection answer** below, then
   submit. A human reviewer will look at it (experiment APIs always get manual
   review) — this can take from a few days up to a couple of weeks. You'll get
   an email when it's approved or if they have questions.

## Reviewer notes  *(paste into the "Notes for reviewers" field)*

```
This add-on makes the built-in "Show results as list" view the default for
Thunderbird's global (gloda) search.

Why an experiment is required:
There is no WebExtension/MailExtension API to influence how global-search results
are rendered, so a small experiment is used.

What the experiment does (api/searchAsList/implementation.js):
- Registers a window listener for the main messenger window.
- In each window it wraps tabmail.openTab. When a "glodaFacet" tab is about to
  open, it instead opens a "mail3PaneTab" containing a GlodaSyntheticView built
  from the SAME search query (searcher.buildFulltextQuery() / query / collection).
  This is exactly what Thunderbird's own "Show results as list" button does
  (FacetContext.showActiveSetInTab in mail/base/content/glodaFacetView.js).
- Sets the pref gloda.facetview.show_as_list_by_default = true, which is a no-op
  before Thunderbird 154 and the native mechanism from 154 onward (bug 580252).
- On shutdown it restores the original tabmail.openTab and unregisters the listener.

No remote code, no network access, no data collection. All code is self-contained
and unobfuscated. Combined message+chat (IMSearcher) searches are intentionally
left in the faceted view so no chat results are lost. Any failure falls back to
the original faceted view so a search never breaks.

How to test:
1. Install and restart Thunderbird.
2. Type a term in the global search bar (top) and press Enter.
3. Results open directly as a sortable message list instead of the faceted view.
```

## Data collection answer

- **Does this add-on collect or transmit any data?** → **No.**
  It does not collect, store, or transmit any user data; it makes no network
  requests. It only changes how existing local search results are displayed.

## Source code

The add-on contains no minified, transpiled, or obfuscated code — the files in the
`.xpi` **are** the source. If ATN requests a source upload anyway, upload this whole
project folder (excluding the built `.xpi` and the `graphics/`/docs files, or include
them — either is fine). Build/reproduce instructions: it is a plain zip of
`manifest.json`, `background.js`, `icon.svg`, and the `api/` folder — no build step.

## Important expectations for an experiment add-on

- **Maintenance:** experiments rely on Thunderbird internals that can change between
  major versions. Test after each new Thunderbird release (e.g. 128 → 140 → 152 → …)
  and push an update if something breaks. This is your ongoing responsibility as the
  listed developer.
- **Not "Recommended":** experiment add-ons generally aren't eligible for the curated
  "Recommended" badge, but they can absolutely become popular through search,
  ratings, and word of mouth.
- **Compatibility range:** ATN's linter enforces three rules for experiment
  add-ons (all discovered the hard way during submission):
  1. `strict_max_version` **must be present** — omitting it fails validation.
  2. It **must match the pattern** `^[0-9]{1,3}(\.[a-z0-9*]+)+$` — i.e. a
     number followed by at least one dot-group. A bare `"*"` is rejected.
  3. The number **must be a Thunderbird version the linter knows** — a guessed
     future number like `156.*` fails with "Cannot find min/max version".
  The manifest therefore sets `strict_min_version: "128.0"` and
  `strict_max_version: "152.*"` (152 = current stable release). The min/max
  pair is an inclusive *range*, so this covers everything from 128 through
  152.x — including the current ESR (140).
- **Ongoing maintenance:** when a new Thunderbird major version ships (153,
  154, …), bump `strict_max_version` to the new branch (e.g. `"154.*"`),
  re-test the add-on, and upload the new version. Yes, this is tedious — it is
  a deliberate ATN policy for experiment add-ons, because experiments touch
  Thunderbird internals that can break between majors. Two mitigations:
  ATN lets you **edit the compatibility range of an already-approved version
  in the Developer Hub** (no re-upload needed) when a new Thunderbird release
  turns out to work fine; and from Thunderbird 154 the add-on's core feature
  exists natively via `gloda.facetview.show_as_list_by_default`, so future
  versions of this add-on could drop the experiment entirely and become a
  normal, never-expiring MailExtension that just flips that pref.

## Trademark / naming

The name "Search Results as List" does not use "Thunderbird" and does not imply any
endorsement by MZLA/Mozilla — compliant with the naming policy. The listing describes
it as an add-on *for Thunderbird*, which is allowed.
