import { writable } from 'svelte/store';
import { detectSuspiciousActivity } from '../utils/security.js';

function createSecurityStore() {
  const { subscribe, set, update } = writable({
    warnings: [],
    blockedUrls: [],
    trustedDomains: ['localhost'],
    securityLevel: 'medium', // low, medium, high
    lastSecurityScan: null,
    totalThreatsBlocked: 0
  });

  return {
    subscribe,
    
    addWarning: (message, severity = 'medium', details = null) => {
      const warning = {
        id: Date.now() + Math.random(),
        message,
        severity,
        details,
        timestamp: new Date().toISOString(),
        dismissed: false
      };
      
      update(state => ({
        ...state,
        warnings: [...state.warnings, warning].slice(-50), // Keep last 50 warnings
        totalThreatsBlocked: state.totalThreatsBlocked + 1
      }));
      
      // Auto-dismiss low severity warnings after 30 seconds
      if (severity === 'low') {
        setTimeout(() => {
          update(state => ({
            ...state,
            warnings: state.warnings.map(w => 
              w.id === warning.id ? { ...w, dismissed: true } : w
            )
          }));
        }, 30000);
      }
    },
    
    dismissWarning: (warningId) => {
      update(state => ({
        ...state,
        warnings: state.warnings.map(warning => 
          warning.id === warningId ? { ...warning, dismissed: true } : warning
        )
      }));
    },
    
    clearWarnings: () => {
      update(state => ({
        ...state,
        warnings: []
      }));
    },
    
    blockUrl: (url, reason = 'Security policy violation') => {
      update(state => {
        const blocked = {
          url,
          reason,
          timestamp: new Date().toISOString(),
          attempts: 1
        };
        
        const existingIndex = state.blockedUrls.findIndex(b => b.url === url);
        if (existingIndex >= 0) {
          // Increment attempts for existing blocked URL
          const updated = [...state.blockedUrls];
          updated[existingIndex].attempts += 1;
          return {
            ...state,
            blockedUrls: updated,
            totalThreatsBlocked: state.totalThreatsBlocked + 1
          };
        }
        
        return {
          ...state,
          blockedUrls: [...state.blockedUrls, blocked].slice(-100), // Keep last 100
          totalThreatsBlocked: state.totalThreatsBlocked + 1
        };
      });
    },
    
    isUrlBlocked: (url) => {
      let blocked = false;
      update(state => {
        blocked = state.blockedUrls.some(blockedUrl => 
          url.includes(blockedUrl.url) || blockedUrl.url.includes(url)
        );
        return state;
      });
      return blocked;
    },
    
    addTrustedDomain: (domain) => {
      update(state => {
        if (!state.trustedDomains.includes(domain)) {
          return {
            ...state,
            trustedDomains: [...state.trustedDomains, domain]
          };
        }
        return state;
      });
    },
    
    removeTrustedDomain: (domain) => {
      update(state => ({
        ...state,
        trustedDomains: state.trustedDomains.filter(d => d !== domain)
      }));
    },
    
    isDomainTrusted: (domain) => {
      let trusted = false;
      update(state => {
        trusted = state.trustedDomains.some(trustedDomain => 
          domain === trustedDomain || domain.endsWith('.' + trustedDomain)
        );
        return state;
      });
      return trusted;
    },
    
    setSecurityLevel: (level) => {
      update(state => ({
        ...state,
        securityLevel: level
      }));
    },
    
    performSecurityScan: (logs) => {
      const suspiciousActivity = detectSuspiciousActivity(logs);
      
      update(state => ({
        ...state,
        lastSecurityScan: new Date().toISOString()
      }));
      
      // Add warnings for detected suspicious activity
      suspiciousActivity.forEach(activity => {
        setTimeout(() => {
          update(state => {
            const warning = {
              id: Date.now() + Math.random(),
              message: activity.message,
              severity: activity.severity,
              details: activity.details || `Count: ${activity.count}`,
              timestamp: new Date().toISOString(),
              dismissed: false,
              type: 'security_scan'
            };
            
            return {
              ...state,
              warnings: [...state.warnings, warning].slice(-50)
            };
          });
        }, 100);
      });
      
      return suspiciousActivity;
    },
    
    getSecurityMetrics: () => {
      let metrics = null;
      update(state => {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentWarnings = state.warnings.filter(w => 
          new Date(w.timestamp) > last24h
        );
        
        const recentBlocks = state.blockedUrls.filter(b => 
          new Date(b.timestamp) > last24h
        );
        
        metrics = {
          totalWarnings: state.warnings.length,
          recentWarnings: recentWarnings.length,
          highSeverityWarnings: recentWarnings.filter(w => w.severity === 'high').length,
          totalBlockedUrls: state.blockedUrls.length,
          recentBlocks: recentBlocks.length,
          totalThreatsBlocked: state.totalThreatsBlocked,
          trustedDomains: state.trustedDomains.length,
          securityLevel: state.securityLevel,
          lastScan: state.lastSecurityScan
        };
        
        return state;
      });
      return metrics;
    },
    
    exportSecurityLog: () => {
      let exportData = null;
      update(state => {
        exportData = {
          warnings: state.warnings.map(w => ({
            message: w.message,
            severity: w.severity,
            timestamp: w.timestamp,
            dismissed: w.dismissed
          })),
          blockedUrls: state.blockedUrls.map(b => ({
            url: b.url,
            reason: b.reason,
            timestamp: b.timestamp,
            attempts: b.attempts
          })),
          metrics: {
            totalThreatsBlocked: state.totalThreatsBlocked,
            securityLevel: state.securityLevel,
            lastScan: state.lastSecurityScan
          },
          exportTimestamp: new Date().toISOString()
        };
        return state;
      });
      return exportData;
    },
    
    importSecuritySettings: (settingsData) => {
      try {
        update(state => ({
          ...state,
          trustedDomains: settingsData.trustedDomains || state.trustedDomains,
          securityLevel: settingsData.securityLevel || state.securityLevel,
          blockedUrls: settingsData.blockedUrls || state.blockedUrls
        }));
        return true;
      } catch (error) {
        console.error('Failed to import security settings:', error);
        return false;
      }
    },
    
    reset: () => {
      set({
        warnings: [],
        blockedUrls: [],
        trustedDomains: ['localhost'],
        securityLevel: 'medium',
        lastSecurityScan: null,
        totalThreatsBlocked: 0
      });
    }
  };
}

export const securityStore = createSecurityStore();

// Auto-perform security scans periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    // This would be triggered by the main application
    // with current logs for analysis
  }, 5 * 60 * 1000); // Every 5 minutes
}