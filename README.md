# Pokedex App

A React Native mobile application built with **Expo** and secured with **Keycloak** authentication. The app features a fully custom native login/signup flow, secure token storage, and an industry-standard session management system that keeps users logged in for extended periods without interruption.

---

## What This App Does

This is a Pokedex-themed mobile app where users authenticate via a phone number and password. Once logged in, the app maintains their session silently in the background — refreshing tokens automatically so the user never gets unexpectedly logged out, even after reopening the app days or months later.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile Framework | React Native + Expo (file-based routing via Expo Router) |
| Language | TypeScript |
| Authentication Server | Keycloak (self-hosted) |
| Backend | Express.js (Node.js) on port 3002 |
| HTTP Client | Axios |
| Token Storage | `expo-secure-store` (iOS Keychain / Android Keystore) |

---

## Project Structure

```
pokedex/
├── app/
│   ├── _layout.tsx        # Root layout — handles auth-based navigation guards
│   ├── index.tsx          # Home screen (shown after login)
│   ├── login.tsx          # Login screen (phone + password)
│   ├── signup.tsx         # Signup screen
│   └── verify.tsx         # OTP verification screen (first-time signup)
├── api/
│   └── client.ts          # Axios client with request/response interceptors
├── context/
│   └── AuthContext.tsx    # Global auth state, session management, auto-refresh
└── utils/
    └── tokenStorage.ts    # Secure token read/write using expo-secure-store
```

---

## Authentication Flow

### Signup (First-Time Users)
1. User enters phone number and password on the **Signup** screen.
2. An SMS OTP is sent to their phone.
3. User verifies OTP on the **Verify** screen.
4. Account is created in Keycloak via the Express backend.

### Login (Returning Users)
1. User enters phone number and password on the **Login** screen.
2. The Express backend authenticates with Keycloak using the Resource Owner Password Credentials flow.
3. Keycloak returns an **access token** and a **refresh token**.
4. Both tokens are saved securely using `expo-secure-store`.
5. User is redirected to the home screen.

### Navigation Guard
`app/_layout.tsx` checks auth state on every navigation event:
- If **not logged in** → redirect to `/login`
- If **logged in** and on an auth screen → redirect to `/`

---

## Session Management (Industry Practice)

### Secure Token Storage
Tokens are stored using `expo-secure-store`, which uses:
- **iOS Keychain** on iPhone/iPad
- **Android Keystore** on Android devices

This is the same storage used by banking apps — tokens are never stored in plain text.

```ts
// utils/tokenStorage.ts
await SecureStore.setItemAsync('pokedex_access_token', accessToken);
await SecureStore.setItemAsync('pokedex_refresh_token', refreshToken);
```

### Auto-Refresh System
`context/AuthContext.tsx` implements a proactive token refresh system:

- **On app start:** Loads stored tokens from SecureStore and restores the session instantly.
- **Interval refresh:** Every 30 seconds, the access token is silently refreshed in the background using the refresh token.
- **Foreground refresh:** When the app returns from the background (e.g. user switches back), the token is refreshed immediately.
- **Background pause:** The refresh interval is paused when the app goes to the background to save battery.
- **Stable interval (key fix):** A `tokenRef` (React ref) is used to read the latest token inside the interval without listing `token` as a useEffect dependency. This prevents the interval from being torn down and recreated on every refresh — cleanup only happens on logout or full app close.

### Silent 401 Recovery
`api/client.ts` uses Axios interceptors to handle expired tokens automatically:
- Every outgoing request has the `Authorization: Bearer <token>` header injected.
- If any API call returns a `401 Unauthorized`, the interceptor silently calls `/auth/refresh`, gets a new token, and retries the original request — without the user ever seeing an error.

---

## How to Run

### Prerequisites
- Node.js installed
- Expo Go app on your phone, or an iOS/Android simulator
- Keycloak server running
- Express backend running on port 3002

### Setup

```bash
# Install dependencies
npm install

# Start the Expo dev server
npx expo start
```

Scan the QR code with Expo Go or press `i` for iOS simulator / `a` for Android emulator.

### Backend URL
The backend IP is hardcoded in `api/client.ts` and `context/AuthContext.tsx`:
```ts
const BACKEND_URL = `http://192.168.29.199:3002`;
```
Update this to your machine's local IP if you change networks.

---

## Key Changes Made

| Change | Description |
|---|---|
| Replaced Expo boilerplate | Removed default tabs, components, hooks. Built a clean auth-first app. |
| Custom native auth flow | Replaced Keycloak's web browser login with a fully native phone + password + OTP flow. |
| Secure token storage | Switched from `AsyncStorage` (plain text) to `expo-secure-store` (encrypted). |
| Auto-refresh with `tokenRef` | Fixed a React `useEffect` re-render loop that was causing cleanup every 30 seconds by using a ref instead of a state dependency. |
| AppState-aware refreshing | App refreshes token immediately on foreground and pauses the interval in background. |
| Axios 401 interceptor | Silent token refresh and request retry on any API call that returns Unauthorized. |
| Auth-based navigation guard | Users are automatically redirected to login or home based on their auth state. |
