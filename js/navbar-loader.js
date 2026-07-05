// Injects the shared navbar into #navbar-placeholder on every page.
(function () {
  const nav = `
  <nav class="site-nav">
    <div class="nav-inner">
      <a href="index.html" class="nav-brand">🌱 AgriStudent BD</a>
      <ul class="nav-links">
        <li><a href="index.html">Home</a></li>
        <li><a href="department.html">Department</a></li>
        <li><a href="alumni.html">Our Alumni</a></li>
      </ul>
      <div class="nav-actions">
        <a href="alumni.html#register" class="btn-secondary" style="padding:.6rem 1.1rem;font-size:.85rem;">🎓 Register as Alumni</a>
        <a href="login.html" class="btn-ghost" style="padding:.6rem 1.1rem;font-size:.85rem;">Login</a>
      </div>
    </div>
  </nav>`;
  const el = document.getElementById("navbar-placeholder");
  if (el) el.outerHTML = nav;
})();
