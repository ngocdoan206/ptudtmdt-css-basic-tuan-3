/* main.js – hiệu ứng nhỏ cho trang chủ JavaScript-Labs (DOM + sự kiện, không dùng thư viện) */
(function () {
  document.documentElement.classList.add("js");
 
  // 1) Đổi giao diện sáng/tối, nhớ lựa chọn (localStorage có thể bị chặn nên bọc try/catch)
  var root = document.documentElement;
  function setTheme(name) {
    root.setAttribute("data-theme", name);
    try { localStorage.setItem("theme", name); } catch (e) {}
  }
  var saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  if (!saved && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) { saved = "dark"; }
  if (saved) { root.setAttribute("data-theme", saved); }
  document.getElementById("themeBtn").addEventListener("click", function () {
    setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });
 
  // 2) Nếu chưa có ảnh đại diện (images/avatar.jpg) thì hiện chữ cái đầu
  var avatar = document.getElementById("avatar");
  var img = avatar.querySelector("img");
  function noImg() { avatar.classList.add("no-img"); }
  img.addEventListener("error", noImg);
  if (img.complete && img.naturalWidth === 0) { noImg(); }
 
  // 3) Năm hiện tại ở chân trang
  document.getElementById("year").textContent = new Date().getFullYear();
 
  // 4) Hiện dần các khối khi cuộn tới
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
  }
 
  // 5) Nút lên đầu trang + tô sáng mục menu đang xem
  var toTop = document.getElementById("toTop");
  var links = document.querySelectorAll(".nav a");
  var sections = Array.prototype.map.call(links, function (a) {
    return document.querySelector(a.getAttribute("href"));
  });
  window.addEventListener("scroll", function () {
    toTop.classList.toggle("show", window.scrollY > 400);
    var pos = window.scrollY + 120, current = -1;
    sections.forEach(function (s, i) { if (s && s.offsetTop <= pos) { current = i; } });
    links.forEach(function (a, i) { a.classList.toggle("active", i === current); });
  });
  toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
})();
 