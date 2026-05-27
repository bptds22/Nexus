# React scroll animation

Scroll-triggered and scroll-linked effects in React: parallax, progress, and more.

Learn how to create scroll animations in React with Motion. This guide covers **scroll-linked** animations, **scroll-triggered** animations, **parallax**, **horizontal scrolling**, and more. All with live examples and copy-paste code.

## [Types of scroll animation](#types-of-scroll-animation)

There are two fundamental types of scroll animations:

-   **Scroll-triggered:** An animation is triggered when an element enters or leaves the viewport. Common for fade-in effects and lazy-loading.
    
-   **Scroll-linked:** Animation values are linked directly to scroll position. Used for parallax, progress bars, and interactive storytelling.
    

Motion supports both types of scroll animations with simple, performant APIs.

## [Performance](#performance)

Motion is the only animation library that runs scroll-linked animations on the browser's native `ScrollTimeline` where possible, for fully hardware-accelerated animations. Scroll-triggered animations use a pooled `IntersectionObserver` for minimal overhead.

1.  S
2.  A
3.  B
4.  C
5.  D
6.  F

\> Audit your site

### Find & fix animation performance issues on your site.

Audit any website's animation performance. Reports use a simple grade system with detailed breakdown, with fixes as copy-paste prompts for your AI agent.

Run free audit

Free audit powered by [MotionScore](https://score.motion.dev).

## [Scroll-triggered animations](#scroll-triggered-animations)

Scroll-triggered animations fire when an element enters or leaves the viewport, or scrolls to a specific point in the viewport.

Motion provides [the](/docs/react-motion-component#whileinview) `whileInView` [prop](/docs/react-motion-component#whileinview) to set an animation target.

```
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
/>
```

\>Live example[Open](https://examples.motion.dev/react/scroll-triggered)

### [Animate once on scroll](#animate-once-on-scroll)

By default, elements will animate between `initial`/`animate`, and `whileInView`, as the element enters and leaves the viewport. Via [the](/docs/react-motion-component#viewport-1) `viewport` [options](/docs/react-motion-component#viewport-1), set `once: true` so an animation only plays the first time an element scrolls into view.

```
<motion.div
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true }}
/>
```

### [Changing scroll container](#changing-scroll-container)

By default, animations will trigger based on the `window` viewport. To set a custom scroll container element, pass the `ref` of another scrollable element to the `root` option:

```
function Component() {
  const scrollRef = useRef(null)
  
  return (
    <div ref={scrollRef} style={{ overflow: "scroll" }}>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ root: scrollRef }}
      />
    </div>
  )
}
```

For more configuration options, checkout [the](/docs/react-motion-component#viewport-1) `motion` [component](/docs/react-motion-component#viewport-1) API reference.

### [Setting state](#setting-state)

It's also possible to set React state when any element (not just a `motion` component) enters and leaves the viewport with the `useInView` [hook](/docs/react-use-in-view).

```
function Component() {
  const ref = useRef(null)
  const isInView = useInView(ref)

  return (
    <div ref={ref}>
      {isInView ? "Hello!" : "Bye..."}
    </div>
  )
}
```

## [Scroll-linked animations](#scroll-linked-animations)

Scroll-linked animations connect CSS styles directly to scroll position. In Motion, this is done with the `useScroll` [hook](/docs/react-use-scroll).

`useScroll` returns four motion values:

-   `scrollX`/`scrollY`: Scroll position in pixels
    
-   `scrollXProgress`/`scrollYProgress`: Scroll progress from `0` to `1`
    

### [Scroll progress bar](#scroll-progress-bar)

Create a reading progress indicator by linking `scrollYProgress` to `scaleX`:

```
const { scrollYProgress } = useScroll();

return (
  <motion.div style={{ scaleX: scrollYProgress, originX: 0 }} />  
)
```

\>Live example[Open](https://examples.motion.dev/react/scroll-linked)

Build this faster with AI. [Motion AI Kit](./ai-kit-context) gives your LLM full access to the latest Motion docs and the source code of all 370+ official examples.

### [Detect scroll direction](#detect-scroll-direction)

It's possible to track scroll direction by using `useMotionValueEvent` on `scrollY`. With this, it's possible to animate items to different states, like a menu that only shows as we scroll down.

```
const { scrollY } = useScroll()
const [scrollDirection, setScrollDirection] = useState("down")

useMotionValueEvent(scrollY, "change", (current) => {
  const diff = current - scrollY.getPrevious()
  setScrollDirection(diff > 0 ? "down" : "up")
})
```

\>Live example[Open](https://examples.motion.dev/react/scroll-hide-header)

### [Smoothing scroll values](#smoothing-scroll-values)

Smooth changes to a scroll value by passing one through `useSpring`:

```
const { scrollYProgress } = useScroll();
const scaleX = useSpring(scrollYProgress, {
  stiffness: 100,
  damping: 30,
  restDelta: 0.001
})

return <motion.div style={{ scaleX }} />
```

### [Transform scroll position to any value](#transform-scroll-position-to-any-value)

Use the `useTransform` hook to map scroll progress to colours, positions, or any other CSS value:

```
const filter = useTransform(
  scrollYProgress,
  [0, 1],
  ["blur(0px)", "blur(10px)"]
)

return <motion.div style={{ filter }} />
```

\>Live example[Open](https://examples.motion.dev/react/scroll-zoom-hero)

### [Track element scroll position through viewport](#track-element-scroll-position-through-viewport)

By default, `useScroll` progress values will represent the overall viewport scroll (or element scroll).

By passing an element via the `target` option, `scrollYProgress` will return its progress through the visible space.

```
const ref = useRef(null)
const { scrollYProgress } = useScroll({
  target: ref,
  /*
    When the top of the target meets the bottom of the container
    to when the bottom of the target meets the top of the container
  */
  offset: ["start end", "end start"]
})
```

\>Live example[Open](https://examples.motion.dev/react/scroll-track-element-in-viewport)

### [Parallax scrolling](#parallax-scrolling)

Parallax creates the illusion of depth by moving elements at different speeds. Background layers should move slower than foreground layers:

```
const { foregroundY, backgroundY } = useTransform(
  scrollY,
  [0, 1],
  {
    foregroundY: [0, 2], // move 2px for every 1 scroll px
    backgroundY: [0, 0.5] // move 0.5px for every 1 scroll px
  },
  { clamp: false }
)
```

\>Live example[Open](https://examples.motion.dev/react/parallax)

### [Scroll image reveal effect](#scroll-image-reveal-effect)

By linking `clipPath` to `scrollYProgress`, you can have an image "reveal" itself as it scrolls into view.

```
const ref = useRef(null)
const { scrollYProgress } = useScroll({
  target: ref,
  offset: ["start end", "center center"]
})

const clipPath = useTransform(
  scrollYProgress,
  [0, 1],
  ["inset(0% 50% 0% 50%)", "inset(0% 0% 0% 0%)"]
)

return (
  <motion.div ref={ref} style={{ clipPath }}>
    <img src="/photo.jpg" alt="Revealed image" />
  </motion.div>
)
```

\>Live example[Open](https://examples.motion.dev/react/scroll-image-reveal)

### [Horizontal scroll section](#horizontal-scroll-section)

You can make a horizontally-scrolling section by combining `useScroll`, a tall container section, and a wide `position: sticky` container.

```
const containerRef = useRef(null)
const { scrollYProgress } = useScroll({
  target: containerRef,
  offset: ["start start", "end end"]
})

const x = useTransform(scrollYProgress, [0, 1], ["0%", "-75%"])

return (
  <div ref={containerRef} style={{ height: "300vh" }}>
    <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
      <motion.div style={{ x, display: "flex", gap: 20 }}>
        {items.map(item => (
          <div key={item.id} style={{ flexShrink: 0, width: 400 }}>
            {item.content}
          </div>
        ))}
      </motion.div>
    </div>
  </div>
)
```

The container should have a long viewport-relative measurement like `300vh`. Increasing this length will make the horizontal scrolling feel slower.

\>Live example[Open](https://examples.motion.dev/react/scroll-horizontal)

### [Text scroll](#text-scroll)

By combining `useScroll` with the Motion+ `Ticker` we can make this popular effect where blocks of text scroll horizontally as the page itself scrolls vertically.

By passing `scrollY` to `useTransform` and multiplying it by `-1` we get a [motion value](/docs/react-motion-value) that moves in the opposite direction to the scroll.

```
const { scrollY } = useScroll()
const invertScroll = useTransform(() => scrollY.get() * -1)

const lines = [
    { text: "Creative", reverse: false },
    { text: "Design", reverse: true },
    { text: "Motion", reverse: false },
    { text: "Studio", reverse: true },
]
```

\>Live example[Open](https://examples.motion.dev/react/scroll-text-lines)

```
{lines.map((line, index) => (
  <Ticker
    key={line.text}
    className={`ticker-line ticker-${index}`}
    items={[
      <span className="text-solid">{line.text}</span>,
      <span className="text-outline">{line.text}</span>,
    ]}
    offset={line.reverse ? invertScroll : scrollY}
  />
))}
```

## [Examples](#examples)

#### [Track element scroll offset](#track-element-scroll-offset)

\>Live example[Open](https://examples.motion.dev/react/scroll-container)

#### [Track element within viewport](#track-element-within-viewport)

#### [3D](#3d)

#### [Scroll velocity and direction](#scroll-velocity-and-direction)

Read the [full](/docs/react-use-scroll) `useScroll` [docs](/docs/react-use-scroll) to discover more about creating the above effects.

## [FAQs](#faqs)

Are Motion scroll animations hardware accelerated?

Yes, when possible Motion scroll animations are hardware accelerated. Scroll-linked animations default to the browser's native `ScrollTimeline` (and soon `ViewTimeline`) when possible, falling back to JavaScript when necessary. Scroll-triggered animations use a pooled `IntersectionObserver` for extremely low overhead.

What's the difference between scroll-triggered and scroll-linked animations?

Scroll-triggered animations fire when an element enters or leaves the viewport, think fade-ins and reveal effects. Use `whileInView` or `useInView` for these. Scroll-linked animations tie a value directly to scroll position, think parallax and progress bars. Use `useScroll` for these.

How do I create a parallax effect in React?

Combine `useScroll` with `useTransform` to move elements at different speeds relative to scroll position. Pass the target ref of a container, then map `scrollYProgress` to different `y` ranges per layer: smaller ranges for background, larger for foreground.

How do I create a horizontal scroll section?

Wrap a wide flex container inside a `position: sticky` element, inside a tall container (e.g. `height: 300vh`). Use `useScroll` to track the tall container's progress, then `useTransform` to map `scrollYProgress` to a horizontal `x` translation. The taller the outer container, the slower the horizontal scroll feels.
