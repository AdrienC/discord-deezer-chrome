class Config {
  constructor() {
    this._tokensPolicy = 'last';
    this._lastTokenFound = null;
    this._tokensFound = [];
    this._tokensSelection = [];
    this._notificationsEnabled = true;
    this._loggingEnabled = true;
  }
  get notificationsEnabled() {
    return this._notificationsEnabled;
  }
  set notificationsEnabled(newValue) {
    if (this._notificationsEnabled !== newValue) {
      let changeInfo = { notificationsEnabled: { oldValue: this._notificationsEnabled, newValue: newValue } }
      this._notificationsEnabled = newValue;
      chrome.storage.sync.set({ notificationsEnabled: newValue });
      if (this._onChangedCallback) {
        this._onChangedCallback(changeInfo);
      }
    }
  }
  get lastTokenFound() {
    return this._lastTokenFound;
  }
  set lastTokenFound(newValue) {
    if (this._lastTokenFound !== newValue) {
      let changeInfo = { lastTokenFound: { oldValue: this._lastTokenFound, newValue: newValue } }
      this._lastTokenFound = newValue;
      chrome.storage.sync.set({ lastTokenFound: newValue });
      if (this._onChangedCallback) {
        this._onChangedCallback(changeInfo);
      }
    }
  }
  get tokensPolicy() {
    return this._tokensPolicy;
  }
  set tokensPolicy(newValue) {
    if (this._tokensPolicy !== newValue) {
      let changeInfo = { tokensPolicy: { oldValue: this._tokensPolicy, newValue: newValue } }
      this._tokensPolicy = newValue;
      chrome.storage.sync.set({ tokensPolicy: newValue });
      if (this._onChangedCallback) {
        this._onChangedCallback(changeInfo);
      }
    }
  }
  get tokensFound() {
    return this._tokensFound;
  }
  set tokensFound(newValue) {
    if (this._tokensFound !== newValue) {
      let changeInfo = { tokensFound: { oldValue: this._tokensFound, newValue: newValue } }
      this._tokensFound = newValue;
      chrome.storage.sync.set({ tokensFound: newValue });
      if (this._onChangedCallback) {
        this._onChangedCallback(changeInfo);
      }
    }
  }
  get tokensSelection() {
    return this._tokensSelection;
  }
  set tokensSelection(newValue) {
    if (this._tokensSelection !== newValue) {
      let changeInfo = { tokensSelection: { oldValue: this._tokensSelection, newValue: newValue } }
      this._tokensSelection = newValue;
      chrome.storage.sync.set({ tokensSelection: newValue });
      if (this._onChangedCallback) {
        this._onChangedCallback(changeInfo);
      }
    }
  }
  get loggingEnabled() {
    return this._loggingEnabled;
  }
  set loggingEnabled(newValue) {
    if (this._loggingEnabled !== newValue) {
      let changeInfo = { loggingEnabled: { oldValue: this._loggingEnabled, newValue: newValue } }
      this._loggingEnabled = newValue;
      chrome.storage.sync.set({ loggingEnabled: newValue });
      if (this._onChangedCallback) {
        this._onChangedCallback(changeInfo);
      }
    }
  }
  set onChanged(callback) {
    this._onChangedCallback = callback;
  }
  load() {
    const cfg = this;
    return new Promise(resolve => {
      let props = Object.keys(cfg).map((prop) => prop.substring(1));
      chrome.storage.sync.get(props, (newConfig) => {
        Object.assign(cfg, newConfig);
        /* Notify config loaded */
        let changeInfos = {};
        for (let prop of props) {
          changeInfos[prop] = { oldValue: cfg['_' + prop], newValue: newConfig[prop] ? newConfig[prop] : cfg['_' + prop] };
        }
        if (cfg._onChangedCallback) {
          cfg._onChangedCallback(changeInfos);
        }
        /* Log change */
        if (cfg.loggingEnabled) {
          console.log(`Config set to: ${JSON.stringify(cfg, null, 4)}`);
        }

        /* Track config changes */
        chrome.storage.onChanged.addListener((changes, areaName) => {
          let configChanged = false;
          for (let change in changes) {
            if (cfg['_' + change] !== changes[change].newValue) {
              cfg['_' + change] = changes[change].newValue;
              configChanged = true;
              if (cfg._loggingEnabled || change === 'loggingEnabled') {
                console.log(`Config '${change}' changed to ${changes[change].newValue}.`);
              }
            }
          }
          if (configChanged && cfg._onChangedCallback) {
            cfg._onChangedCallback(changes);
          }
        });

        resolve();
      });
    });
  }
}

export default (new Config);
