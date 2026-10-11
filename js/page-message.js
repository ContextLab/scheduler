/**
 * PageMessage — renders a titled status message (with a "Back to scheduling"
 * link) into a container. Shared by the token-link pages (cancel.html,
 * confirm.html).
 */

var PageMessage = (function () {
  function render(container, title, body, showCheck) {
    if (!container) return;
    container.textContent = '';

    if (showCheck) {
      var checkmark = document.createElement('div');
      checkmark.className = 'checkmark';
      checkmark.textContent = '✓';
      container.appendChild(checkmark);
    }

    var h2 = document.createElement('h2');
    h2.textContent = title;
    container.appendChild(h2);

    var p = document.createElement('p');
    p.style.marginTop = '12px';
    p.textContent = body;
    container.appendChild(p);

    var links = document.createElement('div');
    links.className = 'confirmation-links';
    links.style.marginTop = '16px';
    var a = document.createElement('a');
    a.href = './';
    a.textContent = 'Back to scheduling';
    links.appendChild(a);
    container.appendChild(links);
  }

  return { render: render };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageMessage;
}
