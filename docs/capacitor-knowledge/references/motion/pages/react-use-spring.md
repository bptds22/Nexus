# useSpring

A spring-powered motion value. Standalone, or attached to another motion value.

`useSpring` creates [a motion value](/docs/react-motion-value) that will animate to its latest target with a spring animation.

The target can either be set manually via `.set`, or automatically by passing in another motion value.

\>Live example[Open](https://examples.motion.dev/react/follow-pointer-with-spring)

## [Usage](#usage)

Import `useSpring` from Motion:

```
import { useSpring } from "motion/react"
```

### [Direct control](#direct-control)

`useSpring` can be created with a number, or a unit-type (`px`, `%` etc) string:

```
const x = useSpring(0)
const y = useSpring("100vh")
```

Now, whenever this motion value is updated via `set()`, the value will animate to its new target with the defined spring.

```
x.set(100)
y.set("50vh")
```

It's also possible to update this value immediately, without a spring, with [the](/docs/react-motion-value#jump) `jump()` [method](/docs/react-motion-value#jump).

```
x.jump(50)
y.jump("0vh")
```

### [Track another motion value](#track-another-motion-value)

Its also possible to automatically spring towards the latest value of another motion value:

```
const x = useMotionValue(0)
const y = useSpring(x)
```

This source motion value must also be a number, or unit-type string.

### [Transition](#transition)

The type of `spring` can be defined with the usual [spring transition option](/docs/react-transitions#spring).

```
useSpring(0, { stiffness: 300 })
```

## [Options](#options)

As well as transition options, `useSpring` also accepts the following options.

### [`skipInitialAnimation`](#skipinitialanimation)

**Default:** `false`

When using `useSpring` to track a value like `useScroll`, which may change on mount after a DOM measurement, you can jump to this value instantly by setting `skipInitialAnimation` to `true`.

```
const { scrollYProgress } = useScroll()
const smoothProgress = useSpring(scrollYProgress, {
  skipInitialAnimation: true,
})
```

[

card.css/motion-app

card.cssCard.tsx

```
1.card {2  transition: scale 200ms linear(3    0, 0.009, 0.036, 0.084, 0.157, 0.255, 0.378,4    0.522, 0.679, 0.832, 0.954, 1.029, 1.052, 1.038,5    1.011, 0.99, 0.984, 0.991, 1.001, 1.005, 16  );7}89.card:hover {10  scale: 1.2;11}
```

MOTION

EaseSpring

Duration0.3

Delay0

›Saved transitions12

### Visual editing for IDEs.

Edit and preview Motion and CSS transitions live in your code. Tune ease curves, springs, and durations without leaving your editor.

Part of Motion+. One-time fee, lifetime access.





](/plus)
