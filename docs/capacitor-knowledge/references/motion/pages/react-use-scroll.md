# useScroll

Track scroll progress as motion values, for parallax and progress bars.

`useScroll` is used to create scroll-linked animations, like progress indicators and parallax effects.

```
const { scrollYProgress } = useScroll()

return <motion.div style={{ scaleX: scrollYProgress }} />
```

`useScroll` is able to run some animations with the browser's `ScrollTimeline` [API](https://developer.mozilla.org/en-US/docs/Web/API/ScrollTimeline) for optimal hardware-accelerated performance, removing scroll measurements, improving scroll synchronisation and ensuring animations remain smooth even under heavy CPI usage.

## [Usage](#usage)

Import `useScroll` from Motion:

```
import { useScroll } from "motion/react"
```

`useScroll` returns four [motion values](/docs/react-motion-value):

-   `scrollX`/`Y`: The absolute scroll position, in pixels.
    
-   `scrollXProgress`/`YProgress`: The scroll position between the defined offsets, as a value between `0` and `1`.
    

### [Page scroll](#page-scroll)

By default, useScroll tracks the page scroll.

```
const { scrollY } = useScroll()

useMotionValueEvent(scrollY, "change", (latest) => {
  console.log("Page scroll: ", latest)
})
```

For example, we could show a page scroll indicator by passing `scrollYProgress` straight to the `scaleX` style of a progress bar.

```
const { scrollYProgress } = useScroll()

return <motion.div style={{ scaleX: scrollYProgress }} />
```

\>Live example[Open](https://examples.motion.dev/react/scroll-linked)

As `useScroll` returns motion values, we can compose this scroll info with other motion value hooks like `useTransform` and `useSpring`:

```
const { scrollYProgress } = useScroll()
const scaleX = useSpring(scrollYProgress)

return <motion.div style={{ scaleX }} />
```

\>Live example[Open](https://examples.motion.dev/react/scroll-linked-with-spring)

> Since `scrollY` is a `MotionValue`, there's a neat trick you can use to tell when the user's scroll direction changes:
> 
> ```
> const { scrollY } = useScroll()
> const [scrollDirection, setScrollDirection] = useState("down")
> 
> useMotionValueEvent(scrollY, "change", (current) => {
>   const diff = current - scrollY.getPrevious()
>   setScrollDirection(diff > 0 ? "down" : "up")
> })
> ```
> 
> Perfect for triggering a sticky header animation!
> 
> ~ Sam Selikoff, [Motion for React Recipes](https://buildui.com/courses/framer-motion-recipes)

### [Element scroll](#element-scroll)

To track the scroll position of a scrollable element we can pass the element's `ref` to `useScroll`'s `container` option:

```
const carouselRef = useRef(null)
const { scrollX } = useScroll({
  container: carouselRef
})

return (
  <div ref={carouselRef} style={{ overflow: "scroll" }}>
    {children}
  </div>
)
```

\>Live example[Open](https://examples.motion.dev/react/scroll-container)

### [Element position](#element-position)

We can track the progress of an element as it moves within a container by passing its `ref` to the `target` option.

```
const ref = useRef(null)
const { scrollYProgress } = useScroll({
  target: ref,
  offset: ["start end", "end end"]
})

return <div ref={ref}>
```

In this example, each item has its own progress indicator.

\>Live example[Open](https://examples.motion.dev/react/scroll-track-element-in-viewport)

### [Scroll offsets](#scroll-offsets)

With [the](/docs/react-use-scroll#offset) `offset` [option](/docs/react-use-scroll#offset) we can define which parts of the element we want to track with the viewport, for instance track elements as they enter in from the bottom, leave at the top, or travel throughout the whole viewport.

## [Performance](#performance)

Browsers are capable of animating some values, like `opacity`, `transform`, `clipPath` and `filter`, entirely on the GPU. This improves scroll synchronisation and ensures animations remain smooth even when sites are performing heavy work.

`useScroll` is also capable of running animations via the GPU. By passing `scrollXProgress` or `scrollYProgress` either directly to an `opacity` style, or via `useTransform` to one of the above styles, it will create a hardware-accelerated animation.

```
const { scrollYProgress } = useScroll()
const filter = useTransform(scrollYProgress, [0, 1], ["blur(10px)", "blur(0px)"])

return <motion.div style={{ opacity: scrollYProgress, filter }} />
```

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

## [Options](#options)

`useScroll` accepts the following options.

### [`container`](#container)

**Default**: Viewport

The scrollable container to track the scroll position of. By default, this is the browser viewport. By passing a ref to a scrollable element, that element can be used instead.

```
const containerRef = useRef(null)
const { scrollYProgress } = useScroll({ container: containerRef })
```

### [`target`](#target)

`useScroll` tracks the progress of the `target` within the `container`. By default, the `target` is the scrollable area of the `container`. It can additionally be set as another element, to track its progress within the `container`.

```
const targetRef = useRef(null)
const { scrollYProgress } = useScroll({ target: targetRef })
```

`target` is tracked by the element's layout position, so any CSS `transform` applied to it (or its ancestors) is ignored when measuring progress.

### [`axis`](#axis)

**Default:** `"y"`

The tracked axis for the defined `offset`.

### [`offset`](#offset)

**Default:** `["start start", "end end"]`

`offset` describes intersections, points where the `target` and `container` meet.

For example, the intersection `"start end"` means when the **start of the target** on the tracked axis meets the **end of the container.**

So if the target is an element, the container is the window, and we're tracking the vertical axis then `"start end"` is where the **top of the element** meets **the bottom of the viewport**.

#### [Accepted intersections](#accepted-intersections)

Both target and container points can be defined as:

-   **Number:** A value where `0` represents the start of the axis and `1` represents the end. So to define the top of the target with the middle of the container you could define `"0 0.5"`. Values outside this range are permitted.
    
-   **Names:** `"start"`, `"center"` and `"end"` can be used as clear shortcuts for `0`, `0.5` and `1` respectively.
    
-   **Pixels:** Pixel values like `"100px"`, `"-50px"` will be defined as that number of pixels from the start of the target/container.
    
-   **Percent:** Same as raw numbers but expressed as `"0%"` to `"100%"`.
    
-   **Viewport:** `"vh"` and `"vw"` units are accepted.
    

```
// Track an element as it enters from the bottom
const { scrollYProgress } = useScroll({
  target: targetRef,
  offset: ["start end", "end end"]
})

// Track an element as it moves out the top
const { scrollYProgress } = useScroll({
  target: targetRef,
  offset: ["start start", "end start"]
})
```

### [`trackContentSize`](#trackcontentsize)

**Default:** `false`

When the size of a page or element's content changes, its scrollable area can change too. But, because browsers don't provide a callback for changes in content size, by default `useScroll()` will not update until the next `"scroll"` event.

`useScroll` can automatically track changes to content size by setting `trackContentSize` to `true`.

```
useScroll({ trackContentSize: true })
```

Content size tracking is disabled by default because most of the time, scrollable area remains stable, and tracking changes to it involves a small overhead.
