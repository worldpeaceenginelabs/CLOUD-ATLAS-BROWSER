import { writable } from 'svelte/store';

// Sidebar store for managing developer tools sidebar state
function createSidebarStore() {
  const { subscribe, set, update } = writable({
    visible: true,
    width: 400,
    collapsed: false,
    activeTab: 'console', // 'console', 'network', 'security', 'performance'
    position: 'right' // 'right', 'bottom'
  });

  return {
    subscribe,
    
    // Toggle sidebar visibility
    toggle: () => update(state => ({
      ...state,
      visible: !state.visible
    })),
    
    // Show sidebar
    show: () => update(state => ({
      ...state,
      visible: true
    })),
    
    // Hide sidebar
    hide: () => update(state => ({
      ...state,
      visible: false
    })),
    
    // Set sidebar width
    setWidth: (width) => update(state => ({
      ...state,
      width: Math.max(250, Math.min(800, width))
    })),
    
    // Toggle collapsed state
    toggleCollapsed: () => update(state => ({
      ...state,
      collapsed: !state.collapsed,
      width: state.collapsed ? 400 : 60
    })),
    
    // Set active tab
    setActiveTab: (tab) => update(state => ({
      ...state,
      activeTab: tab
    })),
    
    // Set sidebar position
    setPosition: (position) => update(state => ({
      ...state,
      position
    })),
    
    // Reset to defaults
    reset: () => set({
      visible: true,
      width: 400,
      collapsed: false,
      activeTab: 'console',
      position: 'right'
    })
  };
}

export const sidebarStore = createSidebarStore();