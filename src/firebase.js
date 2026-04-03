import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Replace with your Firebase project configuration
// 1. Go to Firebase Console -> Project Settings
// 2. Add a Web App
// 3. Copy the firebaseConfig object here

const firebaseConfig = {
  apiKey: "AIzaSyBlq8jChwIvfYI2_xQ4yFFfC2OgUCRGHLw",
  authDomain: "novastats-engine.firebaseapp.com",
  projectId: "novastats-engine",
  storageBucket: "novastats-engine.firebasestorage.app",
  messagingSenderId: "1058232817567",
  appId: "1:1058232817567:web:8d75abe9bd14990f664faa",
  measurementId: "G-52Z7XXK6XX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
