(function (global) {
  function fetchChemicals() {
    return fetch('./data/chemicals.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch chemicals: ' + res.status);
        return res.json();
      });
  }

  global.ChemicalService = {
    fetchAll: fetchChemicals
  };
})(window);
