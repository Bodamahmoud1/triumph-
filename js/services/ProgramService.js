(function (global) {
  function fetchPrograms() {
    return fetch('./data/programs.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to fetch programs: ' + res.status);
        return res.json();
      });
  }

  global.ProgramService = {
    fetchAll: fetchPrograms
  };
})(window);
