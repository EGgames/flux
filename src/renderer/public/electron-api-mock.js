/**
 * electron-api-mock.js
 * Mock de window.electronAPI para E2E en browser (sin Electron).
 * Se inyecta antes de main.tsx mediante el plugin Vite de E2E.
 */
;(function () {
  if (window.electronAPI) return // ya existe (entorno Electron real)

  const noop    = () => Promise.resolve({ success: true })
  const noopArr = () => Promise.resolve([])

  var mockProfile = { id: 'mock-profile', name: 'Mock Profile', isDefault: true, preferences: '{}' }

  window.electronAPI = {
    // --- Event bus mínimo ---
    on:  function() {},
    off: function() {},

    // --- profiles ---
    profiles: {
      list:   function() { return Promise.resolve([mockProfile]) },
      create: noop,
      update: noop,
      remove: noop,
      select: function() { return Promise.resolve(mockProfile) }
    },

    // --- audioAssets ---
    audioAssets: {
      list:        noopArr,
      import:      noop,
      importBatch: function() { return Promise.resolve([]) },
      remove:      noop,
      pickFiles:   function() { return Promise.resolve([]) },
      updateFades: function() { return Promise.resolve({}) }
    },

    // --- audioEffects ---
    audioEffects: {
      get:    function() { return Promise.resolve({ id: 'mock', profileId: 'mock-profile', crossfadeEnabled: false, crossfadeMs: 2000, crossfadeCurve: 'equal-power' }) },
      update: function() { return Promise.resolve({ id: 'mock', profileId: 'mock-profile', crossfadeEnabled: false, crossfadeMs: 2000, crossfadeCurve: 'equal-power' }) }
    },

    // --- playout ---
    playout: {
      start:         noop,
      syncProgram:   noop,
      stop:          noop,
      pause:         noop,
      resume:        noop,
      next:          noop,
      getStatus:     function() { return Promise.resolve({ state: 'stopped', profileId: null, track: null, queueIndex: 0, queueLength: 0, songsSinceLastAd: 0 }) },
      triggerAdBlock: noop,
      adEndAck:      noop,
      stopAd:        noop,
      streamChunk:   noop
    },

    // --- playlists ---
    playlists: {
      list:         noopArr,
      create:       noop,
      update:       noop,
      remove:       noop,
      getWithItems: function() { return Promise.resolve({ id: 'mock', name: 'Mock', enabled: true, profileId: 'mock-profile', items: [] }) },
      addItem:      noop,
      removeItem:   noop,
      reorder:      noop
    },

    // --- soundboard --- retorna ARRAY, no objeto
    soundboard: {
      get:    function() { return Promise.resolve([]) },
      assign: noop,
      trigger: function() { return Promise.resolve({ slotIndex: 0, mode: 'oneshot', audioAsset: null }) }
    },

    // --- adBlocks / adRules ---
    adBlocks: {
      list:         noopArr,
      create:       noop,
      update:       noop,
      remove:       noop,
      getWithItems: function() { return Promise.resolve({ id: 'mock', name: 'Mock', items: [] }) },
      addItem:      noop,
      removeItem:   noop,
      trigger:      noop
    },
    adRules: {
      list:   noopArr,
      create: noop,
      update: noop,
      remove: noop
    },

    // --- programs ---
    programs: {
      list:   noopArr,
      create: noop,
      update: noop,
      remove: noop
    },

    // --- outputs (save / test / toggleEnabled) ---
    outputs: {
      list:          noopArr,
      save:          noop,
      remove:        noop,
      test:          function() { return Promise.resolve({ success: true, message: 'OK' }) },
      toggleEnabled: function(id, enabled) { return Promise.resolve({ id: id, enabled: enabled }) }
    }
  }

  console.info('[E2E] window.electronAPI mock instalado')
})()
