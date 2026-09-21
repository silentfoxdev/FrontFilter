# FrontFilter

FrontFilter is a Manifest V3 browser extension for Firefox and Google Chrome. It
helps you make Reddit intentional again by blocking selected destinations,
filtering communities from feeds, simplifying the interface, and putting a
finite window in front of infinite scrolling.

## Features

- Block the Reddit homepage, Popular, Explore, and News pages.
- Block every subreddit front page.
- Add exact or wildcard subreddit rules such as `news`, `news*`, `*news`, or
  `*news*`. Use `HOME` mode to block only a subreddit's front and sorting pages. Use `ALL` mode to block every page in a subreddit and hide its posts in
  other feeds.
- Add exact subreddit exceptions that take precedence over the global
  subreddit-front-page block and over exact or wildcard subreddit rules.
- Hide posts whose titles or text previews contain a configured keyword or
  phrase, using case-insensitive matching.
- Disable video autoplay; hide every comment or only replies to comments; and
  hide the top navigation bar or either sidebar independently. Individual left
  sidebar sections—Games, Custom feeds, Recent, Communities, and Resources—can
  also be hidden separately. The navbar menu, search, chat, notifications,
  profile menu, and remaining actions can likewise be hidden independently.
- Hide blocked communities from popular-community panels.
- Limit modern Reddit feeds to a fixed number of posts or reveal one finite
  group at a time with a **Show next** button.
- Follow the system color scheme or choose a persistent light or dark theme for
  the extension interface.
- Import and export settings as JSON.

## Browser support

- Firefox 140 or newer
- Firefox for Android 142 or newer
- Google Chrome 121 or newer

The extension has one shared codebase. Firefox runs a non-persistent background
script, while Chrome runs the equivalent extension service worker.

## Install for development

### Firefox

1. Run `npm run build` to generate the Firefox-specific manifest and archive.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on**.
4. Choose `dist/frontfilter-firefox-2.1.0.xpi`.

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the `src/` directory.

`src/manifest.json` is directly loadable by Chrome. The build overlays
`manifests/firefox.json` for Firefox, which uses background scripts instead of a
service worker and includes the required Gecko metadata.

## Permissions

| Permission | Purpose |
| --- | --- |
| `storage` | Persist settings locally in the browser profile. |
| `declarativeNetRequest` | Redirect blocked top-level Reddit navigations to the bundled block page. |
| Reddit host access | Run the content script, read the current Reddit tab, and apply navigation rules. |

FrontFilter does not collect or transmit user data. Version 2.1.0 makes no API
requests to Reddit or to third-party services. All code and assets are bundled
with the extension.

## Development

The default checks require only Node.js and Python 3; the extension itself has
no npm runtime dependencies.

```bash
npm test
npm run check
npm run build
```

`npm test` runs unit and DOM-harness regression tests for shared rules,
declarative redirects, the background lifecycle, content filtering, the popup,
the block page, and the feed window.

`npm run build` validates the source and creates deterministic archives in
`dist/`:

```text
dist/frontfilter-firefox-2.1.0.xpi
dist/frontfilter-chrome-2.1.0.zip
```

Set `SOURCE_DATE_EPOCH` to choose the timestamp embedded in release archives.

### Browser integration tests

The optional Selenium tests use a temporary extension and a local fixture. They
do not visit Reddit.

```bash
python3 -m venv /tmp/frontfilter-browser-tests
/tmp/frontfilter-browser-tests/bin/pip install selenium

/tmp/frontfilter-browser-tests/bin/python tests/browser/firefox.py \
  --firefox /path/to/firefox

/tmp/frontfilter-browser-tests/bin/python tests/browser/chrome.py \
  --chrome /path/to/chrome
```

Both suites verify a real declarative main-frame redirect on a local host. The
Firefox suite also covers the native popup UI and detailed feed behavior. The
Chrome smoke suite verifies MV3 service-worker startup, content filtering,
finite-feed behavior, popup persistence, and removal of the obsolete control.


## AI-assisted development

The code in this project has been developed using AI coding tools.

The project is human-directed: feature selection, requirements, technical decisions, testing, validation, and overall review are performed by the maintainer, while the implementation itself is produced with the assistance of AI.

This note is included for transparency about the development process.
