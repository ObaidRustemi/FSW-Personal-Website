// Auto-close menu functionality
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.querySelector('.toggler');
  const menuLinks = document.querySelectorAll('.menu-content a');

  menuLinks.forEach(link => {
    link.addEventListener('click', function() {
      // Only close menu for internal links (not external ones)
      if (this.getAttribute('href').startsWith('#')) {
        menuToggle.checked = false;
      }
    });
  });
});