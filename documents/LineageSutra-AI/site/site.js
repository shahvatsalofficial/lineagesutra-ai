(function () {
  var d = document, root = d.documentElement;
  function setTheme(t) { root.setAttribute('data-theme', t); try { localStorage.setItem('ls-theme', t); } catch (e) {} }
  d.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]'); if (!t) return;
    var a = t.getAttribute('data-act');
    if (a === 'theme') setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    if (a === 'menu') { var o = d.body.classList.toggle('nav-open'); t.setAttribute('aria-expanded', o); }
    if (a === 'scrim') { d.body.classList.remove('nav-open'); }
    if (a === 'copy') {
      var txt = t.getAttribute('data-text') || (t.parentNode.querySelector('code') || {}).textContent || '';
      var done = function () { var o = t.textContent; t.textContent = 'Copied'; setTimeout(function () { t.textContent = o; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done, done); else done();
    }
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') d.body.classList.remove('nav-open'); });
  d.querySelectorAll('.side a').forEach(function (a) { a.addEventListener('click', function () { d.body.classList.remove('nav-open'); }); });
  var links = [].slice.call(d.querySelectorAll('.toc a'));
  if (links.length && 'IntersectionObserver' in window) {
    var map = {}; links.forEach(function (l) { map[l.getAttribute('href').slice(1)] = l; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting && map[en.target.id]) { links.forEach(function (l) { l.classList.remove('on'); }); map[en.target.id].classList.add('on'); } });
    }, {rootMargin: '-70px 0px -70% 0px'});
    Object.keys(map).forEach(function (id) { var el = d.getElementById(id); if (el) io.observe(el); });
  }
})();
