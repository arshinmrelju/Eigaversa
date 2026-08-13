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
  query,
  where,
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

/* ---------- Registration ID generator (gap-filling recycler) ----------
   Sequential IDs like EIG-S-001. Deleted IDs are recycled into a pool
   and reused by the next newcomer before incrementing the counter. */

function pad(num, width) {
  var s = String(num);
  while (s.length < width) s = '0' + s;
  return s;
}

async function generateRegistrationId(prefix) {
  if (!db) return null;
  var key = prefix === 'EIG-G' ? 'group' : 'solo';
  var counterRef = doc(db, 'system_config', 'registration_counter');
  var counterSnap = await getDoc(counterRef);
  var counterData = counterSnap.exists() ? counterSnap.data() : {};

  // Check recycled pool first — reuse lowest freed number
  var recycledKey = key + '_recycled';
  var recycled = Array.isArray(counterData[recycledKey]) ? counterData[recycledKey].slice() : [];

  var seq;
  if (recycled.length > 0) {
    recycled.sort(function (a, b) { return a - b; });
    seq = recycled.shift(); // take the lowest available number
    await setDoc(counterRef, { [recycledKey]: recycled }, { merge: true });
  } else {
    var current = counterData[key] || 0;
    seq = current + 1;
    await setDoc(counterRef, { [key]: seq }, { merge: true });
  }

  return prefix + '-' + pad(seq, 3);
}

async function recycleRegistrationId(registrationId) {
  if (!db || !registrationId) return;
  try {
    var parts = registrationId.split('-');
    // Expect EIG-S-001 → parts = ['EIG', 'S', '001']
    if (parts.length !== 3) return;
    var typeChar = parts[1].toUpperCase();
    var num = parseInt(parts[2], 10);
    if (isNaN(num) || num < 1) return;

    var key = typeChar === 'G' ? 'group' : 'solo';
    var recycledKey = key + '_recycled';
    var counterRef = doc(db, 'system_config', 'registration_counter');
    var counterSnap = await getDoc(counterRef);
    var counterData = counterSnap.exists() ? counterSnap.data() : {};

    var recycled = Array.isArray(counterData[recycledKey]) ? counterData[recycledKey].slice() : [];
    if (recycled.indexOf(num) === -1) {
      recycled.push(num);
    }
    await setDoc(counterRef, { [recycledKey]: recycled }, { merge: true });
    console.log('Recycled ID number', num, 'into pool for', key);
  } catch (e) {
    console.warn('recycleRegistrationId error (non-blocking):', e);
  }
}

/* ---------- Registrations ---------- */

/**
 * Save a solo registration.
 * @param {Object} data { name, phone, department, year, rollNo, theme }
 * @returns {Promise<Object|null>} { id, registrationId } or null on failure
 */
async function saveSoloRegistration(data) {
  if (!db) return null;
  try {
    var registrationId = await generateRegistrationId('EIG-S');
    if (!registrationId) throw new Error('ID generation failed');
    var docRef = await addDoc(collection(db, 'eigaversa_solo'), {
      registrationId: registrationId,
      type: 'solo',
      name: data.name || '',
      phone: data.phone || '',
      department: data.department || '',
      year: data.year || '',
      rollNo: data.rollNo || '',
      theme: data.theme || '',
      status: 'pending',
      registeredAt: serverTimestamp()
    });
    console.log('Solo registration saved:', registrationId);
    return { id: docRef.id, registrationId: registrationId };
  } catch (e) {
    console.warn('Firestore saveSoloRegistration error:', e);
    return null;
  }
}

/**
 * Save a group registration.
 * @param {Object} data { teamName, department, phone, theme, members: [{name, rollNo, year}] }
 * @returns {Promise<Object|null>} { id, registrationId } or null on failure
 */
async function saveGroupRegistration(data) {
  if (!db) return null;
  try {
    var registrationId = await generateRegistrationId('EIG-G');
    if (!registrationId) throw new Error('ID generation failed');
    var docRef = await addDoc(collection(db, 'eigaversa_groups'), {
      registrationId: registrationId,
      type: 'group',
      teamName: data.teamName || '',
      department: data.department || '',
      phone: data.phone || '',
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

/**
 * Read the registration open/close state.
 * @returns {Promise<boolean|null>} true = open, false = closed, null = unknown
 */
async function getRegistrationOpenState() {
  if (!db) return null;
  try {
    var snap = await getDoc(doc(db, 'system_config', 'eigaversa_admin'));
    if (!snap.exists()) return true; // assume open by default
    // Only treat as closed when explicitly stored as false.
    return snap.data().registrationsOpen !== false;
  } catch (e) {
    console.warn('Firestore getRegistrationOpenState error:', e);
    return null;
  }
}

/**
 * Set the registration open/close state.
 * @param {boolean} open true to open, false to close
 * @returns {Promise<boolean>}
 */
async function setRegistrationOpenState(open) {
  if (!db) return false;
  try {
    await setDoc(doc(db, 'system_config', 'eigaversa_admin'), {
      registrationsOpen: !!open
    }, { merge: true });
    return true;
  } catch (e) {
    console.warn('Firestore setRegistrationOpenState error:', e);
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

async function deleteRegistration(collectionName, id, registrationId) {
  if (!db || !id) return false;
  try {
    await deleteDoc(doc(db, collectionName, id));
    // Recycle the freed ID number back into the pool for reuse
    if (registrationId) {
      await recycleRegistrationId(registrationId);
    }
    return true;
  } catch (e) {
    console.warn('Firestore deleteRegistration error:', e);
    return false;
  }
}

function toRecord(docSnap) {
  var data = docSnap.data();
  var registeredAt = data.registeredAt && data.registeredAt.toDate ? data.registeredAt.toDate() : null;
  return { id: docSnap.id, registeredAtDate: registeredAt, ...data };
}

async function getRegistrationById(queryInput) {
  if (!db || !queryInput) return null;
  try {
    var input = String(queryInput).trim();
    var regId = input.toUpperCase();
    var isId = /^EIG-(S|G)-\d+$/i.test(input);

    var results = [];
    var soloColl = collection(db, 'eigaversa_solo');
    var groupColl = collection(db, 'eigaversa_groups');

    if (isId) {
      var snaps = await Promise.all([
        getDocs(query(soloColl, where('registrationId', '==', regId))),
        getDocs(query(groupColl, where('registrationId', '==', regId)))
      ]);
      snaps.forEach(function (snap) {
        snap.forEach(function (docSnap) { results.push(toRecord(docSnap)); });
      });
    } else {
      var phoneVariants = [input, input.replace(/[\s-]/g, '')];
      var seen = {};
      for (var i = 0; i < phoneVariants.length; i++) {
        var variant = phoneVariants[i];
        if (!variant) continue;
        var snapsByPhone = await Promise.all([
          getDocs(query(soloColl, where('phone', '==', variant))),
          getDocs(query(groupColl, where('phone', '==', variant)))
        ]);
        snapsByPhone.forEach(function (snap) {
          snap.forEach(function (docSnap) {
            if (!seen[docSnap.id]) {
              seen[docSnap.id] = true;
              results.push(toRecord(docSnap));
            }
          });
        });
      }
    }

    if (results.length === 0) return null;
    results.sort(function (a, b) {
      return (b.registeredAtDate || 0) - (a.registeredAtDate || 0);
    });
    return results[0];
  } catch (e) {
    console.warn('Firestore getRegistrationById error:', e);
    return null;
  }
}

/* ---------- Expose globally for non-module scripts ---------- */

window.EigaversaFirebase = {
  isConfigured: function () {
    return !!db;
  },
  saveSoloRegistration: saveSoloRegistration,
  saveGroupRegistration: saveGroupRegistration,
  getRegistrationById: getRegistrationById,
  getAdminConfig: getAdminConfig,
  setAdminConfig: setAdminConfig,
  getRegistrationOpenState: getRegistrationOpenState,
  setRegistrationOpenState: setRegistrationOpenState,
  subscribeToSolo: subscribeToSolo,
  subscribeToGroups: subscribeToGroups,
  updateRegistrationStatus: updateRegistrationStatus,
  deleteRegistration: deleteRegistration
};
