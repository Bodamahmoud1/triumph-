(function (global) {
  function unwrapCatalogueResponse(json) {
    return Array.isArray(json) ? json : json.data;
  }

  function fetchChemicals() {
    return fetch('./api/data/chemicals', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch chemicals API: ' + res.status);
        return res.json();
      })
      .then(unwrapCatalogueResponse)
      .catch(function () {
        return fetch('./data/chemicals.json', { cache: 'no-store' })
          .then(function (res) {
            if (!res.ok) throw new Error('Failed to fetch chemicals: ' + res.status);
            return res.json();
          });
      });
  }

  global.ChemicalService = {
    fetchAll: fetchChemicals
  };
})(window);
