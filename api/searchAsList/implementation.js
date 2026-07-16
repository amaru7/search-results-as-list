"use strict";

/*
 * Experiment API implementation.
 *
 * Thunderbird's global search ("gloda") normally opens its results in a
 * faceted "gallery" view (tab mode "glodaFacet"). That view has a
 * "Show results as list" button whose handler (FacetContext.showActiveSetInTab
 * in mail/base/content/glodaFacetView.js) does essentially this:
 *
 *     tabmail.openTab("mail3PaneTab", {
 *       folderPaneVisible: false,
 *       syntheticView: new GlodaSyntheticView({ collection: ... }),
 *       title: ...,
 *     });
 *
 * We make that the default: we wrap tabmail.openTab in every mail window, and
 * whenever something tries to open a "glodaFacet" tab we instead open the
 * equivalent list view directly, reusing the same underlying gloda query.
 *
 * As a bonus we also set gloda.facetview.show_as_list_by_default = true. That
 * preference does nothing on Thunderbird <= 152, but on Thunderbird 154+
 * (bug 580252) it makes the application do this natively; in that case our
 * hook simply never sees a "glodaFacet" tab and stays idle.
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

// Native preference introduced in Thunderbird 154 (bug 580252). Harmless to
// set on older versions.
const NATIVE_PREF = "gloda.facetview.show_as_list_by_default";

/**
 * Translate the arguments that were meant for a "glodaFacet" tab into the
 * arguments for a "mail3PaneTab" that shows the same results as a list.
 * Returns null when we can't (or shouldn't) build a list view, so the caller
 * can fall back to the original faceted behaviour.
 */
function buildListArgs(args) {
  args = args || {};

  // Combined message + chat searches can only be represented in the faceted
  // view. Leave those alone rather than silently dropping the IM results.
  if (args.IMSearcher) {
    return null;
  }

  let synthArgs = null;
  if (args.collection) {
    // Results are already collected (e.g. address book search).
    synthArgs = { collection: args.collection };
  } else if (args.query) {
    synthArgs = { query: args.query };
  } else if (args.searcher) {
    // The toolbar global search passes a GlodaMsgSearcher whose ranked query
    // is built lazily. buildFulltextQuery() returns that query without running
    // it; GlodaSyntheticView will then execute it and stream results into the
    // list as they arrive.
    const searcher = args.searcher;
    if (typeof searcher.buildFulltextQuery === "function") {
      synthArgs = { query: searcher.buildFulltextQuery() };
    } else if (searcher.query) {
      synthArgs = { query: searcher.query };
    }
  }

  if (!synthArgs) {
    return null;
  }

  const listArgs = {
    background: args.background || false,
    folderPaneVisible: false,
    syntheticView: new GlodaSyntheticView(synthArgs),
  };

  // Keep a readable tab title (usually the search string).
  if (args.title) {
    listArgs.title = args.title;
  } else if (args.searcher && args.searcher.searchString) {
    listArgs.title = args.searcher.searchString;
  }

  return listArgs;
}

function patchWindow(window) {
  // Best-effort: also flip the native pref so TB 154+ does this itself.
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
  const tabmail =
    window.document && window.document.getElementById("tabmail");
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
      // The whole application is going away; nothing to clean up.
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

  getAPI(context) {
    return {
      searchAsList: {
        async register() {
          // registerWindowListener also fires onLoadWindow for windows that
          // are already open, so the current main window is patched too.
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
