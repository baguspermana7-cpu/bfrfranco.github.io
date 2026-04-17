/**
 * Unified game result modal for standalone game pages
 * Usage: GameModal.show({ title, stars, msg, emoji, onAgain, onBack, onExtra })
 */
const GameModal = (() => {
  let overlay;

  function init() {
    if (document.getElementById('gm-overlay')) return;

    const css = document.createElement('style');
    css.textContent = `
      #gm-overlay{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(14px)}
      #gm-overlay.show{display:flex}
      #gm-card{background:linear-gradient(160deg,#1e0845,#2d1b69);border:2px solid rgba(139,92,246,0.6);border-radius:28px;padding:28px 24px;text-align:center;width:min(360px,92vw);box-shadow:0 20px 60px rgba(139,92,246,0.35);animation:gmSlideIn .4s ease}
      @keyframes gmSlideIn{from{opacity:0;transform:scale(0.85) translateY(30px)}to{opacity:1;transform:scale(1) translateY(0)}}
      #gm-emoji{font-size:56px;margin-bottom:4px}
      #gm-title{font-size:28px;font-weight:900;color:#fff;margin-bottom:8px;font-family:'Fredoka One',sans-serif}
      #gm-stars{font-size:36px;letter-spacing:4px;margin-bottom:8px}
      #gm-msg{color:rgba(233,213,255,0.8);font-size:15px;margin-bottom:20px}
      #gm-btns{display:flex;flex-direction:column;gap:10px}
      .gm-btn{display:block;width:100%;padding:14px;border:none;border-radius:18px;font-size:16px;font-weight:900;cursor:pointer;font-family:'Fredoka One',sans-serif;-webkit-tap-highlight-color:transparent;transition:transform .1s}
      .gm-btn:active{transform:scale(0.93)}
      .gm-btn-primary{background:linear-gradient(160deg,#7C3AED,#6D28D9);color:#fff;box-shadow:0 5px 0 #4C1D95}
      .gm-btn-secondary{background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.85);border:1.5px solid rgba(255,255,255,0.25)}
    `;
    document.head.appendChild(css);

    overlay = document.createElement('div');
    overlay.id = 'gm-overlay';
    overlay.innerHTML = '<div id="gm-card"><div id="gm-emoji"></div><div id="gm-title"></div><div id="gm-stars"></div><div id="gm-msg"></div><div id="gm-btns"></div></div>';
    document.body.appendChild(overlay);
  }

  function show({ emoji = '🏆', title = '', stars = 0, msg = '', onAgain, onBack, onExtra }) {
    init();
    document.getElementById('gm-emoji').textContent = emoji;
    document.getElementById('gm-title').textContent = title;
    document.getElementById('gm-stars').textContent = '⭐'.repeat(Math.min(stars,5)) + '☆'.repeat(Math.max(0,5-stars));
    document.getElementById('gm-msg').textContent = msg;

    const btns = document.getElementById('gm-btns');
    btns.innerHTML = '';

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
