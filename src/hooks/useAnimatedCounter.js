import { useState, useEffect } from 'react';

export function useAnimatedCounter(value, duration = 1000) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime = null;
        let animationFrame;
        const initialValue = count;
        const targetValue = value;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            
            // easeOutQuad curve for smooth countdown
            const easeOutProgress = percentage * (2 - percentage);
            
            setCount(Math.round(initialValue + (targetValue - initialValue) * easeOutProgress));

            if (percentage < 1) {
                animationFrame = requestAnimationFrame(animate);
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
        };
    }, [value, duration]);

    return count;
}
