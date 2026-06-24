# GreenLink+ Mobile Application 📱

A React Native mobile application built with **Expo**, featuring a gorgeous dark mode, real-time sensor updates via WebSockets, and data source toggle filtering (Urban Node, Rural Node, and API Data).

---

## ⚡ Quick Start (Run instantly in 2 minutes)

You don't need Java, Android Studio, or the Android SDK installed to run and test this app on your phone. We use **Expo Go**:

1. **Install Node.js dependencies**:
   Open a terminal in the `mobile` directory and run:
   ```bash
   npm install
   ```

2. **Configure your Backend Server IP**:
   Open [App.js](file:///d:/GreenLink/mobile/App.js#L10) and set `BACKEND_HOST` to your computer's local network IP address (e.g., `192.168.1.100:5000`):
   ```javascript
   const BACKEND_HOST = 'YOUR_COMPUTER_IP:5000';
   ```

3. **Start the Expo Development Server**:
   ```bash
   npx expo start
   ```

4. **Run on your Phone**:
   * Install the **Expo Go** app from the [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) or [Apple App Store](https://apps.apple.com/app/expo-go/id1241095587).
   * Open the app and scan the **QR Code** printed in your terminal.
   * The app will compile and load instantly!

---

## 📦 How to build the APK (using Cloud Build)

Since your local machine does not have Java or the Android SDK installed, you can build the APK in the cloud for free using **EAS Build** (Expo Application Services):

1. **Install the EAS CLI globally**:
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo** (create a free account if you don't have one):
   ```bash
   eas login
   ```

3. **Initialize the EAS project**:
   ```bash
   eas project:init
   ```

4. **Configure EAS Build for APK generation**:
   Create a file named `eas.json` in the `mobile` directory containing:
   ```json
   {
     "cli": {
       "version": ">= 10.0.0"
     },
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal"
       },
       "preview": {
         "android": {
           "buildType": "apk"
         }
       },
       "production": {}
     },
     "submit": {
       "production": {}
     }
   }
   ```

5. **Start the APK Build**:
   Run the build command:
   ```bash
   eas build -p android --profile preview
   ```
   * Expo will sign, compile, and package your app into an `.apk` file completely in the cloud.
   * Once finished, it will output a **download link** where you can download the APK file directly to your phone and install it!
