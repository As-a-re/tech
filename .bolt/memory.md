# Project memory

## Product intent & audience

- Convert an existing Next.js web project into installable mobile apps (Android + iOS) via Capacitor.
- Apps wrap a remotely hosted website in a native shell; site updates propagate without app-store releases.
- Audience: end users installing the app on physical Android/iOS devices.

## Brand personality & voice

- Insufficient signal to infer; current assistant tone is clear, step-by-step, and user-facing.

## Visual design & UX direction

- Native mobile shell uses Capacitor plugins for splash screen, status bar, app links, and hardware back button.
- No inferred design-system changes yet; UI remains the hosted Next.js site.

## Decisions, constraints & rationale

- Capacitor already scaffolded (Android + iOS folders); kept rather than switching to React Native/Expo.
- Architecture: native app loads a hosted URL (server URL config), not bundled web assets — chosen for instant updates.
- Next.js build OOMs in sandbox when spawning ~63 page-collection workers; must cap worker count to build successfully.
- Four Capacitor plugins enabled: app links, push notifications, splash screen, status bar.
- Push notifications optional; require a Firebase project if enabled.
- App server URL is currently a placeholder; must be set to the published site address before apps function.

## Open questions & assumptions

- Published website URL unknown; placeholder is in use.
- Whether push notifications/Firebase will be enabled is undecided.
- App branding (icons, splash assets, store listings) not yet discussed.
- Target domain convention (e.g., `papa.your-domain.org`) suggested but unconfirmed.