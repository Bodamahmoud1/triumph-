class ProgramService {
  static async getPrograms() {
    try {
      const res = await fetch('./data/programs.json');
      if (!res.ok) throw new Error('Failed to fetch programs');
      return await res.json();
    } catch (err) {
      console.error('ProgramService Error:', err);
      throw err;
    }
  }
}
