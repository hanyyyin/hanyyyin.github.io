/* ═══════════════════════════════════════════════════════════════
   main.js — 无依赖。负责：主题切换 / 导航高亮 / 滚动淡入 /
             News 折叠 / BibTeX 展开 / 邮箱复制
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. 深色 / 浅色切换 ───────────────────────────────────── */
  var toggle = document.getElementById('themeToggle');
  var syncThemeToggle = function () {
    if (toggle) toggle.setAttribute('aria-pressed', String(root.getAttribute('data-theme') === 'dark'));
  };
  syncThemeToggle();
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      syncThemeToggle();
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }
  // 默认深色；手动选择的主题在下次访问时保留。

  /* ── 2. 顶栏滚动状态 ─────────────────────────────────────── */
  var nav = document.getElementById('nav');
  var onScroll = function () {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 24);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── 3. 当前所在小节高亮 ─────────────────────────────────── */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  var sections = navLinks
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
          if (a.classList.contains('active')) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-25% 0px -70% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ── 4. 滚动淡入 ─────────────────────────────────────────── */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var targets = Array.prototype.slice.call(
      document.querySelectorAll('.section, .pub, .tl-item')
    );

    var ioAlive = false;

    var revealer = new IntersectionObserver(function (entries, obs) {
      ioAlive = true;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    targets.forEach(function (el) {
      el.classList.add('reveal');
      revealer.observe(el);
    });

    // 安全网。.reveal 默认是 opacity:0，所以万一 IntersectionObserver 一次都不回调
    // （浏览器怪癖、扩展干扰、异常的渲染状态），整页内容就永远是空白的。
    // 正常浏览器在开始观察后会立刻给出一批初始回调（无论元素是否在视口内），
    // 所以 ioAlive 一定会被置真。1.5 秒后它还是假 = IO 确实死了，
    // 这时无条件显示全部内容 —— 宁可丢掉动画，也不能让人看到空页面。
    var safetyNet = function () {
      if (ioAlive || document.visibilityState === 'hidden') return;
      targets.forEach(function (el) { el.classList.add('in'); });
    };
    setTimeout(safetyNet, 1500);
    document.addEventListener('visibilitychange', function () { setTimeout(safetyNet, 1500); });
  }

  /* ── 5. News 折叠：超过 4 条自动收起 ──────────────────────── */
  var VISIBLE_NEWS = 4;
  var newsList = document.getElementById('newsList');
  var newsToggle = document.getElementById('newsToggle');

  if (newsList && newsToggle) {
    var items = Array.prototype.slice.call(newsList.children);
    if (items.length > VISIBLE_NEWS) {
      var collapsed = true;
      var apply = function () {
        newsToggle.setAttribute('aria-expanded', String(!collapsed));
        items.forEach(function (li, i) {
          li.classList.toggle('hidden-news', collapsed && i >= VISIBLE_NEWS);
        });
        newsToggle.textContent = collapsed
          ? 'Show all news (' + items.length + ')'
          : 'Show less';
      };
      newsToggle.hidden = false;
      apply();
      newsToggle.addEventListener('click', function () {
        collapsed = !collapsed;
        apply();
      });
    }
  }

  // 打印时包含折叠论文，结束后恢复阅读时的展开状态。
  var morePublications = document.getElementById('morePublications');
  if (morePublications) {
    var publicationsBeforePrint = null;
    window.addEventListener('beforeprint', function () {
      if (publicationsBeforePrint === null) publicationsBeforePrint = morePublications.open;
      morePublications.open = true;
    });
    window.addEventListener('afterprint', function () {
      if (publicationsBeforePrint !== null) morePublications.open = publicationsBeforePrint;
      publicationsBeforePrint = null;
    });
  }

  /* ── 6. BibTeX 展开 / 收起 ───────────────────────────────── */
  document.querySelectorAll('.bib-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var pre = btn.closest('.pub-body').querySelector('.bibtex');
      if (!pre) return;
      var open = pre.hasAttribute('hidden');
      if (open) { pre.removeAttribute('hidden'); } else { pre.setAttribute('hidden', ''); }
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* 论文配图：原始链接作为无脚本回退，dialog 提供焦点隔离及 Escape 关闭。 */
  var figureDialog = document.getElementById('figureDialog');
  if (figureDialog && typeof figureDialog.showModal === 'function') {
    var figureOpener = null;
    document.querySelectorAll('[data-figure]').forEach(function (link) {
      link.setAttribute('aria-haspopup', 'dialog');
      link.setAttribute('aria-controls', 'figureDialog');
      link.addEventListener('click', function (event) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        var pub = link.closest('.pub');
        var thumbnail = link.querySelector('img');
        var image = document.getElementById('figureImage');
        image.src = thumbnail.src;
        image.alt = thumbnail.alt;
        document.getElementById('figureTitle').textContent = pub.querySelector('.pub-title').textContent.trim();
        var description = pub.querySelector('.pub-tldr');
        document.getElementById('figureDescription').textContent = description ? description.textContent.trim() : '';
        var links = document.getElementById('figureLinks');
        links.replaceChildren();
        pub.querySelectorAll('.pub-links a').forEach(function (source) {
          links.appendChild(source.cloneNode(true));
        });
        figureOpener = link;
        figureDialog.showModal();
        figureDialog.scrollTop = 0;
        root.classList.add('figure-open');
      });
    });
    figureDialog.querySelector('.figure-close').addEventListener('click', function () {
      figureDialog.close();
    });
    figureDialog.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;
      var controls = figureDialog.querySelectorAll('button, a[href]');
      var first = controls[0];
      var last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    // 只在按下和松开都发生于遮罩时关闭，避免图片内拖动误触。
    var backdropPress = false;
    var outsideDialog = function (event) {
      var rect = figureDialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom;
    };
    figureDialog.addEventListener('pointerdown', function (event) {
      backdropPress = outsideDialog(event);
    });
    figureDialog.addEventListener('click', function (event) {
      if (backdropPress && outsideDialog(event)) figureDialog.close();
      backdropPress = false;
    });
    figureDialog.addEventListener('close', function () {
      root.classList.remove('figure-open');
      if (figureOpener) figureOpener.focus({ preventScroll: true });
    });
  }

  /* ── 7. 一键复制邮箱 ─────────────────────────────────────── */
  var copyBtn = document.getElementById('copyMail');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var mail = copyBtn.dataset.mail || '';
      var hint = copyBtn.querySelector('.copy-hint');
      var done = function () {
        copyBtn.classList.add('copied');
        if (hint) hint.textContent = 'copied ✓';
        setTimeout(function () {
          copyBtn.classList.remove('copied');
          if (hint) hint.textContent = 'copy';
        }, 1600);
      };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(mail).then(done).catch(fallback);
      } else {
        fallback();
      }

      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = mail;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        var copied = false;
        try { copied = document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        if (copied) {
          done();
        } else {
          var range = document.createRange();
          range.selectNodeContents(copyBtn.querySelector('.mail-text'));
          var selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          if (hint) hint.textContent = 'select and copy';
        }
      }
    });
  }

  /* ── 8. Beyond Research 照片集 ──────────────────────────── */
  var photoTrack = document.getElementById('photoTrack');
  var photoControls = document.getElementById('photoControls');
  if (photoTrack && photoControls) {
    var photoPrev = document.getElementById('photoPrev');
    var photoNext = document.getElementById('photoNext');
    var photoCards = photoTrack.querySelectorAll('.photo-card');
    var photoCount = document.getElementById('photoCount');
    var photoStep = function () {
      return photoCards.length > 1
        ? photoCards[1].getBoundingClientRect().left - photoCards[0].getBoundingClientRect().left
        : photoTrack.clientWidth;
    };
    var updatePhotoButtons = function () {
      photoPrev.disabled = photoTrack.scrollLeft <= 1;
      photoNext.disabled = photoTrack.scrollLeft >= photoTrack.scrollWidth - photoTrack.clientWidth - 1;
      var position = Math.min(photoCards.length, Math.round(photoTrack.scrollLeft / photoStep()) + 1);
      var count = position + ' / ' + photoCards.length;
      if (photoCount && photoCount.textContent !== count) photoCount.textContent = count;
    };
    var scrollPhotos = function (left) {
      photoTrack.scrollTo({ left: left, behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    var movePhotos = function (direction) {
      scrollPhotos(photoTrack.scrollLeft + direction * photoStep());
    };
    photoControls.hidden = false;
    updatePhotoButtons();
    photoPrev.addEventListener('click', function () { movePhotos(-1); });
    photoNext.addEventListener('click', function () { movePhotos(1); });
    photoTrack.addEventListener('scroll', updatePhotoButtons, { passive: true });
    window.addEventListener('resize', updatePhotoButtons);
    photoTrack.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); movePhotos(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); movePhotos(1); }
      if (e.key === 'Home') { e.preventDefault(); scrollPhotos(0); }
      if (e.key === 'End') { e.preventDefault(); scrollPhotos(photoTrack.scrollWidth); }
    });

    // 触屏和触控板使用原生滚动；鼠标拖动只作用于图片集。
    var photoDrag = null;
    photoTrack.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      photoDrag = { id: e.pointerId, x: e.clientX, left: photoTrack.scrollLeft, moved: false };
      photoTrack.setPointerCapture(e.pointerId);
      photoTrack.focus({ preventScroll: true });
      e.preventDefault();
    });
    photoTrack.addEventListener('pointermove', function (e) {
      if (!photoDrag || e.pointerId !== photoDrag.id) return;
      var dx = e.clientX - photoDrag.x;
      if (!photoDrag.moved && Math.abs(dx) < 4) return;
      photoDrag.moved = true;
      photoTrack.classList.add('is-dragging');
      photoTrack.scrollLeft = photoDrag.left - dx;
    });
    var endPhotoDrag = function (e) {
      if (!photoDrag || e.pointerId !== photoDrag.id) return;
      var moved = photoDrag.moved;
      var destination = Math.round(photoTrack.scrollLeft / photoStep()) * photoStep();
      photoDrag = null;
      photoTrack.classList.remove('is-dragging');
      if (photoTrack.hasPointerCapture(e.pointerId)) photoTrack.releasePointerCapture(e.pointerId);
      if (moved) scrollPhotos(destination);
    };
    photoTrack.addEventListener('pointerup', endPhotoDrag);
    photoTrack.addEventListener('pointercancel', endPhotoDrag);
    photoTrack.addEventListener('lostpointercapture', endPhotoDrag);
  }

  /* ── 9. 页脚年份自动更新 ─────────────────────────────────── */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
