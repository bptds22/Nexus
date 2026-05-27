# Gesture animation

An overview of the gestures available in Motion for React.

Motion extends React's basic set of event listeners with a simple yet powerful set of UI gestures.

The `motion` component currently has support for [**hover**](/docs/react-hover-animation), **tap**, **pan**, **drag, focus** and [**inView**](/docs/react-scroll-animations).

Each gesture has both a set of event listeners and a `while-` animation prop.

## [Animation props](#animation-props)

`motion` components provide multiple gesture animation props: `whileHover`, `whileTap`, `whileFocus`, `whileDrag` and `whileInView`. These can define animation targets to temporarily animate to while a gesture is active.

```
<motion.button
  whileHover={{
    scale: 1.2,
    transition: { duration: 1 },
  }}
  whileTap={{ scale: 0.9 }}
/>
```

All props can be set either as a target of values to animate to, or the name of any variants defined via the `variants` prop. Variants will flow down through children as normal.

```
<motion.button
  whileTap="tap"
  whileHover="hover"
  variants={buttonVariants}
>
  <svg>
    <motion.path variants={iconVariants} />
  </svg>
</motion.button>
```

## [Gestures](#gestures)

\>Live example[Open](https://examples.motion.dev/react/gestures)

### [Hover](#hover)

The hover gesture detects when a pointer hovers over or leaves a component. [Learn more about hover animations.](/docs/react-hover-animation)

```
<motion.a
  whileHover={{ scale: 1.2 }}
  onHoverStart={event => {}}
  onHoverEnd={event => {}}
/>
```

### [Tap](#tap)

The tap gesture detects when the **primary pointer** (like a left click or first touch point) presses down and releases on the same component.

```
<motion.button whileTap={{ scale: 0.9, rotate: 3 }} />
```

It will fire a `tap` event when the tap or click ends on the same component it started on, and a `tapCancel` event if the tap or click ends outside the component.

If the tappable component is a child of a draggable component, it'll automatically cancel the tap gesture if the pointer moves further than 3 pixels during the gesture.

#### [Accessibility](#accessibility)

Elements with tap events are keyboard-accessible.

Any element with a tap prop will be able to receive focus and `Enter` can be used to trigger tap events on focused elements.

-   Pressing `Enter` down will trigger `onTapStart` and `whileTap`
    
-   Releasing `Enter` will trigger `onTap`
    
-   If the element loses focus before `Enter` is released, `onTapCancel` will fire.
    

\>Motion+ · Cursor

### Gestures, with sauce.

The Motion+ `Cursor` component creates punchy cursor replacement and cursor follow gestures. Target-snapping, morphing, multi-cursor and more.

[Get Motion+ Cursor](/docs/cursor)

Part of [Motion+](/plus). One-time fee, lifetime access.

IDLE

++++01++++02++++03

### [Pan](#pan)

The pan gesture recognises when a pointer presses down on a component and moves further than 3 pixels. The pan gesture is ended when the pointer is released.

```
<motion.div onPan={(e, pointInfo) => {}} />
```

Pan doesn't currently have an associated `while-` prop.

For pan gestures to work correctly with touch input, the element needs touch scrolling to be disabled on either x/y or both axis with the `[touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)` CSS rule.

### [Drag](#drag)

The drag gesture applies pointer movement to the x and/or y axis of the component.

```
<motion.div drag whileDrag={{ scale: 1.2, backgroundColor: "#f00" }} />
```

\>Live example[Open](https://examples.motion.dev/react/drag)

[Learn more about drag animations](/docs/react-drag).

### [Focus](#focus)

The focus gesture detects when a component gains or loses focus by the same rules as the [CSS :focus-visible selector](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible).

Typically, this is when an `input` receives focus by any means, and when other elements receive focus by accessible means (like via keyboard navigation).

```
<motion.a whileFocus={{ scale: 1.2 }} href="#" />
```

## [Event propagation](#event-propagation)

### [React components](#react-components)

React components can prevent pointer events bubbling up to their `motion` component parents using the `-Capture` props.

For instance, a child can stop parent drag and tap gestures, and their related `while-` animations, from firing by passing `e.stopPropagation()` to `onPointerDownCapture`.

```
<motion.div whileTap={{ scale: 2 }}>
  <button onPointerDownCapture={e => e.stopPropagation()} />
</motion.div>
```

### [`motion` components](#motion-components)

Because `motion` gesture handlers are deferred, `e.stopPropagation()` can't be fired in time for event propagation to be blocked from a propagating from inside a (for instance) `onTapStart` handler. Instead, use the `propagate` prop to prevent specific gestures from propagating.

Currently, `propagate` only supports `tap`.

```
<motion.div whileTap={{ scale: 2 }}>
  <motion.button
    whileTap={{ opacity: 0.8 }}
    propagate={{ tap: false }}
  />
</motion.div>
```

## [Note: SVG filters](#note-svg-filters)

Gestures aren't recognised on SVG `filter` components, as these elements don't have a physical presence and therefore don't receive events.

You can instead add `while-` props and event handlers to a parent and use variants to animate these elements.

```
const MyComponent = () => {
  return (
    <motion.svg whileHover="hover">
      <filter id="blur">
        <motion.feGaussianBlur
          stdDeviation={0}
          variants={{ hover: { stdDeviation: 2 } }}
        />
      </filter>
    </motion.svg>
  )
}
```
