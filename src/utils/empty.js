// Empty module for disabled Node.js modules in browser environment
export default {};
export const readFileSync = () => { throw new Error('fs not available in browser'); };
export const createReadStream = () => { throw new Error('fs not available in browser'); };
export const writeFileSync = () => { throw new Error('fs not available in browser'); };
export const existsSync = () => false;
export const statSync = () => { throw new Error('fs not available in browser'); };

// For net module
export const createConnection = () => { throw new Error('net not available in browser'); };
export const createServer = () => { throw new Error('net not available in browser'); };

// For tls module
export const connect = () => { throw new Error('tls not available in browser'); };
export const createSecureContext = () => { throw new Error('tls not available in browser'); };