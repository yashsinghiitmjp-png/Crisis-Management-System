import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

const getAuthErrorMessage = (error) => {
  if (!error || !error.code) return error?.message || 'An unexpected error occurred.';

  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'This email is already being used. Please sign in instead.';
    case 'auth/invalid-email':
      return 'That email address doesn\'t look right.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Wrong email or password.';
    case 'auth/network-request-failed':
      return 'Connection error. Please check your internet.';
    case 'auth/operation-not-allowed':
      return 'The Email/Password provider is disabled in your Firebase console. Go to Authentication > Sign-in method to enable it.';
    default:
      return error.message.replace('Firebase: ', '');
  }
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = ref(db, `users/${user.uid}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
          const profileData = snapshot.val();
          setCurrentUser({ ...user, ...profileData });
        } else {
          // If profile doesn't exist yet, we check if we already set it manually (e.g. from signUp)
          setCurrentUser(prev => (prev && prev.uid === user.uid && prev.role) ? prev : user);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signUp = async ({ name, email, password }) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save additional profile data in Realtime Database
      const userData = {
        uid: user.uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'guest',
        createdAt: new Date().toISOString()
      };

      console.log('Attempting to save user data to Firebase DB:', userData);
      await set(ref(db, `users/${user.uid}`), userData);
      console.log('User data successfully saved to Firebase DB.');

      // Sign out immediately so user can log in manually
      await firebaseSignOut(auth);
      setCurrentUser(null);

      return { ok: true, user: userData };
    } catch (error) {
      console.error('Firebase SignUp Error observed:', error);
      return { ok: false, message: getAuthErrorMessage(error) };
    }
  };

  const signIn = async ({ email, password }) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Fetch profile
      const userRef = ref(db, `users/${user.uid}`);
      const snapshot = await get(userRef);
      const profile = snapshot.exists() ? snapshot.val() : {};

      const fullUser = { ...user, ...profile };
      setCurrentUser(fullUser);

      return { ok: true, user: fullUser };
    } catch (error) {
      console.error('Firebase SignIn Error observed:', error);
      return { ok: false, message: getAuthErrorMessage(error) };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null);
    } catch (error) {
      console.error('Firebase SignOut Error:', error);
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { ok: true, message: 'Reset link sent! Please check your email.' };
    } catch (error) {
      console.error('Firebase Reset Password Error observed:', error);
      return { ok: false, message: getAuthErrorMessage(error) };
    }
  };

  const value = useMemo(
    () => ({ currentUser, loading, signUp, signIn, signOut, resetPassword }),
    [currentUser, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
