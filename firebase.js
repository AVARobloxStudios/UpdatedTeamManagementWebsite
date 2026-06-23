import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAmD0fipQ0T9e-UVnpVCX0xxZnAJBvzBHY",
  authDomain: "ava-studios-management.firebaseapp.com",
  projectId: "ava-studios-management",
  storageBucket: "ava-studios-management.firebasestorage.app",
  messagingSenderId: "913367627445",
  appId: "1:913367627445:web:f822547a66c7f22bda70fc",
  measurementId: "G-QXD96DR1T4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function loadCloudState() {
  const ref = doc(db, "studio", "main");
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data();
  }

  return null;
}

export async function saveCloudState(data) {
  await setDoc(doc(db, "studio", "main"), data);
}
