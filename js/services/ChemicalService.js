class ChemicalService {
  static async getChemicals() {
    try {
      const res = await fetch('./data/chemicals.json');
      if (!res.ok) throw new Error('Failed to fetch chemicals');
      return await res.json();
    } catch (err) {
      console.error('ChemicalService Error:', err);
      throw err;
    }
  }
}
