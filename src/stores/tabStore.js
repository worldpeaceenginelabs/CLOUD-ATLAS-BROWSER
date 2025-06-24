import { writable } from 'svelte/store';

let tabIdCounter = 0;

function createTabStore() {
  const { subscribe, set, update } = writable({
    tabs: [],
    activeTabId: null
  });

  return {
    subscribe,
    
    createTab: (url = '', title = 'New Tab') => {
      const newTab = {
        id: ++tabIdCounter,
        url,
        title,
        loading: false,
        favicon: null,
        history: [],
        historyIndex: -1
      };
      
      update(state => {
        const newTabs = [...state.tabs, newTab];
        return {
          tabs: newTabs,
          activeTabId: newTab.id
        };
      });
      
      return newTab.id;
    },
    
    closeTab: (tabId) => {
      update(state => {
        const newTabs = state.tabs.filter(tab => tab.id !== tabId);
        let newActiveTabId = state.activeTabId;
        
        // If we're closing the active tab, switch to another tab
        if (state.activeTabId === tabId) {
          if (newTabs.length > 0) {
            // Find the tab that was to the right of the closed tab, or the last tab
            const closedTabIndex = state.tabs.findIndex(tab => tab.id === tabId);
            if (closedTabIndex < newTabs.length) {
              newActiveTabId = newTabs[closedTabIndex].id;
            } else {
              newActiveTabId = newTabs[newTabs.length - 1].id;
            }
          } else {
            newActiveTabId = null;
          }
        }
        
        return {
          tabs: newTabs,
          activeTabId: newActiveTabId
        };
      });
    },
    
    setActiveTab: (tabId) => {
      update(state => ({
        ...state,
        activeTabId: tabId
      }));
    },
    
    updateTab: (tabId, updates) => {
      update(state => ({
        ...state,
        tabs: state.tabs.map(tab => 
          tab.id === tabId ? { ...tab, ...updates } : tab
        )
      }));
    },
    
    getTab: (tabId) => {
      let result = null;
      update(state => {
        result = state.tabs.find(tab => tab.id === tabId);
        return state;
      });
      return result;
    },
    
    addToHistory: (tabId, url) => {
      update(state => ({
        ...state,
        tabs: state.tabs.map(tab => {
          if (tab.id === tabId) {
            const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), url];
            return {
              ...tab,
              history: newHistory,
              historyIndex: newHistory.length - 1
            };
          }
          return tab;
        })
      }));
    },
    
    goBack: (tabId) => {
      update(state => ({
        ...state,
        tabs: state.tabs.map(tab => {
          if (tab.id === tabId && tab.historyIndex > 0) {
            const newIndex = tab.historyIndex - 1;
            return {
              ...tab,
              historyIndex: newIndex,
              url: tab.history[newIndex]
            };
          }
          return tab;
        })
      }));
    },
    
    goForward: (tabId) => {
      update(state => ({
        ...state,
        tabs: state.tabs.map(tab => {
          if (tab.id === tabId && tab.historyIndex < tab.history.length - 1) {
            const newIndex = tab.historyIndex + 1;
            return {
              ...tab,
              historyIndex: newIndex,
              url: tab.history[newIndex]
            };
          }
          return tab;
        })
      }));
    },
    
    canGoBack: (tabId) => {
      let result = false;
      update(state => {
        const tab = state.tabs.find(t => t.id === tabId);
        result = tab && tab.historyIndex > 0;
        return state;
      });
      return result;
    },
    
    canGoForward: (tabId) => {
      let result = false;
      update(state => {
        const tab = state.tabs.find(t => t.id === tabId);
        result = tab && tab.historyIndex < tab.history.length - 1;
        return state;
      });
      return result;
    }
  };
}

export const tabStore = createTabStore();