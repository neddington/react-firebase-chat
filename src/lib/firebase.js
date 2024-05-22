
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";



const firebaseConfig = {
  apiKey: import.meta.VITE_API_KEY,
  authDomain: "helldivers-chat.firebaseapp.com",
  projectId: "helldivers-chat",
  storageBucket: "helldivers-chat.appspot.com",
  messagingSenderId: "13473184189",
  appId: "1:13473184189:web:1ab6845029c3a9e2b67ad4",
  measurementId: "G-Q3CWZ11M91"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth()
export const db = getFirestore()
export const storage = getStorage()