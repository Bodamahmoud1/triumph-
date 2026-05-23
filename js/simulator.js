(function (global) {
  function simulateCycle(program) {
    if (!program) return null;
    return {
      program: program.name,
      temp_c: program.temp_c,
      time_min: program.time_min,
      estimated_finish_in_min: program.time_min + 5
    };
  }

  global.WashSimulator = { simulateCycle: simulateCycle };
})(window);
