/* ==========================================================
   EIGAVERSA — Firebase Firestore Integration Service
   Configured for project: eigaversa
   Handles solo + group registrations and admin access.
   ========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

var config = window.EIGAVERSA_FIREBASE_CONFIG || {};

function hasValidConfig() {
  return !!config.projectId && config.projectId.indexOf("PASTE") === -1;
}

var app = null;
var db = null;

if (hasValidConfig()) {
  app = initializeApp(config);
  db = getFirestore(app);
}

/* ---------- Registration ID generator ----------
   Sequential IDs like EIG-S-001 using a Firestore counter. */

function pad(num, width) {
  var s = String(num);
  while (s.length < width) s = '0' + s;
  return s;
}

var counterCache = { solo: 0, group: 0 };

async function nextRegistrationNumber(key) {
  if (counterCache[key] > 0) {
    counterCache[key]++;
    return counterCache[key];
  }
  var counterRef = doc(db, 'system_config', 'registration_counter');
  var counterSnap = await getDoc(counterRef);
  var current = counterSnap.exists() ? (counterSnap.data()[key] || 0) : 0;
  counterCache[key] = current + 1;
  return counterCache[key];
}

async function generateRegistrationId(prefix) {
  var key = prefix === 'EIG-G' ? 'group' : 'solo';
  var seq = await nextRegistrationNumber(key);
  return prefix + '-' + pad(seq, 3);
}

async function saveCounter(key, value) {
  var counterRef = doc(db, 'system_config', 'registration_counter');
  try {
    await setDoc(counterRef, { [key]: value }, { merge: true });
  } catch (e) {
    console.warn('Counter doc update failed (non-blocking):', e);
  }
}

/* ---------- Registrations ---------- */

/**
 * Save a solo registration.
 * @param {Object} data { name, phone, department, year, theme }
 * @returns {Promise<Object|null>} { id, registrationId } or null on failure
 */
async function saveSoloRegistration(data) {
  if (!db) return null;
  try {
    var registrationId = await generateRegistrationId('EIG-S');
    var docRef = await addDoc(collection(db, 'eigaversa_solo'), {
      registrationId: registrationId,
      type: 'solo',
      name: data.name || '',
      phone: data.phone || '',
      department: data.department || '',
      year: data.year || '',
      theme: data.theme || '',
      status: 'pending',
      registeredAt: serverTimestamp()
    });
    saveCounter('solo', counterCache.solo);
    console.log('Solo registration saved:', registrationId);
    return { id: docRef.id, registrationId: registrationId };
  } catch (e) {
    console.warn('Firestore saveSoloRegistration error:', e);
    return null;
  }
}

/**
 * Save a group registration.
 * @param {Object} data { teamName, department, theme, members: [{name, phone, year}] }
 * @returns {Promise<Object|null>} { id, registrationId } or null on failure
 */
async function saveGroupRegistration(data) {
  if (!db) return null;
  try {
    var registrationId = await generateRegistrationId('EIG-G');
    var docRef = await addDoc(collection(db, 'eigaversa_groups'), {
      registrationId: registrationId,
      type: 'group',
      teamName: data.teamName || '',
      department: data.department || '',
      theme: data.theme || '',
      members: data.members || [],
      memberCount: (data.members || []).length,
      status: 'pending',
      registeredAt: serverTimestamp()
    });
    console.log('Group registration saved:', registrationId);
    return { id: docRef.id, registrationId: registrationId };
  } catch (e) {
    console.warn('Firestore saveGroupRegistration error:', e);
    return null;
  }
}

/* ---------- Admin access ---------- */

/**
 * Read the admin access config document.
 * @returns {Promise<Object|null>} doc data (e.g. { accessCode }) or null
 */
async function getAdminConfig() {
  if (!db) return null;
  try {
    var snap = await getDoc(doc(db, 'system_config', 'eigaversa_admin'));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('Firestore getAdminConfig error:', e);
    return null;
  }
}

/**
 * Persist the admin access config document.
 * @param {string} accessCode
 * @returns {Promise<boolean>}
 */
async function setAdminConfig(accessCode) {
  if (!db) return false;
  try {
    await setDoc(doc(db, 'system_config', 'eigaversa_admin'), {
      accessCode: accessCode
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn('Firestore setAdminConfig error:', e);
    return false;
  }
}

/* ---------- Live subscriptions ---------- */

function subscribeToCollection(name, callback) {
  if (!db) return function () {};
  try {
    return onSnapshot(
      collection(db, name),
      function (snapshot) {
        var list = [];
        snapshot.forEach(function (docSnap) {
          var data = docSnap.data();
          var registeredAt = data.registeredAt && data.registeredAt.toDate
            ? data.registeredAt.toDate()
            : null;
          list.push({
            id: docSnap.id,
            registeredAtDate: registeredAt,
            ...data
          });
        });
        callback(list);
      },
      function (error) {
        console.warn('Firestore snapshot error (' + name + '):', error);
      }
    );
  } catch (e) {
    console.warn('Firestore subscription error (' + name + '):', e);
    return function () {};
  }
}

function subscribeToSolo(callback) {
  return subscribeToCollection('eigaversa_solo', callback);
}

function subscribeToGroups(callback) {
  return subscribeToCollection('eigaversa_groups', callback);
}

/* ---------- Registration management ---------- */

async function updateRegistrationStatus(collectionName, id, status) {
  if (!db || !id) return false;
  try {
    await updateDoc(doc(db, collectionName, id), { status: status });
    return true;
  } catch (e) {
    console.warn('Firestore updateRegistrationStatus error:', e);
    return false;
  }
}

async function deleteRegistration(collectionName, id) {
  if (!db || !id) return false;
  try {
    await deleteDoc(doc(db, collectionName, id));
    return true;
  } catch (e) {
    console.warn('Firestore deleteRegistration error:', e);
    return false;
  }
}

/* ---------- Expose globally for non-module scripts ---------- */

window.EigaversaFirebase = {
  isConfigured: function () {
    return !!db;
  },
  saveSoloRegistration: saveSoloRegistration,
  saveGroupRegistration: saveGroupRegistration,
  getAdminConfig: getAdminConfig,
  setAdminConfig: setAdminConfig,
  subscribeToSolo: subscribeToSolo,
  subscribeToGroups: subscribeToGroups,
  updateRegistrationStatus: updateRegistrationStatus,
  deleteRegistration: deleteRegistration
};
