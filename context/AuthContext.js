import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    // Check if user is stored in AsyncStorage
    const checkStoredUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('auth');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error reading stored auth:', error);
      }
    };

    checkStoredUser();

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await AsyncStorage.setItem('auth', JSON.stringify(currentUser));
      } else {
        setUser(null);
        await AsyncStorage.removeItem('auth');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (credentials) => {
    setLoading(true);
    try {
      // Implement your login logic here
      // For example:
      // const response = await api.login(credentials);
      // setUser(response.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await auth.signOut();
      setUser(null);
      await AsyncStorage.removeItem('auth');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 