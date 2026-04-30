// ============================================================
//  Firebase Configuration — RailTwin-AI
//  Safe to import anywhere. Does NOT affect Base44 features.
// ============================================================

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDZ4NIXukJcfrSh2YMIQ5yGhs8nF-664RM",
  authDomain: "railtwin-ai.firebaseapp.com",
  projectId: "railtwin-ai",
  storageBucket: "railtwin-ai.firebasestorage.app",
  messagingSenderId: "915333547102",
  appId: "1:915333547102:web:38312ec194a33d7f4da0cf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore Database instance
export const db = getFirestore(app);

// Firebase Auth instance
export const auth = getAuth(app);

// ============================================================
//  Helper Functions — Firestore CRUD
// ============================================================

/**
 * Add a new document to a Firestore collection
 * @param {string} collectionName - e.g., "trains", "stations", "logs"
 * @param {object} data - data to store
 * @returns {string} - new document ID
 */
export const addDocument = async (collectionName, data) => {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Set a document with a custom ID
 * @param {string} collectionName
 * @param {string} docId - custom document ID
 * @param {object} data
 */
export const setDocument = async (collectionName, docId, data) => {
  await setDoc(doc(db, collectionName, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Update specific fields in an existing document
 * @param {string} collectionName
 * @param {string} docId
 * @param {object} data
 */
export const updateDocument = async (collectionName, docId, data) => {
  await updateDoc(doc(db, collectionName, docId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Delete a document from a collection
 * @param {string} collectionName
 * @param {string} docId
 */
export const deleteDocument = async (collectionName, docId) => {
  await deleteDoc(doc(db, collectionName, docId));
};

/**
 * Get all documents from a collection (one-time fetch)
 * @param {string} collectionName
 * @returns {Array} - array of documents with their IDs
 */
export const getDocuments = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Listen to real-time updates on a collection
 * @param {string} collectionName
 * @param {function} callback - called with array of docs on every change
 * @returns {function} - unsubscribe function
 */
export const listenToCollection = (collectionName, callback) => {
  const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(docs);
  });
};

export default app;
