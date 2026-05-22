// js/calculator.js - Interactive Dosage Calculator

const dosageData = {
  'hypo': { light: 6, medium: 10, heavy: 15 },
  'soft': { light: 1.5, medium: 3, heavy: 5 },
  'buildlite': { light: 4, medium: 8, heavy: 12 },
  'sonril': { light: 1.7, medium: 2.5, heavy: 3.4 },
  'neutrapur': { light: 1.5, medium: 2.5, heavy: 4 },
  'neutra3in1': { light: 2, medium: 3, heavy: 5 },
  'clax200': { light: 1.5, medium: 3.5, heavy: 6 },
  'clax100': { light: 2, medium: 4.5, heavy: 8 }
};

const chemNames = {
  'hypo': 'Clax Hypo 4AL1',
  'soft': 'Clax Soft Extra 5DL2',
  'buildlite': 'Clax Build Lite 12A1',
  'sonril': 'Clax Sonril Ultra 40B1',
  'neutrapur': 'Clax Neutrapur 60',
  'neutra3in1': 'Clax Neutra 3in1 63A',
  'clax200': 'Clax 200 24A1',
  'clax100': 'Clax 100 Color 22B1'
};

function initCalculator() {
  const container = document.getElementById('calculator-container');
  if (!container) return;

  container.innerHTML = `
    <div class="calculator-card" style="background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin-bottom: 20px;">
      <h3 style="margin-top: 0; color: #2b52a8; border-bottom: 2px solid #eef4ff; padding-bottom: 10px;">🧪 Dosage Calculator / حاسبة الجرعات</h3>
      
      <div style="display: flex; gap: 20px; margin-top: 15px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 200px;">
          <label style="display: block; font-weight: bold; margin-bottom: 5px; font-size: 14px;">Machine Capacity / سعة الماكينة (kg)</label>
          <input type="number" id="calc-capacity" value="80" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 5px;">
        </div>
        
        <div style="flex: 1; min-width: 200px;">
          <label style="display: block; font-weight: bold; margin-bottom: 5px; font-size: 14px;">Soil Level / درجة الاتساخ</label>
          <select id="calc-soil" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 5px;">
            <option value="light">Light / خفيف</option>
            <option value="medium" selected>Medium / متوسط</option>
            <option value="heavy">Heavy / شديد</option>
          </select>
        </div>
      </div>

      <div style="margin-top: 20px; text-align: center;">
        <button id="calc-btn" style="background: #2b52a8; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; width: 100%; max-width: 250px;">Calculate / احسب</button>
      </div>

      <div id="calc-results" style="margin-top: 20px; display: none;">
        <h4 style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Results per Load (ml):</h4>
        <div id="calc-results-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
        </div>
      </div>
    </div>
  `;

  document.getElementById('calc-btn').addEventListener('click', () => {
    const capacity = parseFloat(document.getElementById('calc-capacity').value) || 0;
    const soil = document.getElementById('calc-soil').value;
    const resultsDiv = document.getElementById('calc-results');
    const grid = document.getElementById('calc-results-grid');
    
    grid.innerHTML = '';
    
    for (const [id, rates] of Object.entries(dosageData)) {
      const mlPerKg = rates[soil];
      const totalMl = mlPerKg * capacity;
      
      const item = document.createElement('div');
      item.style.cssText = 'background: #f9f9f9; border: 1px solid #eaeaea; padding: 10px; border-radius: 6px;';
      item.innerHTML = `
        <div style="font-size: 11px; color: #666; font-weight: bold;">${chemNames[id]}</div>
        <div style="font-size: 16px; font-weight: 900; color: #2b52a8; margin-top: 5px;">${totalMl.toFixed(0)} ml</div>
        <div style="font-size: 9px; color: #999;">(${mlPerKg} ml/kg)</div>
      `;
      grid.appendChild(item);
    }
    
    resultsDiv.style.display = 'block';
  });
}

document.addEventListener('DOMContentLoaded', initCalculator);
