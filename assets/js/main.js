/* ========== 思镜 · 游戏引擎 ========== */
(() => {
  const $ = (id) => document.getElementById(id);
  const pages = { home: $("home"), story: $("story"), ending: $("ending") };

  let current = null;      // 当前故事
  let typeTimer = null;    // 打字机计时器
  let visited = 0;         // 已访问节点数（进度条）

  /* ---------- 页面切换 ---------- */
  function show(name) {
    Object.values(pages).forEach(p => p.classList.remove("active"));
    pages[name].classList.add("active");
    window.scrollTo({ top: 0 });
  }

  /* ---------- 首页卡片 ---------- */
  function renderCards() {
    const box = $("cards");
    box.innerHTML = STORIES.map((s, i) => `
      <article class="card" data-id="${s.id}" style="transition-delay:${(i % 6) * 0.06}s">
        <span class="card-icon">${s.icon}</span>
        <h3 class="card-name">${s.title}</h3>
        <p class="card-en">${s.en}</p>
        <p class="card-desc">${s.desc}</p>
        <span class="card-go">进入故事 →</span>
      </article>`).join("");

    box.querySelectorAll(".card").forEach(card => {
      card.addEventListener("click", () => openStory(card.dataset.id));
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", (e.clientX - r.left) + "px");
        card.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });

    // 滚动进入视口时浮现
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => en.isIntersecting && en.target.classList.add("shown"));
    }, { threshold: 0.12 });
    box.querySelectorAll(".card").forEach(c => io.observe(c));
  }

  /* ---------- 故事流程 ---------- */
  function openStory(id) {
    current = STORIES.find(s => s.id === id);
    visited = 0;
    $("story-tag").textContent = current.tag;
    $("story-title").textContent = current.title;
    show("story");
    gotoNode(current.start);
    if (!MusicBox.playing) toggleMusic(); // 进入故事自动开启音乐
  }

  function gotoNode(id) {
    const node = current.nodes[id];
    visited++;
    $("progress").style.width = Math.min(visited * 14, 96) + "%";

    // 结局节点
    if (node.ending) { typewrite(node.text, () => setTimeout(() => showEnding(node), 900)); return; }

    typewrite(node.text, () => renderChoices(node.choices));
  }

  /* ---------- 打字机 ---------- */
  function typewrite(text, done) {
    clearInterval(typeTimer);
    const el = $("story-text");
    el.innerHTML = '<span class="cursor"></span>';
    $("choices").innerHTML = "";
    let i = 0;
    typeTimer = setInterval(() => {
      i += 1;
      const slice = text.slice(0, i);
      el.innerHTML = slice.replace(/\n/g, "<br>") + '<span class="cursor"></span>';
      if (i >= text.length) {
        clearInterval(typeTimer);
        el.querySelector(".cursor")?.remove();
        done && done();
      }
    }, 26);
    // 点击文本跳过打字动画
    el.onclick = () => {
      clearInterval(typeTimer);
      el.innerHTML = text.replace(/\n/g, "<br>");
      done && done();
    };
  }

  /* ---------- 选项 ---------- */
  function renderChoices(choices) {
    const box = $("choices");
    box.innerHTML = "";
    choices.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.dataset.key = String.fromCharCode(65 + i);
      btn.style.animationDelay = (i * 0.12) + "s";
      btn.textContent = c.text;
      btn.onclick = () => gotoNode(c.next);
      box.appendChild(btn);
    });
  }

  /* ---------- 结局 ---------- */
  function showEnding(node) {
    $("ending-tag").textContent = current.tag + " · " + ({ good: "明镜结局", neutral: "微澜结局", bad: "涟漪结局" }[node.ending] || "结局");
    $("ending-title").textContent = current.title;
    $("ending-verdict").textContent = node.verdict;
    $("ending-fallacy").textContent = current.fallacy;
    $("ending-lesson").textContent = current.lesson;
    $("ending-life").textContent = "生活里 — " + current.life;
    $("progress").style.width = "100%";
    show("ending");
  }

  /* ---------- 音乐 ---------- */
  function toggleMusic() {
    const on = MusicBox.toggle();
    $("btn-music").textContent = on ? "♪ 音乐：开" : "♪ 音乐：关";
  }

  /* ---------- 粒子背景 ---------- */
  function initParticles() {
    const cv = $("particles"), ctx2d = cv.getContext("2d");
    let W, H, dots;
    const resize = () => {
      W = cv.width = innerWidth; H = cv.height = innerHeight;
      dots = Array.from({ length: Math.min(70, W / 18) }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        vx: (Math.random() - 0.5) * 0.22, vy: -Math.random() * 0.3 - 0.06,
        a: Math.random() * 0.5 + 0.15
      }));
    };
    resize(); addEventListener("resize", resize);
    (function loop() {
      ctx2d.clearRect(0, 0, W, H);
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
        if (d.x < -10) d.x = W + 10; if (d.x > W + 10) d.x = -10;
        ctx2d.beginPath();
        ctx2d.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx2d.fillStyle = `rgba(212,175,106,${d.a})`;
        ctx2d.fill();
      });
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- 事件绑定 ---------- */
  $("btn-start").onclick = () => $("gallery").scrollIntoView({ behavior: "smooth" });
  $("btn-music").onclick = toggleMusic;
  $("btn-back").onclick = () => show("home");
  $("btn-home").onclick = () => show("home");
  $("btn-retry").onclick = () => openStory(current.id);

  // 键盘 A/B/C 选择
  addEventListener("keydown", (e) => {
    if (!pages.story.classList.contains("active")) return;
    const idx = e.key.toUpperCase().charCodeAt(0) - 65;
    const btns = $("choices").querySelectorAll(".choice");
    if (idx >= 0 && idx < btns.length) btns[idx].click();
  });

  renderCards();
  initParticles();
})();
