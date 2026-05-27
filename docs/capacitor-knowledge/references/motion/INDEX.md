# Motion for React — index des pages

15 pages de doc, ordonnées par flux de lecture logique : démarrage → animations de base → mises en page → composants → hooks → intégrations → accessibilité.

## Démarrage

- **react-quick-start** : Install Motion for React and animate elements with springs.
- **react-animation** : An overview of animating React with motion components, variants, gestures, and keyframes.

## Gestes & interactions

- **react-gestures** : An overview of the gestures available in Motion for React.

## Scroll & layout

- **react-scroll-animations** : Scroll-triggered and scroll-linked effects in React: parallax, progress, and more.
- **react-layout-animations** : Smoothly animate layout changes and shared element transitions.

## Timing & présence

- **react-transitions** : Control timing with duration, easing, springs, delay, and stagger.
- **react-animate-presence** : Run exit animations on React components when they're removed from the page.

## Motion values & hooks

- **react-motion-value** : Composable, animatable values that update styles without re-rendering React.
- **react-use-scroll** : Track scroll progress as motion values, for parallax and progress bars.
- **react-use-transform** : Transform the output of one motion value into a new motion value.
- **react-use-spring** : A spring-powered motion value. Standalone, or attached to another motion value.
- **react-use-animate** : Manually start and control animations, scoped to the current React component.

## Composants & intégrations

- **react-motion-component** : Animate elements with a declarative API. Supports variants, gestures, and layout animations.
- **react-three-fiber** : Intégration avec React Three Fiber pour animer des scènes 3D. **Note : page marquée deprecated par Motion** — n'est plus maintenue.

## Accessibilité

- **react-accessibility** : Respect users' Reduced Motion preferences with the reducedMotion option and useReducedMotion hook.

## Notes

- **Nexus utilise `framer-motion@^12`**, pas le package `motion` (renommage récent). L'API est ~95 % identique entre les deux, mais quelques différences existent (notamment l'import path : `framer-motion` vs `motion/react`).
- **En cas d'incohérence** entre cette doc et le code Nexus, vérifier la doc legacy [framer.com/motion](https://www.framer.com/motion/) — elle correspond plus exactement à la version installée.
- **Pages manquantes** par rapport à la doc Motion complète : `react-svg-animation`, `react-drag`, `react-hover-animation`, `react-installation`, `react-reduce-bundle-size`, `react-upgrade-guide`, plus tous les composants annexes (`<LayoutGroup>`, `<LazyMotion>`, `<MotionConfig>`, `<Reorder>`, etc.) et hooks (`useTime`, `useVelocity`, `useMotionValueEvent`, `useMotionTemplate`, `useAnimationFrame`). À récupérer si besoin via le même flow curl + turndown + clean.js.
