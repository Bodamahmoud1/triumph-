(function (global) {
  function safeJson(response) {
    if (!response.ok) {
      throw new Error('Failed to load chemicals: ' + response.status);
    }
    return response.json();
  }

  function normalizeChemical(item) {
    return {
      id: item.id || '',
      name: item.name || 'Unknown Chemical',
      subtitle: item.subtitle || '',
      theme: item.theme || 'blue',
      category: item.category || 'Chemical',
      ph: item.ph || '-',
      dosage_ml_kg: item.dosage_ml_kg || '-',
      temp_c: item.temp_c || '-',
      use_for: Array.isArray(item.use_for) ? item.use_for : [],
      avoid_for: Array.isArray(item.avoid_for) ? item.avoid_for : [],
      notes: item.notes || ''
    };
  }

  function fetchChemicals() {
    return fetch('data/chemicals.json', { cache: 'no-store' })
      .then(safeJson)
      .then(function (rows) {
        if (!Array.isArray(rows)) return [];
        return rows.map(normalizeChemical);
      });
  }

  global.ChemicalService = {
    fetchAll: fetchChemicals
  };
})(window);
