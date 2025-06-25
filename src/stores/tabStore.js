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
        canGoBack: false,
        canGoForward: false,
        viewId: null,
        processId: null,
        processStatus: 'pending', // pending, running, crashed, unresponsive, terminated
        memoryInfo: null,
        statusMessage: null
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
    }
  };
}

export const tabStore = createTabStore();