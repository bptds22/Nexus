# Motion component

Animate elements with a declarative API. Supports variants, gestures, and layout animations.

Most [React animations](/docs/react-animation) in Motion are powered by the `<motion />` component.

There's a `motion` component for every HTML and SVG element, for instance `motion.div`, `motion.circle` etc. It extends standard React components with animation props that run at up to 120fps - without triggering React re-renders.

## [Usage](#usage)

Import `motion` from Motion:

```
// React
import { motion } from "motion/react"

// React Server Components (Next.js etc)
import * as motion from "motion/react-client"
```

You can use a `motion` component exactly as you would any normal HTML/SVG component:

```
<motion.div className="box" />
```

But you also gain access to powerful animation APIs like the `animate`, `layout`, `whileInView` props.

```
<motion.div
  className="box"
  // Animate when this value changes:
  animate={{ scale: 2 }}
  // Fade in when the element enters the viewport:
  whileInView={{ opacity: 1 }}
  // Animate the component when its layout changes:
  layout
  // Style now supports indepedent transforms:
  style={{ x: 100 }}
/>
```

### [Performance](#performance)

`motion` components bypass React's render cycle entirely. Animated values update on every frame via the browser's native animation pipeline, so even complex animations with dozens of animated properties won't cause React re-renders or style/layout thrashing.

Using [motion values](/docs/react-motion-value) instead of React state to update `style` will also avoid re-renders.

```
const x = useMotionValue(0)

useEffect(() => {
  // Won't trigger a re-render!
  const timeout = setTimeout(() => x.set(100), 1000)

  return () => clearTimeout(timeout)
}, [])

return <motion.div style={{ x }} />
```

### [Server-side rendering](#server-side-rendering)

`motion` components are fully compatible with server-side rendering, meaning the initial state of the component will be reflected in the server-generated output.

```
// Server will output `translateX(100px)`
<motion.div initial={false} animate={{ x: 100 }} />
```

\> Motion+ Components

### Unlock premium Motion APIs.

`Carousel`, `Ticker`, `AnimateNumber`, `ScrambleText`, `splitText`, `Cursor`. All built on the `<motion>` component for minimal added bundlesize.

[Get Motion+](/plus)

Part of [Motion+](/plus). One-time fee, lifetime access.

### [Custom components](#custom-components)

You can add motion capabilities to any React component with `motion.create()`. The returned component accepts all standard motion props (`animate`, `whileHover`, `drag`, `layout`, etc.) alongside the original component's props.

```
const MotionComponent = motion.create(Component)
```

Your component **must** pass a ref to the component you want to animate.

**React 18:** Use `forwardRef` to wrap the component and pass `ref` to the element you want to animate:

```
const Component = React.forwardRef((props, ref) => {
  return <div ref={ref} />
})
```

**React 19:** React 19 can pass `ref` via `props`:

```
const Component = (props) => {
  return <div ref={props.ref} />
})
```

It's also possible to pass strings to `motion.create`, which will create custom DOM elements.

```
// Will render <custom-element /> into HTML
const MotionComponent = motion.create('custom-element')
```

By default, all `motion` props (like `animate` etc) are filtered out of the `props` forwarded to the provided component. By providing a `forwardMotionProps` config, the provided component will receive these props.

```
motion.create(Component, { forwardMotionProps: true })
```

Building with AI? The [Motion AI Kit MCP](./ai-kit-context) gives your AI editor access to the latest docs and source code of 370+ examples.

Make sure not to call `motion.create()` within a React render function! This will make a new component every render, breaking your animations.

## [Props](#props)

`motion` components accept the following props.

### [Animation](#animation)

Motion provides declarative animation props like `animate` and `exit`. [Learn more about React animations in Motion](/docs/react-animation).

#### [`initial`](#initial)

The initial visual state of the `motion` component.

This can be set as an animation target:

```
<motion.section initial={{ opacity: 0, x: 0 }} />
```

Variants:

```
<motion.li initial="visible" />
```

```
<motion.div initial={["visible", "active"]} />
```

Or set as `false` to disable the enter animation and initially render as the values found in `animate`.

```
<motion.div initial={false} animate={{ opacity: 0 }} />
```

#### [`animate`](#animate)

A target to animate to on enter, and on update.

Can be set as an animation target:

```
<motion.div
  initial={{ boxShadow: "0px 0px #000" }}
  animate={{ boxShadow: "10px 10px #000" }}
/>
```

Or variants:

```
<motion.li animate="visible" />
```

```
<motion.div initial="hidden" animate={["visible", "active"]} />
```

#### [`exit`](#exit)

A target to animate to when a component is removed from the tree. Can be set either as an animation target, or variant.

Owing to React limitations, the component being removed must be a direct child of `[AnimatePresence](./react-animate-presence)` to enable this animation.

#### [`transition`](#transition)

The default [transition](/docs/react-transitions) for this component to use when an animation prop (`animate`, `whileHover` etc) has no `transition` defined.

```
<motion.div transition={{ type: "spring" }} animate={{ scale: 1.2 }} />
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

#### [`variants`](#variants)

The [variants](/docs/react-animation#variants) for this component.

```
const variants = {
  active: {
      backgroundColor: "#f00"
  },
  inactive: {
    backgroundColor: "#fff",
    transition: { duration: 2 }
  }
}

return (
  <motion.div
    variants={variants}
    animate={isActive ? "active" : "inactive"}
  />
)
```

#### [`style`](#style)

The normal React DOM `style` prop, with added support for [motion values](/docs/react-motion-value) and independent transforms.

```
const x = useMotionValue(30)

return <motion.div style={{ x, rotate: 90, originX: 0.5 }} />
```

#### [`onUpdate`](#onupdate)

Callback triggered every frame any value on the `motion` component updates. It's provided a single argument with the latest values.

```
<motion.article
  animate={{ opacity: 1 }}
  onUpdate={latest => console.log(latest.opacity)}
/>
```

#### [`onAnimationStart`](#onanimationstart)

Callback triggered when any animation (except layout animations, see `onLayoutAnimationStart`) starts.

It's provided a single argument, with the target or variant name of the started animation.

```
<motion.circle
  animate={{ r: 10 }}
  onAnimationStart={latest => console.log(latest.r)}
/>
```

#### [`onAnimationComplete`](#onanimationcomplete)

Callback triggered when any animation (except layout animations, see `onLayoutAnimationComplete`) completes.

It's provided a single argument, with the target or variant name of the completed animation.

```
<motion.circle
  animate={{ r: 10 }}
  onAnimationComplete={latest => console.log(latest.r)}
/>
```

### [Hover](#hover)

#### [`whileHover`](#whilehover)

Animation state, or variant label, to perform a [hover animation](/docs/react-hover-animation) to while the hover gesture is active.

```
// As target
<motion.button whileHover={{ scale: 1.2 }} />
```

```
// As variants
<motion.div whileHover="hovered" />
```

#### [`onHoverStart`](#onhoverstart)

Callback function that fires when a pointer starts hovering over the component. Provided the triggering `PointerEvent`.

```
<motion.div onHoverStart={(event) => console.log(event)} />
```

#### [`onHoverEnd`](#onhoverend)

Callback function that fires when a pointer stops hovering over the component. Provided the triggering `PointerEvent`.

```
<motion.div onHoverEnd={(event) => console.log(event)} />
```

#### [Tap](#tap)

#### [`whileTap`](#whiletap)

Animation state, or variant label, to perform a [press animation](/docs/react-gestures) to while the hover gesture is active.

```
// As target
<motion.button whileTap={{ scale: 0.9 }} />
```

```
// As variants
<motion.div whileTap="tapped" />
```

#### [`onTapStart`](#ontapstart)

Callback function that fires when a pointer starts pressing the component. Provided the triggering `PointerEvent`.

```
<motion.div onTapStart={(event) => console.log(event)} />
```

#### [`onTap`](#ontap)

Callback function that fires when a pointer stops pressing the component and the pointer was released **inside** the component. Provided the triggering `PointerEvent`.

```
<motion.div onTap={(event) => console.log(event)} />
```

#### [`onTapCancel`](#ontapcancel)

Callback function that fires when a pointer stops pressing the component and the pointer was released **outside** the component. Provided the triggering `PointerEvent`.

```
<motion.div onTapCancel={(event) => console.log(event)} />
```

### [Focus](#focus)

#### [`whileFocus`](#whilefocus)

Animation state, or variant label, to animate to while the focus gesture is active.

```
// As target
<motion.button whileFocus={{ outline: "dashed #000" }} />
```

```
// As variants
<motion.div whileFocus="focused" />
```

### [Pan](#pan)

#### [`onPan`](#onpan)

Callback function that fires when the pan gesture is recognised on this element.

```
function onPan(event, info) {
  console.log(info.point.x, info.point.y)
}

<motion.div onPan={onPan} />
```

Pan and drag events are provided the origin `PointerEvent` as well as an object `info` that contains `x` and `y` point values for the following:

-   `point`: Relative to the device or page.
    
-   `delta`: Distance since the last event.
    
-   `offset`: Distance from the original event.
    
-   `velocity`: Current velocity of the pointer.
    

For pan gestures to work correctly with touch input, the element needs touch scrolling to be disabled on either x/y or both axis with the `[touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)` CSS rule.

#### [`onPanStart`](#onpanstart)

Callback function that fires when a pan gesture starts. Provided the triggering `PointerEvent` and `info`.

```
<motion.div onPanStart={(event, info) => console.log(info.delta.x)} />
```

#### [`onPanEnd`](#onpanend)

Callback function that fires when a pan gesture ends. Provided the triggering `PointerEvent` and `info`.

```
<motion.div onPanEnd={(event, info) => console.log(info.delta.x)} />
```

### [Drag](#drag)

#### [`drag`](#drag-1)

**Default:** `false`

Enable dragging for this element. Set `true` to drag in both directions. Set `"x"` or `"y"` to only drag in a specific direction.

```
<motion.div drag />
```

#### [`whileDrag`](#whiledrag)

Animation state, or variant label, to perform a [drag animation](/docs/react-drag) to while the hover gesture is active.

```
// As target
<motion.div drag whileDrag={{ scale: 0.9 }} />
```

```
// As variants
<motion.div drag whileDrag="dragging" />
```

#### [`dragConstraints`](#dragconstraints)

Applies constraints on the draggable area.

Set as an object of optional `top`, `left`, `right`, and `bottom` values, measured in pixels:

```
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: 300 }}
/>
```

Or as a `ref` to another element to use its bounding box as the draggable constraints:

```
const MyComponent = () => {
  const constraintsRef = useRef(null)

  return (
     <motion.div ref={constraintsRef}>
         <motion.div drag dragConstraints={constraintsRef} />
     </motion.div>
  )
}
```

#### [`dragSnapToOrigin`](#dragsnaptoorigin)

**Default:** `false`

If `true`, the draggable element will animate back to its center/origin when released.

```
<motion.div drag dragSnapToOrigin />
```

#### [`dragElastic`](#dragelastic)

**Default:** `0.5`

The degree of movement allowed outside constraints. `0` = no movement, `1` = full movement.

Set to `0.5` by default. Can also be set as `false` to disable movement.

By passing an object of `top`/`right`/`bottom`/`left`, individual values can be set per constraint. Any missing values will be set to `0`.

```
<motion.div
  drag
  dragConstraints={{ left: 0, right: 300 }}
  dragElastic={0.2}
/>
```

#### [`dragMomentum`](#dragmomentum)

**Default:** `true`

Apply momentum from the pan gesture to the component when dragging finishes. Set to `true` by default.

```
<motion.div
  drag
  dragConstraints={{ left: 0, right: 300 }}
  dragMomentum={false}
/>
```

#### [`dragTransition`](#dragtransition)

Allows you to change dragging momentum transition. When releasing a draggable element, an animation with type `"inertia"` starts. The animation is based on your dragging velocity. This property allows you to customize it.

```
<motion.div
  drag
  dragTransition={{ bounceStiffness: 600, bounceDamping: 10 }}
/>
```

#### [`dragDirectionLock`](#dragdirectionlock)

**Default:** `false`

Locks drag direction into the soonest detected direction. For example, if the component is moved more on the `x` axis than `y` axis before the drag gesture kicks in, it will **only** drag on the `x` axis for the remainder of the gesture.

```
<motion.div drag dragDirectionLock />
```

#### [`dragPropagation`](#dragpropagation)

**Default:** `false`

Allows drag gesture propagation to child components.

```
<motion.div drag="x" dragPropagation />
```

#### [`dragControls`](#dragcontrols)

Usually, dragging is initiated by pressing down on a component and moving it. For some use-cases, for instance clicking at an arbitrary point on a video scrubber, we might want to initiate dragging from a different component than the draggable one.

By creating a `dragControls` using the `useDragControls` [hook](/docs/react-use-drag-controls), we can pass this into the draggable component's `dragControls` prop. It exposes a `start` method that can start dragging from pointer events on other components.

```
const dragControls = useDragControls()

function startDrag(event) {
  dragControls.start(event, { snapToCursor: true })
}

return (
  <>
    <div onPointerDown={startDrag} />
    <motion.div drag="x" dragControls={dragControls} />
  </>
)
```

Given that by setting `dragControls` you are taking control of initiating the drag gesture, it is possible to disable the draggable element as the initiator by setting `dragListener={false}`.

#### [`dragListener`](#draglistener)

Determines whether to trigger the drag gesture from event listeners. If passing `dragControls`, setting this to `false` will ensure dragging can only be initiated by the controls, rather than a `pointerdown` event on the draggable element.

\>Motion+ · Carousel

### Drag, swipe, scroll.

The Motion+ `Carousel` component creates pixel-perfect, infinite carousels with drag-to-page navigation. Snap, `wheelSwipe`, page redistribution and more.

[Get Motion+ Carousel](/docs/react-carousel)

Part of [Motion+](/plus). One-time fee, lifetime access.

snap = page

-   01
    
-   02
    
-   03
    
-   04
    
-   05
    

←axis=x / loop=true→

#### [`onDrag`](#ondrag)

Callback function that fires when the drag gesture is recognised on this element.

```
function onDrag(event, info) {
  console.log(info.point.x, info.point.y)
}

<motion.div drag onDrag={onDrag} />
```

Pan and drag events are provided the origin `PointerEvent` as well as an object `info` that contains `x` and `y` point values for the following:

-   `point`: Relative to the device or page.
    
-   `delta`: Distance since the last event.
    
-   `offset`: Distance from the original event.
    
-   `velocity`: Current velocity of the pointer.
    

#### [`onDragStart`](#ondragstart)

Callback function that fires when a drag gesture starts. Provided the triggering `PointerEvent` and `info`.

```
<motion.div drag onDragStart={(event, info) => console.log(info.delta.x)} />
```

#### [`onDragEnd`](#ondragend)

Callback function that fires when a drag gesture ends. Provided the triggering `PointerEvent` and `info`.

```
<motion.div drag onDragEnd={(event, info) => console.log(info.delta.x)} />
```

#### [`onDirectionLock`](#ondirectionlock)

Callback function that fires a drag direction is determined.

```
<motion.div
  drag
  dragDirectionLock
  onDirectionLock={axis => console.log(axis)}
/>
```

### [Gestures](#gestures)

#### [`propagate`](#propagate)

Prevent children gestures from propagating to their parents. Currently only supports `tap`.

```
<motion.div whileTap={{ scale: 2 }}>
  // Pressing this button won't fire the above scale animation
  <motion.button
    whileTap={{ opacity: 0.8 }}
    propagate={{ tap: false }}
  />
</motion.div>
```

### [Viewport](#viewport)

Learn more about [scroll-triggered animations](/docs/react-scroll-animations) in React.

#### [`whileInView`](#whileinview)

Target or variants to label to while the element is in view.

```
// As target
<motion.div whileInView={{ opacity: 1 }} />
```

```
// As variants
<motion.div whileInView="visible" />
```

#### [`viewport`](#viewport-1)

Options to define how the element is tracked within the viewport.

```
<motion.section
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
/>
```

Available options:

-   `once`: If `true`, once element enters the viewport it won't detect subsequent leave/enter events.
    
-   `root`: The `ref` of an ancestor scrollable element to detect intersections with (instead of `window`).
    
-   `margin`: A margin to add to the viewport to change the detection area. Defaults to `"0px"`. Use multiple values to adjust top/right/bottom/left, e.g. `"0px -20px 0px 100px"`.
    
-   `amount`: The amount of an element that should enter the viewport to be considered "entered". Either `"some"`, `"all"` or a number between `0` and `1`. Defaults to `"some"`.
    

#### [`onViewportEnter`](#onviewportenter)

Callback function that fires when an element enters the viewport. Provided the `IntersectionObserverEntry` with details of the intersection event.

```
<motion.div onViewportEnter={(entry) => console.log(entry.isIntersecting)} />
```

#### [`onViewportLeave`](#onviewportleave)

Callback function that fires when an element enters the viewport. Provided the `IntersectionObserverEntry` with details of the intersection event.

```
<motion.div onViewportLeave={(entry) => console.log(entry.intersectionRect)} />
```

### [Layout](#layout)

Learn more about [layout animations](/docs/react-layout-animations) in React.

#### [`layout`](#layout-1)

**Default:** `false`

If `true`, this component will perform [layout animations](/docs/react-layout-animations).

```
<motion.div layout />
```

If set to `"position"` or `"size"`, only its position or size will animate, respectively.

```
<motion.img layout="position" />
```

#### [`layoutId`](#layoutid)

If set, this component will animate changes to its layout. Additionally, when a new element enters the DOM and an element already exists with a matching `layoutId`, it will animate out from the previous element's size/position.

```
{items.map(item => (
   <motion.li layout>
      {item.name}
      {item.isSelected && <motion.div layoutId="underline" />}
   </motion.li>
))}
```

If the previous component remains in the tree, the two elements will crossfade.

#### [`layoutDependency`](#layoutdependency)

By default, layout changes are detected every render. To reduce measurements and thus improve performance, you can pass a `layoutDependency` prop. Measurements will only occur when this value changes.

```
<motion.nav layout layoutDependency={isOpen} />
```

### [`layoutAnchor`](#layoutanchor)

**Default:** `{ x: 0, y: 0 }`

Motion's layout animations look correct when a parent and child animate with different transitions, because it resolves the child's position relative to its parent.

By default, it does this using the top/left of the parent. `layoutAnchor` can customise this point, where `x` and `y` can be set as independent progress values between `0` and `1`.

-   `0` = top/left
    
-   `0.5` = center
    
-   `1` = bottom/right
    

Setting to `false` disables relative projection for this element, and elements will animate relative to their page-relative change.

```
<motion.ul layout>
  <motion.li
    layout
    layoutAnchor={{ x: 1, y: 0 }} 
    transition={{ delay: 1 }}
  />
</motion.ul>
```

\>Live example[Open](https://examples.motion.dev/react/layout-anchor)

#### [`layoutScroll`](#layoutscroll)

For layout animations to work correctly within scrollable elements, their scroll offset needs measuring. For performance reasons, Framer Motion doesn't measure the scroll offset of every ancestor. Add the `layoutScroll` prop to elements that should be measured.

```
<motion.div layoutScroll style={{ overflow: "scroll" }}>
  <motion.div layout />
</motion.div>
```

#### [`layoutRoot`](#layoutroot)

For layout animations to work correctly within `position: fixed` elements, we need to account for page scroll. Add `layoutRoot` to mark an element as `position: fixed`.

```
<motion.div layoutRoot style={{ position: "fixed" }}>
  <motion.div layout />
</motion.div>
```

#### [`onLayoutAnimationStart`](#onlayoutanimationstart)

A callback to run when a layout animation starts.

#### [`onLayoutAnimationComplete`](#onlayoutanimationcomplete)

A callback to run when a layout animation completes.

### [Advanced](#advanced)

#### [`inherit`](#inherit)

Set to `false` to prevent a component inheriting or propagating changes in a parent variant.

#### [`custom`](#custom)

Custom data to pass through to dynamic variants.

```
const variants = {
  visible: (custom) => ({
    opacity: 1,
    transition: { delay: custom * 0.2 }
  })
}

return (
  <motion.ul animate="visible">
    <motion.li custom={0} variants={variants} />
    <motion.li custom={1} variants={variants} />
    <motion.li custom={2} variants={variants} />
  </motion.ul>
)
```

#### [`transformTemplate`](#transformtemplate)

By default, transforms are applied in order of `translate`, `scale`, `rotate` and `skew`.

To change this, `transformTemplate` can be set as a function that accepts the latest transforms and the generated transform string and returns a new transform string.

```
// Use the latest transform values
<motion.div
  style={{ x: 0, rotate: 180 }}
  transformTemplate={
    ({ x, rotate }) => `rotate(${rotate}deg) translateX(${x}px)`
  }
/>
```

```
// Or the generated transform string
<motion.div
  style={{ x: 0, rotate: 180 }}
  transformTemplate={
    (latest, generated) => `translate(-50%, -50%) ${generated}`
  }
/>
```

## [FAQs](#faqs)

What is the `<motion />` component?

`<motion />` is a drop-in replacement for HTML and SVG elements that adds animation capabilities. Instead of writing `<div>`, you write `<motion.div>`. The element behaves identically but can now accept animation props like `animate`, `whileHover`, and `transition`.

How do I animate an element in React with Motion?

Pass an `animate` prop to any `<motion />` component with the values you want to animate to. For example, `<motion.div animate={{ opacity: 1 }} />` will animate opacity from its current value to 1. Motion automatically detects changes and animates between them.

Does `<motion />` affect performance?

`<motion />` is optimised to animate `transform` and `opacity` on the compositor thread wherever possible, avoiding layout and paint. For best performance, prefer animating `transform` and `opacity` over properties like `width` or `top`.

Can I use `<motion />` with custom components?

Yes. Use `motion.create()` to wrap any component that forwards its ref and accepts a `style` prop. For example: `const MotionButton = motion.create(Button)`.
