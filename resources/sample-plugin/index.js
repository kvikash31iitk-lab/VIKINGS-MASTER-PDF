/**
 * Word Counter — sample Vikings Master PDF plugin.
 * Demonstrates: commands, ribbon contribution, panels, storage, events, toasts.
 *
 * Install: copy this folder to <userData>/plugins/word-counter and enable
 * plugins in Settings ▸ Plugins (or load it from the Plugin Manager).
 */
module.exports.activate = function activate(api) {
  let lastCount = 0;

  api.registerCommand({
    id: 'count-words',
    label: 'Count Words in Document',
    run: async () => {
      // Plugins keep their own state via namespaced storage.
      const runs = ((await api.storage.get('runs')) || 0) + 1;
      await api.storage.set('runs', runs);
      api.ui.toast(
        'info',
        'Word Counter',
        lastCount > 0
          ? `Last count: ${lastCount} words (run #${runs}). Open the panel for live counts.`
          : `Open the Word Counter panel from the right rail (run #${runs}).`
      );
    }
  });

  api.registerRibbonButton({
    tabId: 'tools',
    groupLabel: 'Word Counter',
    commandId: 'plugin.word-counter.count-words',
    label: 'Count Words',
    icon: 'type'
  });

  api.registerPanel({
    id: 'word-counter',
    title: 'Word Counter',
    mount: (host) => {
      host.innerHTML =
        '<div style="padding:8px;font-size:12px">' +
        '<div id="wc-status" style="opacity:.7">Open a document to see live word counts.</div>' +
        '<div id="wc-count" style="font-size:28px;font-weight:700;margin-top:8px">—</div>' +
        '</div>';

      const status = host.querySelector('#wc-status');
      const count = host.querySelector('#wc-count');

      const offOpen = api.events.on('document:opened', (e) => {
        status.textContent = `Document ${e.docId.slice(0, 12)}… (${e.pageCount} pages)`;
      });
      const offSearch = api.events.on('search:results', (e) => {
        lastCount = e.total;
        count.textContent = String(e.total);
        status.textContent = 'Matches found by the last search:';
      });

      return () => {
        offOpen();
        offSearch();
      };
    }
  });
};
