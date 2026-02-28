// Face ID / Touch ID via WebAuthn (Passkey) on iOS Safari.
// This is NOT App Store FaceID API, but iOS uses FaceID for passkey user verification.

function b64urlToBytes(b64url){
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g,'+').replace(/_/g,'/');
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for(let i=0;i<str.length;i++) bytes[i]=str.charCodeAt(i);
  return bytes;
}
function bytesToB64url(bytes){
  let str = "";
  bytes.forEach(b => str += String.fromCharCode(b));
  const b64 = btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return b64;
}
function randomBytes(n=32){
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function isAuthSupported(){
  return !!(window.PublicKeyCredential && navigator.credentials);
}

export function isLockEnabled(){
  return localStorage.getItem("lock_enabled") === "1";
}

export function clearLock(){
  localStorage.removeItem("lock_enabled");
  localStorage.removeItem("lock_cred_id");
}

export async function setupLock(){
  if(!isAuthSupported()) throw new Error("WebAuthn nicht unterstützt.");

  const challenge = randomBytes(32);
  const userId = randomBytes(16);
  const publicKey = {
    challenge,
    rp: { name: "Tosun Bau" },
    user: { id: userId, name: "tosun", displayName: "Tosun Bau" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
    },
    timeout: 60000,
    attestation: "none",
  };

  const cred = await navigator.credentials.create({ publicKey });
  if(!cred) throw new Error("Konnte Passkey nicht erstellen.");

  const id = bytesToB64url(new Uint8Array(cred.rawId));
  localStorage.setItem("lock_cred_id", id);
  localStorage.setItem("lock_enabled", "1");
}

export async function requireUnlock(){
  if(!isAuthSupported()) return true; // fallback: don't block
  if(!isLockEnabled()) return true;

  const id = localStorage.getItem("lock_cred_id");
  if(!id) return true;

  const challenge = randomBytes(32);
  const publicKey = {
    challenge,
    allowCredentials: [{ type: "public-key", id: b64urlToBytes(id) }],
    userVerification: "required",
    timeout: 60000,
  };

  const assertion = await navigator.credentials.get({ publicKey });
  return !!assertion;
}
