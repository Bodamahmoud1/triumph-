(function (global) {
  function estimateDose(loadKg, dosageRangeText) {
    var range = (dosageRangeText || '').split('-').map(function (part) {
      return parseFloat(part.trim());
    }).filter(function (n) { return !isNaN(n); });

    if (!range.length || !loadKg || loadKg <= 0) return null;
    var min = range[0] * loadKg;
    var max = (range[1] || range[0]) * loadKg;
    return { min: Math.round(min), max: Math.round(max) };
  }

  global.DoseCalculator = { estimateDose: estimateDose };
})(window);
