/**
 * Regole del progetto. Nasce dopo un `await` dentro una funzione non `async`
 * finito in sw.js: un errore di sintassi che nessuna prova col browser vedeva,
 * perche' giravano tutte con il service worker bloccato. Qui si guardano
 * tutti i file, service worker compreso.
 *
 * Niente stile: solo le regole che trovano errori veri. La formattazione non
 * la controlla nessuno di proposito, perche' il codice e' scritto a mano.
 */
const browser = [
  'window', 'document', 'navigator', 'location', 'history', 'screen', 'matchMedia',
  'localStorage', 'sessionStorage', 'caches', 'crypto', 'performance', 'devicePixelRatio',
  'fetch', 'Request', 'Response', 'Headers', 'AbortController', 'AbortSignal', 'URL', 'URLSearchParams',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'queueMicrotask', 'structuredClone', 'addEventListener', 'removeEventListener', 'dispatchEvent',
  'getComputedStyle', 'createImageBitmap', 'Image', 'Blob', 'File', 'FileReader', 'FormData',
  'Notification', 'ServiceWorkerRegistration', 'PushManager', 'DOMParser', 'XMLSerializer',
  'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'CSSRule', 'CSS',
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'OffscreenCanvas',
  'alert', 'confirm', 'prompt', 'console', 'atob', 'btoa', 'TextEncoder', 'TextDecoder',
  'Intl', 'AudioContext', 'webkitAudioContext', 'ImageData', 'Path2D', 'DOMRect',
];
const worker = ['self', 'clients', 'registration', 'importScripts', 'skipWaiting', 'ExtendableEvent'];
const node = ['process', 'Buffer', '__dirname', '__filename', 'require', 'module', 'exports', 'global'];
const globals = (nomi) => Object.fromEntries(nomi.map((n) => [n, 'readonly']));

export default [
  {
    files: ['**/*.js'],
    ignores: ['design/**', 'media/**', 'node_modules/**', 'vendor/**'],   // vendor/ e' codice altrui, minificato
    languageOptions: {
      ecmaVersion: 2023, sourceType: 'module',
      globals: { ...globals(browser), ...globals(worker), ...globals(node) },
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      // errori veri
      'no-undef': 'error',
      'no-dupe-keys': 'error', 'no-dupe-args': 'error', 'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error', 'no-unreachable': 'error', 'no-fallthrough': 'error',
      'no-self-compare': 'error', 'no-self-assign': 'error', 'no-sparse-arrays': 'error',
      'use-isnan': 'error', 'valid-typeof': 'error', 'no-cond-assign': 'error',
      'no-func-assign': 'error', 'no-import-assign': 'error', 'no-class-assign': 'error',
      'no-obj-calls': 'error', 'no-setter-return': 'error', 'no-unsafe-negation': 'error',
      'no-unsafe-optional-chaining': 'error', 'no-async-promise-executor': 'error',
      'no-compare-neg-zero': 'error', 'no-constant-binary-expression': 'error',
      'no-unused-private-class-members': 'error', 'no-invalid-regexp': 'error',
      'no-misleading-character-class': 'error', 'no-useless-backreference': 'error',
      'no-template-curly-in-string': 'error',
      // avvisi: roba da ripulire, non da bloccare
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-constant-condition': 'warn',
      eqeqeq: ['warn', 'smart'],
      'no-var': 'warn',
    },
  },
];
