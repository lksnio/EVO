/** Small ink-and-bone cursors stay legible over bright water and dark menus alike. CSS keeps them latency-free. */
const cursor = (body: string, x = 4, y = 3, fallback = 'default') =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="#071317" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`)}") ${x} ${y}, ${fallback}`;
const arrow = '<path d="M4 3 L7 25 L12 18 L18 27 L22 25 L16 16 L25 15 Z" fill="#e6dcc4"/><path d="M7 9 L10 19 L12 15 L18 14 Z" fill="#739d98" stroke="none"/>';
export const CURSOR = {
  arrow: cursor(arrow),
  pointer: cursor('<path d="M4 3 L7 25 L12 18 L18 27 L22 25 L16 16 L25 15 Z" fill="#e9c88d"/><path d="M7 9 L10 19 L12 15 L18 14 Z" fill="#9c7847" stroke="none"/>', 4, 3, 'pointer'),
  inspect: cursor('<path d="M4 3 L7 25 L12 18 L18 27 L22 25 L16 16 L25 15 Z" fill="#a9d2c5"/><path d="M25 19 L30 24 L25 29 L20 24 Z" fill="#e6dcc4"/><path d="M25 22 V26 M23 24 H27" stroke="#527c78" stroke-width="1"/>', 4, 3, 'pointer'),
  grab: cursor('<path d="M16 3 L12 8 H20 Z M16 29 L12 24 H20 Z M3 16 L8 12 V20 Z M29 16 L24 12 V20 Z" fill="#b4bbb0"/><path d="M16 11 L21 16 L16 21 L11 16 Z" fill="#739d98"/>', 16, 16, 'grab'),
  grabbing: cursor('<path d="M16 7 L12 12 H20 Z M16 25 L12 20 H20 Z M7 16 L12 12 V20 Z M25 16 L20 12 V20 Z" fill="#e9c88d"/>', 16, 16, 'grabbing'),
};
