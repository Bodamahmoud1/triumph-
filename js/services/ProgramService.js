(function (global) {
  function safeJson(response) {
    if (!response.ok) {
      throw new Error('Failed to load programs: ' + response.status);
    }
    return response.json();
  }

  function normalizeProgram(item) {
    return {
      id: item.id || '',
      name: item.name || 'Program',
      family: item.family || 'utility',
      temp_c: typeof item.temp_c === 'number' ? item.temp_c : 0,
      time_min: typeof item.time_min === 'number' ? item.time_min : 0,
      chemicals: Array.isArray(item.chemicals) ? item.chemicals : [],
      load: item.load || '-',
      notes: item.notes || ''
    };
  }

  function fetchPrograms() {
    return fetch('data/programs.json', { cache: 'no-store' })
      .then(safeJson)
      .then(function (rows) {
        if (!Array.isArray(rows)) return [];
        return rows.map(normalizeProgram);
      });
  }

  global.ProgramService = {
    fetchAll: fetchPrograms
  };
})(window);
