import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBDPpP46ki8v6uGCAfjLYwD7psFD6c3OzY",
  authDomain: "studio-3702398351-4eb21.firebaseapp.com",
  projectId: "studio-3702398351-4eb21",
  storageBucket: "studio-3702398351-4eb21.firebasestorage.app",
  messagingSenderId: "245366645678",
  appId: "1:245366645678:web:40c334c3d4af5eeaf8de3f"
};

// Singleton pattern to avoid re-initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export { auth };
