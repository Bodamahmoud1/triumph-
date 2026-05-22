// js/simulator.js - Interactive Wash Cycle Simulator

function initSimulator() {
  const container = document.createElement('div');
  container.innerHTML = `
    <button id="sim-fab" style="position:fixed;bottom:160px;left:20px;width:50px;height:50px;border-radius:25px;background:var(--navy,#0f1e42);color:white;border:none;box-shadow:0 4px 10px rgba(0,0,0,0.3);font-size:24px;cursor:pointer;z-index:90;display:flex;align-items:center;justify-content:center;">
      🔄
    </button>

    <div id="sim-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;width:100%;max-width:400px;border-radius:12px;padding:24px;position:relative;text-align:center;">
        <button id="close-sim" style="position:absolute;top:15px;right:15px;background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
        <h3 style="margin-top:0;color:var(--navy,#0f1e42);border-bottom:1px solid #eee;padding-bottom:10px;">🔄 محاكي الغسيل</h3>
        
        <div style="margin: 20px auto; width: 150px; height: 150px; border: 8px solid #ddd; border-radius: 50%; position: relative; overflow: hidden; background: #f9f9f9; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 4px 10px rgba(0,0,0,0.1);">
            <div id="sim-water" style="position: absolute; bottom: 0; left: 0; right: 0; height: 0%; background: rgba(52, 152, 219, 0.6); transition: height 1s ease;"></div>
            <div id="sim-drum" style="width: 120px; height: 120px; border: 2px dashed #999; border-radius: 50%; z-index: 2; transition: transform 2s linear;"></div>
            <div id="sim-temp" style="position: absolute; top: 10px; right: 10px; font-weight: bold; color: #e74c3c; z-index: 3;">--°C</div>
        </div>

        <div id="sim-status" style="font-size: 1.1rem; font-weight: bold; margin-bottom: 10px; color: var(--navy);">جاهز للتشغيل</div>
        <div id="sim-details" style="font-size: 0.9rem; color: #666; min-height: 40px;">اختر البرنامج لتجربة المحاكاة</div>

        <button id="start-sim-btn" style="margin-top: 15px; width:100%;padding:12px;background:var(--gold,#c5a05a);color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">بدء دورة الغسيل</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);
  
  const fab = document.getElementById('sim-fab');
  const modal = document.getElementById('sim-modal');
  const closeBtn = document.getElementById('close-sim');
  const startBtn = document.getElementById('start-sim-btn');
  
  const water = document.getElementById('sim-water');
  const drum = document.getElementById('sim-drum');
  const temp = document.getElementById('sim-temp');
  const status = document.getElementById('sim-status');
  const details = document.getElementById('sim-details');
  
  let rot = 0;
  let interval;

  fab.addEventListener('click', () => { modal.style.display = 'flex'; });
  closeBtn.addEventListener('click', () => { 
      modal.style.display = 'none'; 
      clearInterval(interval);
      water.style.height = '0%';
      status.textContent = 'جاهز للتشغيل';
      details.textContent = 'اختر البرنامج لتجربة المحاكاة';
      temp.textContent = '--°C';
      startBtn.disabled = false;
  });
  
  startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    let step = 0;
    
    const steps = [
      { t: 'تعبئة المياه (Pre-wash)', h: '30%', d: 'مستوى مياه منخفض', temp: '30°C' },
      { t: 'غسيل تحضيري', h: '30%', d: 'دوران سريع لإزالة الأوساخ السطحية', temp: '30°C', spin: true },
      { t: 'تصريف', h: '0%', d: 'تصريف المياه المتسخة', temp: '--°C' },
      { t: 'غسيل رئيسي (Main Wash)', h: '25%', d: 'إضافة Clax Plus / Clax Build', temp: '60°C', spin: true },
      { t: 'شطف أولي', h: '40%', d: 'مستوى مياه عالي', temp: '40°C', spin: true },
      { t: 'عملية التعادل (Sour)', h: '25%', d: 'إضافة Clax Cid لمعادلة القلوية', temp: '30°C', spin: true },
      { t: 'عصر نهائي (Extract)', h: '0%', d: 'عصر بسرعة عالية جداً', temp: '--°C', fastSpin: true },
      { t: 'اكتمل', h: '0%', d: 'الغسيل جاهز للتجفيف', temp: '--°C' }
    ];

    interval = setInterval(() => {
      if(step >= steps.length) {
        clearInterval(interval);
        startBtn.disabled = false;
        return;
      }
      
      const s = steps[step];
      status.textContent = s.t;
      details.textContent = s.d;
      water.style.height = s.h;
      temp.textContent = s.temp;
      
      if(s.fastSpin) {
        rot += 1080;
        drum.style.transform = \`rotate(\${rot}deg)\`;
        drum.style.transition = 'transform 1.5s linear';
      } else if(s.spin) {
        rot += 360;
        drum.style.transform = \`rotate(\${rot}deg)\`;
        drum.style.transition = 'transform 2s linear';
      }
      
      step++;
    }, 2500);
  });
}

document.addEventListener('DOMContentLoaded', initSimulator);
