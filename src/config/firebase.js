import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Exporta guard para identificar o ambiente do protótipo
export const isPrototypeEnvironment = () => {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/prototipo');
};

// Initialize Firebase variables
let app = null;
let analytics = null;
let auth = null;
let googleProvider = null;
let db = null;
let messaging = null;
let isInitializing = false;

export function initFirebase() {
  // Impede expressamente a inicialização do Firebase no ambiente do protótipo
  if (isPrototypeEnvironment()) {
    return null;
  }

  if (app) {
    return { app, analytics, auth, googleProvider, db, messaging };
  }

  if (isInitializing) {
    return { app, analytics, auth, googleProvider, db, messaging };
  }

  isInitializing = true;

  try {
    if (!firebaseConfig.apiKey) {
      throw new Error("Firebase API Key is missing from environment variables.");
    }

    console.log("🔥 Initializing Firebase with config:", {
      projectId: firebaseConfig.projectId,
      apiKey: firebaseConfig.apiKey ? "PRESENT" : "MISSING"
    });

    app = initializeApp(firebaseConfig);

    try {
      analytics = getAnalytics(app);
    } catch (e) {
      console.warn("Analytics initialization failed (ignoring):", e);
    }

    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
    db = getFirestore(app);

    // Ativa persistência offline (multi-tab)
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Múltiplas abas abertas, a persistência só pode ser ativada em uma por vez
        console.warn('Persistência Firestore: Falha (múltiplas abas)');
      } else if (err.code === 'unimplemented') {
        // O navegador não suporta todas as funcionalidades necessárias
        console.warn('Persistência Firestore: Não suportada pelo navegador');
      }
    });

    try {
      messaging = getMessaging(app);
      console.log("✅ FCM Messaging initialized");
    } catch (e) {
      console.warn("FCM Messaging initialization failed (likely not supported):", e);
    }

    console.log("✅ Firebase initialized successfully");
  } catch (error) {
    console.error("❌ Firebase initialization failed CRITICALLY:", error);
    googleProvider = new GoogleAuthProvider();
  } finally {
    isInitializing = false;
  }

  return { app, analytics, auth, googleProvider, db, messaging };
}

// Inicializa automaticamente no carregamento do módulo SOMENTE se NÃO estiver no protótipo
if (!isPrototypeEnvironment()) {
  initFirebase();
}

export { app, analytics, auth, googleProvider, db, messaging };

