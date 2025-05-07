/**
 * Theme constants for the Caval Driver app
 * This file contains color schemes, spacing, typography, and other design tokens
 */

export const THEME = {
  // Primary colors
  colors: {
    primary: '#4A90E2', // Main brand color
    secondary: '#50E3C2', // Secondary brand color
    accent: '#F5A623', // Accent color for highlights
    
    // Text colors
    textPrimary: '#333333',
    textSecondary: '#666666',
    textLight: '#999999',
    textWhite: '#FFFFFF',
    
    // Background colors
    background: '#FFFFFF',
    backgroundLight: '#F8F8F8',
    backgroundDark: '#E5E5E5',
    
    // Status colors
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FFC107',
    info: '#2196F3',
    
    // Border colors
    border: '#E0E0E0',
    borderDark: '#BDBDBD',
    
    // Message colors
    messageSent: '#E3F2FD',
    messageReceived: '#F5F5F5',
    
    // Other UI elements
    shadow: 'rgba(0, 0, 0, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  
  // Typography
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      bold: 'System',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 30,
    },
    lineHeight: {
      xs: 16,
      sm: 20,
      md: 24,
      lg: 28,
      xl: 32,
      xxl: 36,
      xxxl: 40,
    },
  },
  
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  // Border radius
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    round: 9999,
  },
  
  // Shadows
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 8,
    },
  },
  
  // Animation durations
  animation: {
    fast: 200,
    normal: 300,
    slow: 500,
  },
}; 