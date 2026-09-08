function showBootstrapFailure(error: unknown): void {
  console.error('[Panvas] Renderer bootstrap failed:', error);
  const root = document.getElementById('root');
  if (!root) return;
  root.replaceChildren();

  const panel = document.createElement('main');
  panel.className = 'panvas-bootstrap-failure';
  const title = document.createElement('h1');
  title.textContent = 'Panvas could not start';
  const message = document.createElement('p');
  message.textContent = 'Your local data is safe. Reload the page, or check the browser console for details.';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'Reload Panvas';
  reload.addEventListener('click', () => window.location.reload());
  panel.append(title, message, reload);
  root.append(panel);
}

let mounted = false;
window.addEventListener('error', event => {
  if (!mounted) showBootstrapFailure(event.error ?? event.message);
});
window.addEventListener('unhandledrejection', event => {
  if (!mounted) showBootstrapFailure(event.reason);
});

void import('./bootstrap')
  .then(({ mountPanvas }) => {
    mountPanvas();
    mounted = true;
  })
  .catch(showBootstrapFailure);
