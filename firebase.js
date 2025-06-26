import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDGCdOlHIdZEhG3Xw73imaKHY5xeZvyVKM",
  authDomain: "rcv-demo.firebaseapp.com",
  projectId: "rcv-demo",
  storageBucket: "rcv-demo.firebasestorage.app",
  messagingSenderId: "965335562896",
  appId: "1:965335562896:web:b54581cb685558ed23f615"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc, firebaseConfig, app };
