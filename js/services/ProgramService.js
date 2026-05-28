(function (global) {
  function unwrapCatalogueResponse(json) {
    return Array.isArray(json) ? json : json.data;
  }

  function fetchPrograms() {
    return fetch('./api/data/programs', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch programs API: ' + res.status);
        return res.json();
      })
      .then(unwrapCatalogueResponse)
      .catch(function () {
        return fetch('./data/programs.json', { cache: 'no-store' })
          .then(function (res) {
            if (!res.ok) throw new Error('Failed to fetch programs: ' + res.status);
            return res.json();
          });
      });
  }

  global.ProgramService = {
    fetchAll: fetchPrograms
  };
})(window);
