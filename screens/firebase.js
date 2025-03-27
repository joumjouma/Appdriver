// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// 1) Import the Realtime Database functions
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAxeOgFmJruEmkvNdNemWzSSKGtteR5Tps",
  authDomain: "eco-share-92ef1.firebaseapp.com",
  projectId: "eco-share-92ef1",
  storageBucket: "eco-share-92ef1.appspot.com",
  messagingSenderId: "747419763478",
  appId: "1:747419763478:web:a12bb5f1d9e6fa082c8637",
  measurementId: "G-WX3CXQJGMP"
};

// 2) Initialize the Firebase app
const app = initializeApp(firebaseConfig);

// 3) Initialize all the services you need
export const db = getFirestore(app);    // Firestore
export const auth = getAuth(app);       // Authentication
export const rtdb = getDatabase(app);   // Realtime Database

export default app;
