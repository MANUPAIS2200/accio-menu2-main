import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDzDRZTyCHeHVP8mixIKupc65DQpOMxsIM",
  authDomain: "lasreliquiasdelte-b4e1e.firebaseapp.com",
  projectId: "lasreliquiasdelte-b4e1e",
  storageBucket: "lasreliquiasdelte-b4e1e.firebasestorage.app",
  messagingSenderId: "833381657607",
  appId: "1:833381657607:web:6c46bf48dec42b8266cea2",
  measurementId: "G-VL1H5RFGHY"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);