import { useState, useEffect, useRef } from "react";

interface ImageSlideshowProps {
  images: string[];
  interval?: number; // in milliseconds, default 3000
}

export default function ImageSlideshow({
  images,
  interval = 3000,
}: ImageSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [mouseStart, setMouseStart] = useState<number | null>(null);
  const [mouseEnd, setMouseEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minSwipeDistance = 50;

  // Detect desktop view
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024); // lg breakpoint
    };

    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Helper function to get the 3 images to display on desktop
  const getDesktopImages = () => {
    // If exactly 3 images, show them statically with first image centered
    if (images.length === 3) {
      return [
        images[1], // Left: second image
        images[0], // Center: first image (always centered)
        images[2], // Right: third image
      ];
    }

    // Otherwise, show prev, current, next for slideshow
    const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    const nextIndex = (currentIndex + 1) % images.length;
    return [
      images[prevIndex], // Left image
      images[currentIndex], // Center image (current)
      images[nextIndex], // Right image
    ];
  };

  // Auto-advance slideshow (skip if exactly 3 images on desktop)
  useEffect(() => {
    // Don't auto-play if exactly 3 images on desktop (static display)
    if (images.length === 3 && isDesktop) {
      return;
    }

    if (isSwiping || isDragging) {
      // Clear auto-play when user is swiping or dragging
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
      return;
    }

    // Start auto-play when not swiping
    autoPlayRef.current = setInterval(() => {
      // Both desktop and mobile advance by 1 image
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, interval);

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isSwiping, isDragging, images.length, interval, isDesktop]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsSwiping(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsSwiping(false);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Move to next image
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    } else if (isRightSwipe) {
      // Move to previous image
      setCurrentIndex((prevIndex) =>
        prevIndex === 0 ? images.length - 1 : prevIndex - 1
      );
    }

    // Reset touch states and resume auto-play after a short delay
    setTouchStart(null);
    setTouchEnd(null);
    setTimeout(() => {
      setIsSwiping(false);
    }, 100);
  };

  // Mouse drag handlers for desktop
  const onMouseDown = (e: React.MouseEvent) => {
    setMouseEnd(null);
    setMouseStart(e.clientX);
    setIsDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging && mouseStart !== null) {
      setMouseEnd(e.clientX);
    }
  };

  const onMouseUp = () => {
    if (!mouseStart || !mouseEnd) {
      setIsDragging(false);
      return;
    }

    const distance = mouseStart - mouseEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Move to next image
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    } else if (isRightSwipe) {
      // Move to previous image
      setCurrentIndex((prevIndex) =>
        prevIndex === 0 ? images.length - 1 : prevIndex - 1
      );
    }

    // Reset mouse states and resume auto-play after a short delay
    setMouseStart(null);
    setMouseEnd(null);
    setTimeout(() => {
      setIsDragging(false);
    }, 100);
  };

  if (images.length === 0) {
    return null;
  }

  // Desktop view: show 3 images side by side
  if (isDesktop) {
    const desktopImages = getDesktopImages();
    const isStaticDisplay = images.length === 3;

    return (
      <div className="relative w-full overflow-hidden rounded-2xl">
        <div
          className={`flex gap-4 justify-center items-center ${
            isStaticDisplay ? "" : "cursor-grab active:cursor-grabbing"
          }`}
          onTouchStart={isStaticDisplay ? undefined : onTouchStart}
          onTouchMove={isStaticDisplay ? undefined : onTouchMove}
          onTouchEnd={isStaticDisplay ? undefined : onTouchEnd}
          onMouseDown={isStaticDisplay ? undefined : onMouseDown}
          onMouseMove={isStaticDisplay ? undefined : onMouseMove}
          onMouseUp={isStaticDisplay ? undefined : onMouseUp}
          onMouseLeave={isStaticDisplay ? undefined : onMouseUp}
        >
          {/* Left image */}
          <div
            className={`w-[calc(33.333%-0.67rem)] shrink-0 transition-opacity duration-500 ${
              isStaticDisplay ? "opacity-100" : "opacity-70"
            }`}
          >
            <img
              src={desktopImages[0]}
              alt={isStaticDisplay ? "Second image" : "Previous slide"}
              className="w-full h-auto object-cover rounded-2xl"
            />
          </div>

          {/* Center image */}
          <div className="w-[calc(33.333%-0.67rem)] shrink-0 transition-opacity duration-500 opacity-100">
            <img
              src={desktopImages[1]}
              alt={
                isStaticDisplay
                  ? "First image (centered)"
                  : `Current slide ${currentIndex + 1}`
              }
              className="w-full h-auto object-cover rounded-2xl"
            />
          </div>

          {/* Right image */}
          <div
            className={`w-[calc(33.333%-0.67rem)] shrink-0 transition-opacity duration-500 ${
              isStaticDisplay ? "opacity-100" : "opacity-70"
            }`}
          >
            <img
              src={desktopImages[2]}
              alt={isStaticDisplay ? "Third image" : "Next slide"}
              className="w-full h-auto object-cover rounded-2xl"
            />
          </div>
        </div>

        {/* Dots indicator for desktop (hide if static display) */}
        {!isStaticDisplay && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setIsSwiping(true);
                  setTimeout(() => setIsSwiping(false), 100);
                }}
                className={`h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? "w-8 bg-white"
                    : "w-2 bg-white/50 hover:bg-white/75"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Mobile/Tablet view: show 1 image at a time
  return (
    <div className="relative w-full overflow-hidden rounded-2xl">
      <div
        className="flex transition-transform duration-500 ease-in-out cursor-grab active:cursor-grabbing"
        style={{
          transform: `translateX(-${currentIndex * 100}%)`,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {images.map((image, index) => (
          <div
            key={index}
            className="min-w-full shrink-0"
            style={{ width: "100%" }}
          >
            <img
              src={image}
              alt={`Slide ${index + 1}`}
              className="w-full h-auto object-cover rounded-2xl"
            />
          </div>
        ))}
      </div>

      {/* Dots indicator for mobile */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1.5">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setCurrentIndex(index);
              setIsSwiping(true);
              setTimeout(() => setIsSwiping(false), 100);
            }}
            className={`h-1.5 rounded-full transition-all ${
              index === currentIndex
                ? "w-6 bg-white"
                : "w-1.5 bg-white/50 hover:bg-white/75"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
