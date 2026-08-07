// Firebase Initialization & Authentication Manager
const firebaseConfig = {
  apiKey: "AIzaSyCf7x9LUkGDdUgZ0g786urC6QhBv_4fBmw",
  authDomain: "crosisio.firebaseapp.com",
  projectId: "crosisio",
  storageBucket: "crosisio.firebasestorage.app",
  messagingSenderId: "876878735748",
  appId: "1:876878735748:web:b13ecf93ee72f080e355d1",
  measurementId: "G-ZZR10NYDZY"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
}

class AuthManager {
  constructor() {
    this.auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
    this.db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
    this.currentUser = null;
    this.onUserChangedCallbacks = [];

    if (this.auth) {
      this.auth.onAuthStateChanged(user => {
        this.currentUser = user;
        if (user) {
          console.log("Logged in user:", user.displayName || "Guest (" + user.uid.substring(0, 5) + ")");
          this.syncUserData(user);
        } else {
          console.log("No active user session.");
        }
        this.onUserChangedCallbacks.forEach(cb => cb(user));
      });
    }
  }

  onUserChanged(callback) {
    this.onUserChangedCallbacks.push(callback);
  }

  // Google Login (Popup with fallback)
  async loginWithGoogle() {
    if (!this.auth) return null;
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result = await this.auth.signInWithPopup(provider);
      return result.user;
    } catch (error) {
      console.warn("Google Sign-In Popup failed, trying redirect...", error);
      try {
        await this.auth.signInWithRedirect(provider);
      } catch (err) {
        console.error("Google Sign-In error:", err);
        alert("구글 로그인 처리 중 오류가 발생했습니다: " + err.message);
      }
    }
  }

  // Guest Login (Anonymous Authentication)
  async loginAsGuest() {
    if (!this.auth) return null;
    try {
      const result = await this.auth.signInAnonymously();
      return result.user;
    } catch (error) {
      console.error("Guest Sign-In error:", error);
      alert("게스트 로그인 오류: " + error.message);
    }
  }

  // Sign Out
  async logout() {
    if (!this.auth) return;
    try {
      await this.auth.signOut();
    } catch (error) {
      console.error("Sign-Out error:", error);
    }
  }

  // Sync User Stats with Firestore
  async syncUserData(user) {
    if (!this.db || !user) return;
    try {
      const userRef = this.db.collection('users').doc(user.uid);
      const doc = await userRef.get();

      if (doc.exists) {
        const data = doc.data();
        if (data.bestKills) {
          const localKills = localStorage.getItem('get_nav_best_kills') || 0;
          const bestKills = Math.max(localKills, data.bestKills);
          localStorage.setItem('get_nav_best_kills', bestKills);
        }
        if (data.bestTime) {
          const localTime = localStorage.getItem('get_nav_best_time') || 0;
          const bestTime = Math.max(localTime, data.bestTime);
          localStorage.setItem('get_nav_best_time', bestTime);
        }
      } else {
        // Create initial user doc
        await userRef.set({
          displayName: user.displayName || "게스트 용사",
          photoURL: user.photoURL || "",
          isAnonymous: user.isAnonymous,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          bestKills: Number(localStorage.getItem('get_nav_best_kills') || 0),
          bestTime: Number(localStorage.getItem('get_nav_best_time') || 0)
        });
      }
    } catch (err) {
      console.warn("Firestore sync error:", err);
    }
  }

  // Save High Score to Firebase
  async saveScore(kills, time) {
    if (!this.db || !this.currentUser) return;
    try {
      const userRef = this.db.collection('users').doc(this.currentUser.uid);
      await userRef.set({
        bestKills: kills,
        bestTime: time,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.warn("Score save error:", err);
    }
  }
}

const authManager = new AuthManager();
