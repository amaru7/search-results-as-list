/*
 * Background script.
 *
 * All the real work happens in the privileged Experiment API
 * (api/searchAsList/implementation.js), because there is no plain WebExtension
 * API to influence how Thunderbird renders global-search results. We just tell
 * that API to install its window hook.
 */

(async () => {
  try {
    await messenger.searchAsList.register();
  } catch (e) {
    console.error("[Search as List] Could not register:", e);
  }
})();
