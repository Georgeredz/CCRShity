/* ═══════════════════════════════════════════════════════════════
   CCRS Firebase Configuration & Initialization
   Uses Firebase Compat SDK (CDN) for vanilla JS compatibility
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const firebaseConfig = {
    apiKey: "AIzaSyCLU2ofmfCto7NS4fFs6DL6POprbL9x03A",
    authDomain: "ccrshityyy.firebaseapp.com",
    projectId: "ccrshityyy",
    storageBucket: "ccrshityyy.firebasestorage.app",
    messagingSenderId: "627856852919",
    appId: "1:627856852919:web:9907614efa02ad862c4a32",
    measurementId: "G-3R9D7DYQX3"
  };

  // Initialize Firebase (compat SDK loaded via CDN in HTML)
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const db   = firebase.firestore();
  const auth = firebase.auth();

  // Firestore collection references
  const COLLECTIONS = {
    USERS:         'users',
    REPORTS:       'reports',
    NOTIFICATIONS: 'notifications',
    MERGE_LOG:     'merge_log',
  };

  /* ── Firestore Helpers ─────────────────────────────────────── */

  /**
   * Add a document with auto-generated ID
   */
  async function addDoc(collection, data) {
    try {
      const ref = await db.collection(collection).add({
        ...data,
        _createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        _updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return { id: ref.id, ...data };
    } catch (e) {
      console.error('[Firebase] addDoc failed:', collection, e);
      return null;
    }
  }

  /**
   * Set a document with a specific ID
   */
  async function setDoc(collection, docId, data, merge) {
    try {
      await db.collection(collection).doc(docId).set({
        ...data,
        _updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: merge !== false });
      return { id: docId, ...data };
    } catch (e) {
      console.error('[Firebase] setDoc failed:', collection, docId, e);
      return null;
    }
  }

  /**
   * Update specific fields on a document
   */
  async function updateDoc(collection, docId, patch) {
    try {
      await db.collection(collection).doc(docId).update({
        ...patch,
        _updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    } catch (e) {
      console.error('[Firebase] updateDoc failed:', collection, docId, e);
      return false;
    }
  }

  /**
   * Delete a document
   */
  async function deleteDoc(collection, docId) {
    try {
      await db.collection(collection).doc(docId).delete();
      return true;
    } catch (e) {
      console.error('[Firebase] deleteDoc failed:', collection, docId, e);
      return false;
    }
  }

  /**
   * Get a single document by ID
   */
  async function getDoc(collection, docId) {
    try {
      const snap = await db.collection(collection).doc(docId).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() };
    } catch (e) {
      console.error('[Firebase] getDoc failed:', collection, docId, e);
      return null;
    }
  }

  /**
   * Get all documents in a collection
   */
  async function getAllDocs(collection, orderByField, orderDir) {
    try {
      let query = db.collection(collection);
      if (orderByField) query = query.orderBy(orderByField, orderDir || 'desc');
      const snap = await query.get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('[Firebase] getAllDocs failed:', collection, e);
      return [];
    }
  }

  /**
   * Query documents with a where clause
   */
  async function queryDocs(collection, field, op, value) {
    try {
      const snap = await db.collection(collection).where(field, op, value).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('[Firebase] queryDocs failed:', collection, e);
      return [];
    }
  }

  /* ── Auth Helpers ──────────────────────────────────────────── */

  /**
   * Register a new user with email/password
   */
  async function registerUser(email, password) {
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      return cred.user;
    } catch (e) {
      console.error('[Firebase Auth] Register failed:', e.message);
      throw e;
    }
  }

  /**
   * Sign in with email/password
   */
  async function signIn(email, password) {
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      return cred.user;
    } catch (e) {
      console.error('[Firebase Auth] Sign in failed:', e.message);
      throw e;
    }
  }

  /**
   * Sign out
   */
  async function signOut() {
    try {
      await auth.signOut();
    } catch (e) {
      console.error('[Firebase Auth] Sign out failed:', e.message);
    }
  }

  /**
   * Get current Firebase auth user
   */
  function getCurrentAuthUser() {
    return auth.currentUser;
  }

  /**
   * Listen to auth state changes
   */
  function onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
  }

  /* ── Sync: Firestore <-> localStorage ──────────────────────── */

  /**
   * Sync a Firestore collection to localStorage for offline/instant reads
   */
  async function syncCollectionToLocal(collection, localKey) {
    try {
      const docs = await getAllDocs(collection, '_createdAt', 'desc');
      localStorage.setItem(localKey, JSON.stringify(docs));
      return docs;
    } catch (e) {
      console.error('[Firebase Sync] Failed to sync', collection, e);
      return JSON.parse(localStorage.getItem(localKey) || '[]');
    }
  }

  /**
   * Initial data sync on page load
   */
  async function initialSync() {
    console.log('[Firebase] Starting initial sync...');
    await Promise.all([
      syncCollectionToLocal(COLLECTIONS.REPORTS, 'ccrs_reports'),
      syncCollectionToLocal(COLLECTIONS.USERS, 'ccrs_users'),
      syncCollectionToLocal(COLLECTIONS.NOTIFICATIONS, 'ccrs_notifications'),
    ]);
    console.log('[Firebase] Initial sync complete.');
  }

  /* ── Real-time Listeners ───────────────────────────────────── */

  /**
   * Listen for real-time report changes
   */
  function listenToReports(callback) {
    return db.collection(COLLECTIONS.REPORTS)
      .orderBy('timestamp', 'desc')
      .onSnapshot(snap => {
        const reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        localStorage.setItem('ccrs_reports', JSON.stringify(reports));
        if (callback) callback(reports);
      }, err => {
        console.error('[Firebase] Reports listener error:', err);
      });
  }

  /**
   * Listen for real-time notification changes for a user
   */
  function listenToNotifications(userId, callback) {
    let query = db.collection(COLLECTIONS.NOTIFICATIONS)
      .orderBy('createdAt', 'desc')
      .limit(50);
    
    return query.onSnapshot(snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter client-side for user-specific + admin + all
      const filtered = all.filter(n => 
        n.userId === userId || n.userId === 'admin' || n.userId === 'all'
      );
      localStorage.setItem('ccrs_notifications', JSON.stringify(all));
      if (callback) callback(filtered);
    }, err => {
      console.error('[Firebase] Notifications listener error:', err);
    });
  }

  /* ── Public API ────────────────────────────────────────────── */
  global.FIREBASE_CONFIG = firebaseConfig;
  global.firebaseDB = db;
  global.firebaseAuth = auth;
  global.FB = {
    db, auth, COLLECTIONS,
    // CRUD
    addDoc, setDoc, updateDoc, deleteDoc, getDoc, getAllDocs, queryDocs,
    // Auth
    registerUser, signIn, signOut, getCurrentAuthUser, onAuthStateChanged,
    // Sync
    syncCollectionToLocal, initialSync,
    // Real-time
    listenToReports, listenToNotifications,
  };

})(window);
