/**
 * Unified game result modal for standalone game pages
 * Usage: GameModal.show({ title, stars, msg, emoji, onNext, onAgain, onBack, onExtra })
 *   onNext  → "Level Berikutnya ➡️" (optional, primary button)
 *   onAgain → "Main Lagi 🔄"
 *   onBack  → "Kembali 🏠"
 *   onExtra → { label, action } custom button
 */
const GameModal = (() => {
  let overlay;

  function init() {
    if (document.getElementById('gm-overlay')) return;

    const css = document.createElement('style');
    css.textContent = `
      #gm-overlay{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;background:rgba(15,10,30,0.78);backdrop-filter:blur(14px)}
      #gm-overlay.show{display:flex}
      #gm-card{background:linear-gradient(160deg,#f8f0ff,#ede2f6);border:2px solid rgba(180,160,220,0.45);border-radius:28px;padding:32px 24px;text-align:center;width:min(340px,92vw);box-shadow:0 16px 48px rgba(100,60,160,0.18);animation:gmSlideIn .4s cubic-bezier(.34,1.56,.64,1)}
      @keyframes gmSlideIn{from{opacity:0;transform:scale(0.88) translateY(24px)}to{opacity:1;transform:scale(1) translateY(0)}}
      #gm-emoji{font-size:56px;margin-bottom:4px}
      #gm-title{font-size:26px;font-weight:900;color:#3b2066;margin-bottom:8px;font-family:'Fredoka One',sans-serif}
      #gm-stars{font-size:34px;letter-spacing:4px;margin-bottom:8px}
      #gm-msg{color:#6b5080;font-size:14px;margin-bottom:20px;line-height:1.5}
      #gm-btns{display:flex;flex-direction:column;gap:8px}
      .gm-btn{display:block;width:100%;padding:14px;border:none;border-radius:18px;font-size:16px;font-weight:900;cursor:pointer;font-family:'Fredoka One',sans-serif;-webkit-tap-highlight-color:transparent;transition:transform .1s}
      .gm-btn:active{transform:scale(0.93)}
      .gm-btn-primary{background:linear-gradient(160deg,#a78bfa,#8b5cf6);color:#fff;box-shadow:0 4px 0 #6d28d9}
      .gm-btn-green{background:linear-gradient(160deg,#4ade80,#22c55e);color:#fff;box-shadow:0 4px 0 #15803d}
      .gm-btn-secondary{background:rgba(139,92,246,0.06);color:#6b5080;border:1.5px solid rgba(139,92,246,0.22)}
    `;
    document.head.appendChild(css);

    overlay = document.createElement('div');
    overlay.id = 'gm-overlay';
    overlay.innerHTML = '<div id="gm-card"><div id="gm-emoji"></div><div id="gm-title"></div><div id="gm-stars"></div><div id="gm-msg"></div><div id="gm-btns"></div></div>';
    document.body.appendChild(overlay);
  }

  function show({ emoji = '🏆', title = '', stars = 0, msg = '', onNext, onAgain, onBack, onExtra }) {
    init();
    document.getElementById('gm-emoji').textContent = emoji;
    document.getElementById('gm-title').textContent = title;
    document.getElementById('gm-stars').textContent = '⭐'.repeat(Math.min(stars,5)) + '☆'.repeat(Math.max(0,5-stars));
    document.getElementById('gm-msg').textContent = msg;

    const btns = document.getElementById('gm-btns');
    btns.innerHTML = '';

    // Level Berikutnya — green, top priority
    if (onNext) {
      const b = document.createElement('button');
      b.className = 'gm-btn gm-btn-green';
      b.textContent = 'Level Berikutnya ➡️';
      b.onclick = () => { hide(); onNext(); };
      btns.appendChild(b);
    }

    if (onAgain) {
      const b = document.createElement('button');
      b.className = 'gm-btn gm-btn-primary';
      b.textContent = 'Main Lagi 🔄';
      b.onclick = () => { hide(); onAgain(); };
      btns.appendChild(b);
    }
    if (onExtra) {
      const b = document.createElement('button');
      b.className = 'gm-btn gm-btn-secondary';
      b.textContent = onExtra.label;
      b.onclick = () => { hide(); onExtra.action(); };
      btns.appendChild(b);
    }
    if (onBack) {
      const b = document.createElement('button');
      b.className = 'gm-btn gm-btn-secondary';
      b.textContent = 'Kembali 🏠';
      b.onclick = () => { hide(); onBack(); };
      btns.appendChild(b);
    }

    overlay.classList.add('show');
  }

  function hide() {
    if (overlay) overlay.classList.remove('show');
  }

  return { show, hide };
})();
