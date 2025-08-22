import { Actor, HttpAgent } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { idlFactory } from '../../../../merodocs_registry/src/declarations/backend/backend.did.js';

const network = import.meta.env.VITE_DFX_NETWORK || 'local';

const LOCAL_CANISTER_ID =
  import.meta.env.VITE_BACKEND_CANISTER_ID || 'uxrrr-q7777-77774-qaaaq-cai';
const MAINNET_CANISTER_ID = import.meta.env.VITE_MAINNET_BACKEND_CANISTER_ID;

const IDENTITY_PROVIDER =
  network === 'ic'
    ? 'https://identity.ic0.app'
    : 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943';

const HOST_URL = network === 'ic' ? 'https://ic0.app' : 'http://127.0.0.1:4943';

const backendCanisterId =
  network === 'ic' ? MAINNET_CANISTER_ID : LOCAL_CANISTER_ID;

export async function createBackendActor(identity?: any) {
  const agent = await HttpAgent.create({
    identity,
    host: HOST_URL,
  });

  if (network === 'local') {
    try {
      await agent.fetchRootKey();
    } catch (err) {
      console.warn(
        ' Unable to fetch root key. Check if local replica is running:',
        err,
      );
    }
  }

  if (!backendCanisterId) {
    throw new Error(`Missing canister ID for network: ${network}`);
  }

  return Actor.createActor(idlFactory, {
    agent,
    canisterId: backendCanisterId,
  });
}

let authClient: AuthClient | null = null;

export async function getAuthClient(): Promise<AuthClient> {
  if (!authClient) {
    authClient = await AuthClient.create();
  }
  return authClient;
}

export async function loginWithInternetIdentity(): Promise<boolean> {
  const client = await getAuthClient();

  return new Promise((resolve) => {
    client.login({
      identityProvider: IDENTITY_PROVIDER,
      onSuccess: () => {
        resolve(true);
      },
      onError: (error) => {
        console.error('❌ Internet Identity login failed:', error);
        resolve(false);
      },
    });
  });
}

export async function logout(): Promise<void> {
  const client = await getAuthClient();
  await client.logout();
}

export async function isAuthenticated(): Promise<boolean> {
  const client = await getAuthClient();
  return await client.isAuthenticated();
}

export async function getIdentity() {
  const client = await getAuthClient();
  return client.getIdentity();
}
