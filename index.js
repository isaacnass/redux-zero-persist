const key_prefix = 'persist:'

function _() {}
let debounce_timeout

function stringifyState(state, config) {
  if (!config.ignore_keys || config.ignore_keys.length === 0) {
    return JSON.stringify(state)
  }

  const ignorers = {}
  config.ignore_keys.forEach(k => (ignorers[k] = undefined))

  return JSON.stringify({
    ...state,
    ...ignorers,
  })
}

/**
 * map state to storage
 * @param store
 * @param config
 * @returns {Promise<any>}
 */
function mapStateToStorage(store, config) {
  return new Promise((resolve, reject) => {
    if (config.debounce_interval) {
      resolve(store.getState())
      clearTimeout(debounce_timeout)
      debounce_timeout = setTimeout(() => {
        config.storage.setItem(
          key_prefix + config.key,
          stringifyState(store.getState(), config),
          err => err && reject(err)
        )
      }, config.debounce_interval)
    } else {
      const state = store.getState()
      config.storage.setItem(
        key_prefix + config.key,
        stringifyState(state, config),
        err => (err ? reject(err) : resolve(state))
      )
    }
  })
}

/**
 * map storage to state
 * @param state
 * @param config
 * @param cb
 */
function mapStorageToState(state, config, cb = _) {
  config.storage.getItem(key_prefix + config.key, (err, value) => {
    let _state = {}
    if (err) {
      cb(null, {})
    }
    try {
      _state = JSON.parse(value)
    } catch (err) {}
    cb(null, Object.assign({}, state, _state))
  })
}

/**
 * Memory key-value storage
 */
class MemoryStorage {
  constructor() {
    this.store = {}
  }
  getItem(key, cb = _) {
    setTimeout(() => cb(null, this.store[key]))
  }
  setItem(key, item, cb = _) {
    setTimeout(() => {
      cb(null, (this.store[key] = item) && item)
    })
  }
  removeItem(key, cb = _) {
    const val = this.store[key]
    setTimeout(() => cb(null, delete this.store[key] && val))
  }
}

function persist(
  config = {
    key: '[rc]',
    storage: new MemoryStorage(),
    debounce_interval: undefined,
    ignore_keys: [],
  },
  cb = _
) {
  mapStorageToState({}, config, (err, state) => {
    if (err) {
      config.storage.removeItem(key_prefix + config.key, _err => {
        cb(_err, state)
      })
    } else {
      cb(err, state)
    }
  })

  // return middleware
  return store => next => action => {
    const r = next(action)
    if (r && typeof r.then === 'function') {
      return next(action).then(d => {
        return mapStateToStorage(store, config).then(() => Promise.resolve(d))
      })
    } else {
      return mapStateToStorage(store, config).then(() => Promise.resolve(r))
    }
  }
}

module.exports = persist
module.exports.default = persist
module.exports.MemoryStorage = MemoryStorage
