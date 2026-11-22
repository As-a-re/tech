# PAPA for Android and iPhone

The phone apps are built with **Capacitor 8**. Each app is a native shell that opens the hosted PAPA site in a secure app window and adds what a website can't do well: notifications through Firebase, a splash screen, the status bar, the Android back button, and links that open in the app.

Because the apps load the live site, **every website update reaches the apps immediately**. You only publish a store update when the native parts change (icon, permissions, plugins, Capacitor version).

| | Android | iPhone |
|---|---|---|
| Project folder | `android/` (Gradle) | `ios/App` (Xcode, Swift Package Manager) |
| App ID | `org.christanointed.papa` (`MOBILE_APP_ID`) | same |
| Minimum OS | Android 7.0 (API 24), targets API 36 | iOS 15 |
| Build on | Any computer with Android Studio (current version, JDK 21) | A Mac with Xcode 26 or newer |
| Store | Google Play Console (one-time US$25) | Apple Developer Program (US$99 a year) |

The app ID can't change after the first store release. Change it in `.env.local` (`MOBILE_APP_ID`) **and** in `android/app/build.gradle` (`applicationId`) and Xcode (Bundle Identifier) before you publish, if the church wants a different one.

## 1. Point the apps at the live site
```bash
# .env.local (or the environment)
MOBILE_APP_URL=https://papa.christanointedchurch.org
npm install
npm run mobile:sync          # copies settings and plugins into android/ and ios/
```
The site must be on HTTPS. If it can't be reached when the app opens, the app shows `mobile/www/index.html` (a "can't reach PAPA" page with a Try again button).

Also update the App Links host in `android/app/src/main/AndroidManifest.xml` (`android:host="papa.example.org"` → your domain).

## 2. Icons and splash screen
Sources are in `mobile/assets/` (`icon-only.png` 1024×1024, `icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png` 2732×2732). After changing them:
```bash
npm run mobile:assets
git checkout public/manifest.webmanifest   # the tool also rewrites the web manifest; keep ours
```

## 3. Notifications (Firebase Cloud Messaging)
PAPA sends app notifications through FCM for both platforms. Until this is done the apps work fully, just without notifications.

1. Create a Firebase project (console.firebase.google.com), e.g. "PAPA".
2. **Server key**: Project settings → Service accounts → *Generate new private key*. Put the JSON in the server setting `FCM_SERVICE_ACCOUNT` (raw JSON, or `base64 -w0 file.json`). Keep it secret (Secrets Manager).
3. **Android**: Add app → Android → package `org.christanointed.papa` → download `google-services.json` → place it at `android/app/google-services.json`. The Gradle build picks it up automatically.
4. **iPhone**:
   1. Apple Developer → Keys → create a key with **Apple Push Notifications service (APNs)**; download the `.p8`. In Firebase → Project settings → Cloud Messaging → Apple app configuration, upload it with the Key ID and Team ID.
   2. Firebase → Add app → iOS → bundle ID `org.christanointed.papa` → download `GoogleService-Info.plist` and drag it into Xcode under `App/App` (tick "Copy items" and the App target).
   3. Xcode → App target → *Signing & Capabilities*: add **Push Notifications** and **Background Modes → Remote notifications**.
   4. Xcode → File → *Add Package Dependencies…* → `https://github.com/firebase/firebase-ios-sdk` → add the **FirebaseMessaging** product to the App target.
   5. In `ios/App/App/AppDelegate.swift`, hand the FCM token (not the raw APNs token) to Capacitor:
      ```swift
      import UIKit
      import Capacitor
      import FirebaseCore
      import FirebaseMessaging

      // inside class AppDelegate
      func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
          FirebaseApp.configure()
          return true
      }

      func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
          Messaging.messaging().apnsToken = deviceToken
          Messaging.messaging().token { token, error in
              if let error = error {
                  NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
              } else if let token = token {
                  NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
              }
          }
      }

      func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
          NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
      }
      ```
5. Set `FCM_SERVICE_ACCOUNT` on the server **only after** the apps in members' hands include the Firebase files. The apps ask for notification permission only when the server reports app notifications are on (Admin → Dashboard shows it), because on Android, registering without `google-services.json` would crash the app.

How it works: after sign-in the app asks permission, gets an FCM token and saves it (`push_subscriptions.endpoint = "fcm:<token>"`). Every notification PAPA sends to a member goes to their browsers (web push) and phones (FCM). Tapping it opens the right screen. Signing out removes that phone's token. Tokens FCM reports as gone are deleted automatically. Android channels: `default` and `calls`.

## 4. Build and test
**Android**
```bash
npm run mobile:android        # syncs and opens Android Studio
```
Run on a device or emulator (▶). For a release: *Build → Generate Signed App Bundle* → create an upload keystore (store it and its passwords safely; losing it means contacting Google to reset) → `.aab`. Raise `versionCode` and `versionName` in `android/app/build.gradle` for each release.

**iPhone** (on a Mac)
```bash
npm run mobile:ios            # syncs and opens Xcode
```
Select the App target → Signing → the church's team. Run on a device. For a release: *Product → Archive* → *Distribute App* → App Store Connect. Raise Version and Build each release.

Test on real phones: sign in, post with a photo (camera permission), voice note (microphone), a call, a Paystack payment (opens inside the app and returns), notifications with the app closed, tapping a notification, sharing a PAPA link from WhatsApp (opens in the app on Android once App Links are verified).

## 5. Links that open in the app (Android App Links)
Create `public/.well-known/assetlinks.json` on the website with the release key's SHA-256 (Play Console → App integrity → App signing key certificate):
```json
[{ "relation": ["delegate_permission/common.handle_all_urls"],
   "target": { "namespace": "android_app", "package_name": "org.christanointed.papa",
     "sha256_cert_fingerprints": ["AA:BB:…"] } }]
```
For iPhone Universal Links, add an `apple-app-site-association` file the same way and the *Associated Domains* capability (`applinks:papa.christanointedchurch.org`) in Xcode.

## 6. Store listings
Both stores need: app name "PAPA", short and full description, screenshots (phone sizes), the 512×512 icon (Android) / 1024×1024 (Apple, from `mobile/assets/icon-only.png`), a **privacy policy URL** (`https://<domain>/privacy`), support URL (`/help`), and a contact email.

- **Google Play**: Data safety form (account info, phone number, photos/videos, messages, payment info handled by Paystack); content rating questionnaire; target audience (PAPA has PAPA Kids, but the app is for members of all ages under parent control; answer accordingly).
- **Apple**: App Privacy answers (same data as above); account deletion is in the app (Settings → Your data → Delete account), which Apple requires; for review, add a reviewer to the register, register the account yourself (the SMS code goes to a phone you hold), and give its username and password in *App Review Information* (leave 2-step sign-in off on it).
- Apple reviews apps that wrap websites closely. PAPA adds native notifications, camera, microphone and calls; describe these in the review notes.
- Payments: PAPA takes giving and physical goods through Paystack, which both stores allow outside their billing. Paid **digital** publications and study guides are the one area Apple and Google may require in-app purchase for. Options before submitting: hide buying digital items in the apps (members buy on the website), or add store billing. Decide this with the church; the code knows it's in the app (`window.Capacitor`).

## 7. Updating Capacitor later
```bash
npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest @capacitor/ios@latest
npx cap migrate     # follow its notes
npm run mobile:sync
```
