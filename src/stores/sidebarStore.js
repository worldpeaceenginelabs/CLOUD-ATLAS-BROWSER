import { writable } from 'svelte/store';

function createSidebarStore() {
  const { subscribe, set, update } = writable({
    visible: true,
    width: 400,
    activeTab: 'console'
  });

  return {
    subscribe,
    
    toggle: () => {
      update(state => ({
        ...state,
        visible: !state.visible
      }));
    },
    
    show: () => {
      update(state => ({
        ...state,
        visible: true
      }));
    },
    
    hide: () => {
      update(state => ({
        ...state,
        visible: false
      }));
    },
    
    setWidth: (width) => {
      update(state => ({
        ...state,
        width: Math.max(200, Math.min(800, width))
      }));
    },
    
    setActiveTab: (tabId) => {
      update(state => ({
        ...state,
        activeTab: tabId
      }));
    }
  };
}

export const sidebarStore = createSidebarStore();