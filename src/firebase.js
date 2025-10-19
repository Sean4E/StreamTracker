import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import { getDatabase, ref, set, get, onValue, off } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAG1mH5ugviJVQzXdjtFgaD-2QrVSD5TEU",
  authDomain: "streamtracker-ee5b3.firebaseapp.com",
  databaseURL: "https://streamtracker-ee5b3-default-rtdb.firebaseio.com",
  projectId: "streamtracker-ee5b3",
  storageBucket: "streamtracker-ee5b3.firebasestorage.app",
  messagingSenderId: "1095902165579",
  appId: "1:1095902165579:web:5cf4a9776bfb824491abce"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

// Authentication functions
export const signIn = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signUp = (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const signInWithGoogle = () => {
  return signInWithPopup(auth, googleProvider);
};

export const signOut = () => {
  return firebaseSignOut(auth);
};

// Database functions
export const writeUserData = (userId, path, data) => {
  const dbRef = ref(database, `users/${userId}/${path}`);
  return set(dbRef, data);
};

export const readUserData = (userId, path) => {
  const dbRef = ref(database, `users/${userId}/${path}`);
  return get(dbRef);
};

export const listenToUserData = (userId, path, callback) => {
  const dbRef = ref(database, `users/${userId}/${path}`);
  onValue(dbRef, (snapshot) => {
    callback(snapshot.val());
  });
  return () => off(dbRef);
};

export { auth, database };
