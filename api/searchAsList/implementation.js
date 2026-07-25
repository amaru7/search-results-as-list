"use strict";

/*
 * Thunderbird's global search opens a faceted "gallery" tab (mode "glodaFacet").
 * Its "Show results as list" button opens a mail3PaneTab with a
 * GlodaSyntheticView instead (FacetContext.showActiveSetInTab in
 * mail/base/content/glodaFacetView.js).
 *
 * We make that the default by wrapping tabmail.openTab: whenever anything asks
 * for a "glodaFacet" tab we open the equivalent list tab from the same query.
 * All entry points funnel through there - the unified toolbar search bar, the
 * gloda autocomplete input, the quick filter and the address book - passing
 * {query}, {searcher} or {collection}.
 */

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);
var { ExtensionSupport } = ChromeUtils.importESModule(
  "resource:///modules/ExtensionSupport.sys.mjs"
);
var { GlodaSyntheticView } = ChromeUtils.importESModule(
  "resource:///modules/gloda/GlodaSyntheticView.sys.mjs"
);

const WINDOW_LISTENER_ID = "searchResultsAsList-windowListener";
const MESSENGER_WINDOW = "chrome://messenger/content/messenger.xhtml";

// Thunderbird 154+ does this natively (bug 580252). Unknown prefs are harmless.
const NATIVE_PREF = "gloda.show_as_list_by_default";

/**
 * Turn the arguments meant for a "glodaFacet" tab into arguments for the
 * equivalent message list. Returns null when we can't, so the caller can fall
 * back to the original faceted view.
 */
function buildListArgs(args) {
  args = args || {};

  let synthArgs = null;
  if (args.collection) {
    // Already collected, e.g. the address book.
    synthArgs = { collection: args.collection };
  } else if (args.query) {
    synthArgs = { query: args.query };
  } else if (args.searcher && args.searcher.buildFulltextQuery) {
    // The search bar passes a GlodaMsgSearcher whose query is built lazily.
    // GlodaSyntheticView runs it and streams results into the list.
    synthArgs = { query: args.searcher.buildFulltextQuery() };
  }

  if (!synthArgs) {
    return null;
  }

  // args.IMSearcher (chat hits) is deliberately ignored - the list view holds
  // messages only, which is exactly what Thunderbird 154 does natively too.

  const listArgs = {
    background: args.background || false,
    folderPaneVisible: false,
    syntheticView: new GlodaSyntheticView(synthArgs),
  };

  if (args.title) {
    listArgs.title = args.title;
  } else if (args.searcher && args.searcher.searchString) {
    listArgs.title = args.searcher.searchString;
  }

  return listArgs;
}

function patchWindow(window) {
  try {
    Services.prefs.setBoolPref(NATIVE_PREF, true);
  } catch (e) {
    /* Pref may not exist on this version. */
  }

  const tabmail = window.document.getElementById("tabmail");
  if (!tabmail || tabmail._searchAsListPatched) {
    return;
  }

  const originalOpenTab = tabmail.openTab;
  tabmail._searchAsListOriginalOpenTab = originalOpenTab;

  tabmail.openTab = function (tabModeName, args) {
    if (tabModeName === "glodaFacet") {
      try {
        const listArgs = buildListArgs(args);
        if (listArgs) {
          return originalOpenTab.call(this, "mail3PaneTab", listArgs);
        }
      } catch (e) {
        // Never break the user's search: fall through to the normal view.
        console.error(
          "[Search Results as List] Falling back to faceted view:",
          e
        );
      }
    }
    return originalOpenTab.call(this, tabModeName, args);
  };

  tabmail._searchAsListPatched = true;
}

function unpatchWindow(window) {
  const tabmail = window.document && window.document.getElementById("tabmail");
  if (tabmail && tabmail._searchAsListPatched) {
    if (tabmail._searchAsListOriginalOpenTab) {
      tabmail.openTab = tabmail._searchAsListOriginalOpenTab;
    }
    delete tabmail._searchAsListOriginalOpenTab;
    delete tabmail._searchAsListPatched;
  }
}

var searchAsList = class extends ExtensionCommon.ExtensionAPI {
  onShutdown(isAppShutdown) {
    if (isAppShutdown) {
      return;
    }
    for (const window of ExtensionSupport.openWindows) {
      try {
        unpatchWindow(window);
      } catch (e) {
        console.error("[Search Results as List] cleanup error:", e);
      }
    }
    ExtensionSupport.unregisterWindowListener(WINDOW_LISTENER_ID);
  }

  getAPI() {
    return {
      searchAsList: {
        async register() {
          // Also fires onLoadWindow for windows that are already open.
          ExtensionSupport.registerWindowListener(WINDOW_LISTENER_ID, {
            chromeURLs: [MESSENGER_WINDOW],
            onLoadWindow(window) {
              patchWindow(window);
            },
          });
        },
      },
    };
  }
};
