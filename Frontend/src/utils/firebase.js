import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "aiinterview-8c22e.firebaseapp.com",
  projectId: "aiinterview-8c22e",
  storageBucket: "aiinterview-8c22e.firebasestorage.app",
  messagingSenderId: "809628734628",
  appId: "1:809628734628:web:77f9464094843e36a28231",
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export { auth, provider };