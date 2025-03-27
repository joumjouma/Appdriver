import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const redirectUri = makeRedirectUri({
  scheme: 'com.googleusercontent.apps.1007561335979-uiduf2a3h59mjcdassp5hl3rgljr5tes'
});

export const configureGoogleSignIn = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '747419763478-ddgbe8t8vclif3b7iafpbtm286c9aolo.apps.googleusercontent.com', // Replace with your web client ID from Firebase console
    iosClientId: '1007561335979-ppmh7dnmssp44fnndtvm92ikaj5nm6vt.apps.googleusercontent.com', // Optional: Add if you have iOS client ID
    androidClientId: '1007561335979-uiduf2a3h59mjcdassp5hl3rgljr5tes.apps.googleusercontent.com', // Optional: Add if you have Android client ID
    redirectUri,
    scopes: ['profile', 'email'],
  });

  return { request, response, promptAsync };
}; 